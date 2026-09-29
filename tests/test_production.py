import pytest

from app import create_app
from app.config import TestConfig


class Prod(TestConfig):
    IS_PRODUCTION = True
    FORCE_HTTPS = True


def test_production_requires_secret_key():
    class NoSecret(Prod):
        SECRET_KEY = None
    with pytest.raises(RuntimeError):
        create_app(NoSecret)


def test_production_hides_route_map_and_sets_hsts():
    app = create_app(Prod)
    with app.app_context():
        from app.extensions import db
        db.create_all()
        c = app.test_client()
        r = c.get("/api/docs", headers={"X-Forwarded-Proto": "https"})
        assert r.status_code == 404
        r = c.get("/api/meta/health", headers={"X-Forwarded-Proto": "https"})
        assert "max-age=" in r.headers["Strict-Transport-Security"]
        assert "upgrade-insecure-requests" in r.headers["Content-Security-Policy"]


def test_http_is_redirected_to_https():
    app = create_app(Prod)
    r = app.test_client().get("/explore", headers={"X-Forwarded-Proto": "http"})
    assert r.status_code == 301 and r.headers["Location"].startswith("https://")


def test_forwarded_host_is_not_trusted():
    app = create_app(Prod)
    r = app.test_client().get("/explore", headers={"X-Forwarded-Proto": "http", "X-Forwarded-Host": "evil.example"})
    assert "evil.example" not in r.headers["Location"]
