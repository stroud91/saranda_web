"""Provider parsing, tested against recorded response shapes."""
import pytest

from app.services import live, upstream


@pytest.fixture()
def live_app(app):
    app.config.update(LIVE_DATA_ENABLED=True, OSRM_URL="https://router.project-osrm.org", GOOGLE_MAPS_API_KEY="k")
    return app


def fake(responses):
    def _request(method, url, **kw):
        for host, payload in responses.items():
            if host in url:
                if isinstance(payload, Exception):
                    raise payload
                return payload
        raise upstream.UpstreamError("unexpected url " + url)
    return _request


FORECAST = {
    "current": {"temperature_2m": 27.4, "apparent_temperature": 29.0, "weather_code": 1, "wind_speed_10m": 9, "is_day": 1, "uv_index": 6},
    "daily": {"time": ["2027-06-01", "2027-06-02"], "weather_code": [0, 61], "temperature_2m_max": [29, 25],
              "temperature_2m_min": [19, 18], "precipitation_probability_max": [0, 70], "uv_index_max": [8, 4],
              "sunrise": ["2027-06-01T05:25", "2027-06-02T05:25"], "sunset": ["2027-06-01T20:20", "2027-06-02T20:21"]},
}
MARINE = {"current": {"wave_height": 0.4, "sea_surface_temperature": 23.1}, "daily": {"wave_height_max": [0.6, 1.1]}}


def test_weather_parses_forecast_and_marine(live_app, monkeypatch):
    monkeypatch.setattr(live, "request_json", fake({"marine-api": MARINE, "api.open-meteo.com": FORECAST}))
    w = live.weather("sarande")
    assert w["live"] and w["current"]["temp"] == 27.4 and w["current"]["sea_temp"] == 23.1
    assert w["current"]["label"] == "Mainly clear"
    assert w["daily"][1]["label"] == "Light rain" and w["daily"][1]["wave_max"] == 1.1
    assert w["daily"][0]["sunset"] == "20:20"


def test_weather_falls_back_to_climate(live_app, monkeypatch):
    monkeypatch.setattr(live, "request_json", fake({"open-meteo": upstream.UpstreamError("down")}))
    w = live.weather("berat")
    assert w["live"] is False and w["typical"]["sea"] > 10


def test_fx_and_fallback(live_app, monkeypatch):
    monkeypatch.setattr(live, "request_json", fake({"er-api": {"rates": {"ALL": 97.3, "USD": 1.08}, "time_last_update_utc": "x"}}))
    assert live.fx_rates()["rates"]["ALL"] == 97.3
    upstream.cache.clear()
    monkeypatch.setattr(live, "request_json", fake({"er-api": {"rates": {"USD": 1.08}}}))
    assert live.fx_rates()["live"] is False


def test_osrm_geometry_swaps_lng_lat(live_app, monkeypatch):
    osrm = {"code": "Ok", "routes": [{"distance": 61000, "duration": 4200,
                                      "geometry": {"coordinates": [[20.0, 39.87], [20.1, 39.9], [20.19, 39.92]]}}]}
    monkeypatch.setattr(live, "request_json", fake({"osrm": osrm}))
    g = live.road_geometry(["sarande", "blue-eye"])
    assert g["live"] and g["coords"][0] == [39.87, 20.0] and g["distance_km"] == 61.0


def test_google_place(live_app, monkeypatch):
    payload = {"places": [{"displayName": {"text": "Butrint National Park"}, "rating": 4.7, "userRatingCount": 12000,
                           "googleMapsUri": "https://maps.google.com/?cid=1", "currentOpeningHours": {"openNow": True}}]}
    seen = {}

    def _req(method, url, **kw):
        seen.update(kw.get("headers") or {})
        return payload
    monkeypatch.setattr(live, "request_json", _req)
    p = live.google_place("butrint")
    assert p["rating"] == 4.7 and p["open_now"] is True
    assert "places.rating" in seen["X-Goog-FieldMask"]


def test_outbound_host_allowlist_blocks_ssrf():
    with pytest.raises(upstream.UpstreamError):
        upstream.request_json("GET", "https://169.254.169.254/latest/meta-data")
    with pytest.raises(upstream.UpstreamError):
        upstream.request_json("GET", "http://api.open-meteo.com/v1/forecast")


def test_negative_cache(live_app, monkeypatch):
    calls = []

    def boom(*a, **kw):
        calls.append(1)
        raise upstream.UpstreamError("down")
    monkeypatch.setattr(live, "request_json", boom)
    live.fx_rates()
    live.fx_rates()
    assert len(calls) == 1
