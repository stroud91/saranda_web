import os


def _bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _list(name, default=""):
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]


def _database_url():
    url = os.environ.get("DATABASE_URL", "sqlite:///dev.db")
    # Heroku-style URLs use the deprecated postgres:// scheme.
    return url.replace("postgres://", "postgresql://", 1)


class Config:
    ENV_NAME = os.environ.get("FLASK_ENV", "production")
    IS_PRODUCTION = ENV_NAME == "production"

    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = _bool("SQLALCHEMY_ECHO")
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Request hardening
    MAX_CONTENT_LENGTH = 256 * 1024
    JSON_SORT_KEYS = False
    TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "1"))
    CORS_ORIGINS = _list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    FORCE_HTTPS = _bool("FORCE_HTTPS", IS_PRODUCTION)

    # Rate limiting (use redis:// in multi-worker production)
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_DEFAULT = os.environ.get("RATELIMIT_DEFAULT", "600 per hour;60 per minute")
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_ENABLED = _bool("RATELIMIT_ENABLED", True)

    # Auth (Clerk) — admin endpoints only; travellers never need an account.
    CLERK_ISSUER = os.environ.get("CLERK_ISSUER")  # e.g. https://your-app.clerk.accounts.dev
    CLERK_JWKS_URL = os.environ.get("CLERK_JWKS_URL")
    CLERK_AUTHORIZED_PARTIES = _list("CLERK_AUTHORIZED_PARTIES")
    ADMIN_USER_IDS = _list("ADMIN_USER_IDS")
    ADMIN_EMAILS = [e.lower() for e in _list("ADMIN_EMAILS")]

    # Payments
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

    # Live data providers
    GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
    OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
    WEATHER_CACHE_SECONDS = int(os.environ.get("WEATHER_CACHE_SECONDS", "1800"))
    FX_CACHE_SECONDS = int(os.environ.get("FX_CACHE_SECONDS", "43200"))
    PLACES_CACHE_SECONDS = int(os.environ.get("PLACES_CACHE_SECONDS", "21600"))
    LIVE_DATA_ENABLED = _bool("LIVE_DATA_ENABLED", True)

    # Affiliate IDs for outbound booking links (optional)
    BOOKING_AFFILIATE_ID = os.environ.get("BOOKING_AFFILIATE_ID")
    GYG_PARTNER_ID = os.environ.get("GYG_PARTNER_ID")
    VIATOR_PARTNER_ID = os.environ.get("VIATOR_PARTNER_ID")

    # AI concierge (Claude). Falls back to the built-in answer engine without a key.
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    CONCIERGE_MODEL = os.environ.get("CONCIERGE_MODEL", "claude-opus-5-5")
    CONCIERGE_ENABLED = _bool("CONCIERGE_ENABLED", True)

    # Business contact
    WHATSAPP_NUMBER = os.environ.get("WHATSAPP_NUMBER", "")
    CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "bookings@megrooms.com")


class TestConfig(Config):
    TESTING = True
    IS_PRODUCTION = False
    FORCE_HTTPS = False
    SECRET_KEY = "test-secret"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    RATELIMIT_ENABLED = False
    LIVE_DATA_ENABLED = False
    OSRM_URL = None
    ANTHROPIC_API_KEY = None
    STRIPE_SECRET_KEY = None
    GOOGLE_MAPS_API_KEY = None
    ADMIN_USER_IDS = ["user_admin"]
