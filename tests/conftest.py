import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.seeds.guides import seed_guides
from app.seeds.hotels import seed_hotels
from app.services.upstream import cache


@pytest.fixture()
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        seed_hotels()
        seed_guides()
        cache.clear()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin(monkeypatch):
    """Pretend a valid Clerk admin token was presented."""
    import app.auth as auth

    monkeypatch.setattr(auth, "verify_token", lambda token: {"sub": "user_admin" if token == "admin" else "user_other"})
    return {"Authorization": "Bearer admin"}
