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
    assert con.execute("select version_num from alembic_version").fetchone()[0] == "e5a7c41b9d02"
    assert con.execute("select count(*) from guides").fetchone()[0] == 8
    tables = {r[0] for r in con.execute("select name from sqlite_master where type='table'")}
    assert {"user_sessions", "auth_tokens", "login_throttles"} <= tables
    assert "payment_method" in {r[1] for r in con.execute("pragma table_info(bookings)")}
    con.close()
    # The accounts/payments migration must also roll back and re-apply cleanly.
    for cmd in (["db", "downgrade", "c3f1a9d27e10"], ["db", "upgrade"]):
        r = subprocess.run(flask + cmd, cwd=root, env=env, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stderr[-2000:]
    con = sqlite3.connect(db)
    assert con.execute("select version_num from alembic_version").fetchone()[0] == "e5a7c41b9d02"
