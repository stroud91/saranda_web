"""Hardened outbound HTTP + a small TTL cache for third-party data.

- Every request has a connect/read timeout and a response-size cap.
- Only HTTPS URLs on an explicit host allowlist can be fetched (SSRF guard),
  so no user input can ever steer the server to internal addresses.
- Results are cached in-process; failures are cached briefly (negative
  caching) so a slow provider can't pile up requests.
"""
import logging
import threading
import time
from urllib.parse import urlparse

import requests

log = logging.getLogger(__name__)

ALLOWED_HOSTS = {
    "api.open-meteo.com",
    "marine-api.open-meteo.com",
    "open.er-api.com",
    "places.googleapis.com",
    "router.project-osrm.org",
    "api.pwnedpasswords.com",        # breached-password check (k-anonymity range API)
    "api-m.paypal.com",              # PayPal REST API (live)
    "api-m.sandbox.paypal.com",      # PayPal REST API (sandbox)
}
MAX_BYTES = 2_000_000
TIMEOUT = (3.05, 8)
USER_AGENT = "SarandaCompanion/2.0 (+https://megrooms.com)"


class UpstreamError(RuntimeError):
    pass


def allow_host(host):
    """Allow an extra host (e.g. a self-hosted OSRM configured by the operator)."""
    if host:
        ALLOWED_HOSTS.add(host.lower())


def _check_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or (parsed.hostname or "").lower() not in ALLOWED_HOSTS:
        raise UpstreamError(f"Blocked outbound URL host: {parsed.hostname}")


def request_json(method, url, *, params=None, json=None, headers=None, timeout=TIMEOUT):
    _check_url(url)
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    hdrs.update(headers or {})
    try:
        with requests.request(method, url, params=params, json=json, headers=hdrs, timeout=timeout,
                              stream=True, allow_redirects=False) as resp:
            if resp.status_code >= 400:
                raise UpstreamError(f"{urlparse(url).hostname} returned {resp.status_code}")
            body = resp.raw.read(MAX_BYTES + 1, decode_content=True)
            if len(body) > MAX_BYTES:
                raise UpstreamError("Upstream response too large")
            import json as _json
            return _json.loads(body)
    except requests.RequestException as exc:
        raise UpstreamError(f"{urlparse(url).hostname} unreachable: {exc.__class__.__name__}") from None
    except ValueError:
        raise UpstreamError("Upstream returned invalid JSON") from None


def _read(resp):
    body = resp.raw.read(MAX_BYTES + 1, decode_content=True)
    if len(body) > MAX_BYTES:
        raise UpstreamError("Upstream response too large")
    return body


def request_text(method, url, *, headers=None, timeout=TIMEOUT):
    """Like ``request_json`` for plain-text APIs."""
    _check_url(url)
    hdrs = {"User-Agent": USER_AGENT}
    hdrs.update(headers or {})
    try:
        with requests.request(method, url, headers=hdrs, timeout=timeout, stream=True, allow_redirects=False) as resp:
            if resp.status_code >= 400:
                raise UpstreamError(f"{urlparse(url).hostname} returned {resp.status_code}")
            return _read(resp).decode("utf-8", "replace")
    except requests.RequestException as exc:
        raise UpstreamError(f"{urlparse(url).hostname} unreachable: {exc.__class__.__name__}") from None


def call_api(method, url, *, json=None, data=None, headers=None, auth=None, timeout=TIMEOUT):
    """For transactional APIs (payments): returns ``(status, body)`` without
    raising on 4xx, because the error body says what went wrong. Same HTTPS +
    allowlist + size + no-redirect guards as everything else."""
    import json as _json

    _check_url(url)
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    hdrs.update(headers or {})
    try:
        with requests.request(method, url, json=json, data=data, headers=hdrs, auth=auth, timeout=timeout,
                              stream=True, allow_redirects=False) as resp:
            raw = _read(resp)
            try:
                body = _json.loads(raw) if raw else {}
            except ValueError:
                body = {}
            return resp.status_code, body if isinstance(body, dict) else {}
    except requests.RequestException as exc:
        raise UpstreamError(f"{urlparse(url).hostname} unreachable: {exc.__class__.__name__}") from None


class TTLCache:
    def __init__(self, max_items=512):
        self._data = {}
        self._lock = threading.Lock()
        self._max = max_items

    def get(self, key):
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            expires, value = item
            if expires < time.monotonic():
                self._data.pop(key, None)
                return None
            return value

    def set(self, key, value, ttl):
        with self._lock:
            if len(self._data) >= self._max:
                # Drop the entry closest to expiry.
                oldest = min(self._data, key=lambda k: self._data[k][0])
                self._data.pop(oldest, None)
            self._data[key] = (time.monotonic() + ttl, value)

    def clear(self):
        with self._lock:
            self._data.clear()


cache = TTLCache()
_MISS = object()


def cached(key, ttl, producer, *, fail_ttl=60):
    """Return cached value or produce it. Failures are negatively cached."""
    hit = cache.get(key)
    if hit is not None:
        if hit is _MISS:
            raise UpstreamError("Provider temporarily unavailable (cached failure)")
        return hit
    try:
        value = producer()
    except UpstreamError as exc:
        log.warning("upstream failure for %s: %s", key[0] if isinstance(key, tuple) else key, exc)
        cache.set(key, _MISS, fail_ttl)
        raise
    cache.set(key, value, ttl)
    return value
