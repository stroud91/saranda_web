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


def test_migrations_run_on_sqlite_in_production(tmp_path):
    """cPanel setup: FLASK_ENV=production with SQLite must migrate cleanly,
    even if SCHEMA (a PostgreSQL-only setting) is accidentally set."""
    import os
    import sqlite3
    import subprocess
    import sys

    db = tmp_path / "prod.db"
    env = {**os.environ, "FLASK_APP": "app", "FLASK_ENV": "production", "SECRET_KEY": "x" * 40,
           "DATABASE_URL": f"sqlite:///{db}", "SCHEMA": "should_be_ignored"}
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    flask = [sys.executable, "-m", "flask"]
    for cmd in (["db", "upgrade"], ["db", "upgrade"], ["seed", "all"]):
        r = subprocess.run(flask + cmd, cwd=root, env=env, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stderr[-2000:]
    con = sqlite3.connect(db)
    assert con.execute("select version_num from alembic_version").fetchone()[0] == "a91c5e0d7b24"
    assert con.execute("select count(*) from guides").fetchone()[0] == 8
    tables = {r[0] for r in con.execute("select name from sqlite_master where type='table'")}
    assert {"user_sessions", "auth_tokens", "login_throttles", "businesses", "enquiries"} <= tables
    # Listings that existed before the business portal are the site's own and stay public.
    assert {r[0] for r in con.execute("select review_status from hotels")} == {"approved"}
    assert "business_id" in {r[1] for r in con.execute("pragma table_info(car_rentals)")}
    assert "payment_method" in {r[1] for r in con.execute("pragma table_info(bookings)")}
    con.close()
    # The accounts/payments and business-portal migrations must also roll back and re-apply cleanly.
    for cmd in (["db", "downgrade", "c3f1a9d27e10"], ["db", "upgrade"]):
        r = subprocess.run(flask + cmd, cwd=root, env=env, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stderr[-2000:]
    con = sqlite3.connect(db)
    assert con.execute("select version_num from alembic_version").fetchone()[0] == "a91c5e0d7b24"
    assert con.execute("select count(*) from hotels where review_status = 'approved'").fetchone()[0] > 0


def test_seeding_never_silently_deletes_bookings(app, client):
    """`flask seed all` used to wipe every booking in production. It must refuse on a
    database that already has data, and ask before deleting bookings on a reset."""
    from app.models import Booking

    stay = client.get("/api/hotels/").get_json()[0]
    r = client.post("/api/bookings/", json={"hotel_id": stay["id"], "start_date": "2031-06-10", "end_date": "2031-06-13",
                                           "guest_count": 2, "guest_name": "Ana", "guest_email": "ana@example.com"})
    assert r.status_code == 201
    runner = app.test_cli_runner()
    refused = runner.invoke(args=["seed", "all"])
    assert refused.exit_code != 0 and "already has data" in refused.output
    declined = runner.invoke(args=["seed", "all", "--reset"], input="n\n")
    assert declined.exit_code != 0 and "permanently deletes 1 booking" in declined.output
    with app.app_context():
        assert Booking.query.count() == 1
    assert runner.invoke(args=["seed", "undo"], input="n\n").exit_code != 0
    with app.app_context():
        assert Booking.query.count() == 1
    wiped = runner.invoke(args=["seed", "all", "--reset", "--yes"])
    assert wiped.exit_code == 0, wiped.output
    with app.app_context():
        assert Booking.query.count() == 0


def test_rate_limit_spares_page_files_but_still_guards_the_api():
    """The site's own pages, scripts, images and videos must never count towards
    the per-visitor limit: one visit loads 30+ files, so a guest clicking through
    a few pages would be blocked. API endpoints keep their limits."""
    import secrets

    from app.extensions import db

    class Limited(TestConfig):
        RATELIMIT_ENABLED = True
        RATELIMIT_DEFAULT = "60 per minute"
        RATELIMIT_KEY_PREFIX = "rl-" + secrets.token_hex(4)  # fresh counters for this test

    app = create_app(Limited)
    with app.app_context():
        db.create_all()
        client = app.test_client()
        paths = ["/", "/explore", "/stays/1", "/favicon.svg", "/assets/does-not-exist.js", "/media/video/reel.mp4"]
        statuses = [client.get(paths[i % len(paths)]).status_code for i in range(90)]
        assert 429 not in statuses
        api = [client.get("/api/meta/health").status_code for _ in range(61)]
        assert api[:60] == [200] * 60 and api[60] == 429
        db.session.remove()
        db.drop_all()
