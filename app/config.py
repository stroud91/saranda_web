import os


def _bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _number(name, default, kind, words):
    """A number from the environment. Left blank (``NAME=`` in .env) it means the default;
    anything else that isn't a number stops the app with a message naming the setting."""
    val = (os.environ.get(name) or "").strip()
    if not val:
        return default
    try:
        return kind(val)
    except ValueError:
        raise ValueError(f"{name} in .env must be {words}, not {val!r}. Fix it or leave it blank for the default.") from None


def _int(name, default):
    return _number(name, default, int, "a whole number")


def _float(name, default):
    return _number(name, default, float, "a number")


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
    TRUSTED_PROXY_HOPS = _int("TRUSTED_PROXY_HOPS", 1)
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

    # Guest accounts (the site's own email + password login)
    ACCOUNTS_ENABLED = _bool("ACCOUNTS_ENABLED", True)
    # Public address of the site, used for links in e-mails. Required in production
    # for verification / reset e-mails (never taken from the request's Host header).
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "")
    PASSWORD_HASH_METHOD = os.environ.get("PASSWORD_HASH_METHOD", "scrypt:32768:8:3")
    # Reject passwords found in known breaches (Have I Been Pwned range API; only
    # the first 5 characters of a SHA-1 hash leave the server).
    PASSWORD_BREACH_CHECK = _bool("PASSWORD_BREACH_CHECK", True)
    # Outgoing mail (e.g. the mailbox included with the hosting). Empty = no e-mails.
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = _int("SMTP_PORT", 465)
    SMTP_SECURITY = os.environ.get("SMTP_SECURITY", "")  # ssl | starttls (default: by port)
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_FROM = os.environ.get("SMTP_FROM", "")

    # Payments
    # Share of the stay paid when booking (the rest is paid on arrival). 100 = pay in full.
    PAYMENT_DEPOSIT_PERCENT = _int("PAYMENT_DEPOSIT_PERCENT", 100)
    # PayPal (also takes cards without a PayPal account). Works for accounts in Albania.
    PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
    PAYPAL_CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
    PAYPAL_ENV = os.environ.get("PAYPAL_ENV", "sandbox")  # sandbox | live
    PAYPAL_WEBHOOK_ID = os.environ.get("PAYPAL_WEBHOOK_ID", "")
    PAYPAL_CURRENCY = os.environ.get("PAYPAL_CURRENCY", "EUR").upper()  # EUR or USD
    PAYPAL_FX_MARGIN_PERCENT = _float("PAYPAL_FX_MARGIN_PERCENT", 0)
    # Optional fixed EUR→USD rate for PAYPAL_CURRENCY=USD (default: the day's live rate)
    PAYPAL_EUR_USD_RATE = _float("PAYPAL_EUR_USD_RATE", 0) or None
    # Bank transfer (SEPA / SWIFT) to the business account.
    BANK_IBAN = os.environ.get("BANK_IBAN", "")
    BANK_BIC = os.environ.get("BANK_BIC", "")
    BANK_BENEFICIARY = os.environ.get("BANK_BENEFICIARY", "")
    BANK_NAME = os.environ.get("BANK_NAME", "")
    BANK_HOLD_HOURS = _int("BANK_HOLD_HOURS", 48)
    BANK_CLAIM_HOLD_DAYS = _int("BANK_CLAIM_HOLD_DAYS", 5)
    # Stripe (not available to businesses registered in Albania; kept for EU/US entities)
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

    # Live data providers
    GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
    OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
    WEATHER_CACHE_SECONDS = _int("WEATHER_CACHE_SECONDS", 1800)
    FX_CACHE_SECONDS = _int("FX_CACHE_SECONDS", 43200)
    PLACES_CACHE_SECONDS = _int("PLACES_CACHE_SECONDS", 21600)
    LIVE_DATA_ENABLED = _bool("LIVE_DATA_ENABLED", True)

    # Affiliate IDs for outbound booking links (optional)
    BOOKING_AFFILIATE_ID = os.environ.get("BOOKING_AFFILIATE_ID")
    GYG_PARTNER_ID = os.environ.get("GYG_PARTNER_ID")
    VIATOR_PARTNER_ID = os.environ.get("VIATOR_PARTNER_ID")

    # AI concierge (Claude). Falls back to the built-in answer engine without a key.
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    CONCIERGE_MODEL = os.environ.get("CONCIERGE_MODEL", "claude-opus-5-5")
    CONCIERGE_ENABLED = _bool("CONCIERGE_ENABLED", True)

    # The seed data includes sample guide profiles so the directory can be demoed.
    # They stay hidden from guests unless this is switched on; real guides added
    # by the host (is_sample off) always show.
    SHOW_SAMPLE_GUIDES = _bool("SHOW_SAMPLE_GUIDES", False)

    # Business contact
    WHATSAPP_NUMBER = os.environ.get("WHATSAPP_NUMBER", "")
    CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "bookings@megrooms.com")
    # Business portal: local businesses add their own profile and listings, which
    # stay hidden until the host approves them. Needs accounts and outgoing e-mail.
    PARTNERS_ENABLED = _bool("PARTNERS_ENABLED", True)
    PARTNER_MAX_LISTINGS = _int("PARTNER_MAX_LISTINGS", 40)

    # Visitor statistics without cookies (Host desk → Visitors). Counters are kept this many days.
    STATS_ENABLED = _bool("STATS_ENABLED", True)
    STATS_KEEP_DAYS = _int("STATS_KEEP_DAYS", 760)

    # Backups (`flask backup run`, daily from cron). Kept in instance/backups unless BACKUP_DIR
    # says otherwise. With a passphrase every file is encrypted; a copy is sent to
    # BACKUP_UPLOAD_URL (an https WebDAV folder) only when a passphrase is set.
    BACKUP_DIR = os.environ.get("BACKUP_DIR") or None
    BACKUP_PASSPHRASE = os.environ.get("BACKUP_PASSPHRASE", "")
    BACKUP_KEEP_DAILY = _int("BACKUP_KEEP_DAILY", 7)
    BACKUP_KEEP_WEEKLY = _int("BACKUP_KEEP_WEEKLY", 4)
    BACKUP_KEEP_MONTHLY = _int("BACKUP_KEEP_MONTHLY", 6)
    BACKUP_KEEP_PHOTOS = _int("BACKUP_KEEP_PHOTOS", 2)
    BACKUP_PHOTOS_EVERY_DAYS = _int("BACKUP_PHOTOS_EVERY_DAYS", 7)
    BACKUP_MAX_AGE_HOURS = _int("BACKUP_MAX_AGE_HOURS", 36)  # older than this = alert
    BACKUP_UPLOAD_URL = os.environ.get("BACKUP_UPLOAD_URL", "")
    BACKUP_UPLOAD_USER = os.environ.get("BACKUP_UPLOAD_USER", "")
    BACKUP_UPLOAD_PASSWORD = os.environ.get("BACKUP_UPLOAD_PASSWORD", "")

    # Alerts (`flask monitor check`, hourly from cron). Sent to ALERT_EMAIL, or else to
    # CONTACT_EMAIL. The heartbeat address is pinged after each check.
    ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "")
    ALERT_HEARTBEAT_URL = os.environ.get("ALERT_HEARTBEAT_URL", "")
    ALERT_MIN_FREE_MB = _int("ALERT_MIN_FREE_MB", 500)
    ALERT_REPEAT_HOURS = _int("ALERT_REPEAT_HOURS", 24)
    ALERT_ERROR_MINUTES = _int("ALERT_ERROR_MINUTES", 60)
    ALERT_CALENDAR_HOURS = _int("ALERT_CALENDAR_HOURS", 24)
    ALERT_CERT_DAYS = _int("ALERT_CERT_DAYS", 10)

    # Two-step sign-in is optional for everyone. Set this to make host accounts use it:
    # the Host desk then refuses to open until the host has switched it on.
    REQUIRE_TWO_STEP_FOR_HOSTS = _bool("REQUIRE_TWO_STEP_FOR_HOSTS", False)

    # Cancellation rules for the site's own apartments (shown on the terms page and applied
    # when a guest cancels): full refund this many days before check-in, a partial refund
    # down to the second number, nothing after that.
    CANCEL_FULL_REFUND_DAYS = _int("CANCEL_FULL_REFUND_DAYS", 14)
    CANCEL_PARTIAL_REFUND_DAYS = _int("CANCEL_PARTIAL_REFUND_DAYS", 7)
    CANCEL_PARTIAL_REFUND_PERCENT = _int("CANCEL_PARTIAL_REFUND_PERCENT", 50)

    # Guest reviews of stays (written only by guests whose stay has finished).
    REVIEWS_ENABLED = _bool("REVIEWS_ENABLED", True)

    # Photos for listings: the largest file accepted, and where they are kept
    # (default: instance/uploads, which deploys never touch).
    UPLOAD_MAX_MB = _int("UPLOAD_MAX_MB", 10)
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR") or None
    PARTNER_MAX_PHOTOS = _int("PARTNER_MAX_PHOTOS", 300)  # per business
    HOUSE_MAX_PHOTOS = _int("HOUSE_MAX_PHOTOS", 3000)

    # Calendars: extra hosts whose iCal feeds may be imported (Airbnb, Booking.com, Vrbo and
    # Google Calendar are always allowed), and how stale an imported calendar may be
    # before a new booking triggers a fresh look.
    CALENDAR_FEED_HOSTS = _list("CALENDAR_FEED_HOSTS")
    CALENDAR_SYNC_MINUTES = _int("CALENDAR_SYNC_MINUTES", 30)

    # Contact messages and guide requests that never became a booking are deleted
    # after this many months by `flask users cleanup` (the privacy policy says so).
    MESSAGE_RETENTION_MONTHS = _int("MESSAGE_RETENTION_MONTHS", 24)


class TestConfig(Config):
    TESTING = True
    IS_PRODUCTION = False
    FORCE_HTTPS = False
    SECRET_KEY = "test-secret"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    RATELIMIT_ENABLED = False
    LIVE_DATA_ENABLED = False
    SHOW_SAMPLE_GUIDES = True  # most tests exercise the guide flow with the seeded samples
    OSRM_URL = None
    ANTHROPIC_API_KEY = None
    STRIPE_SECRET_KEY = None
    GOOGLE_MAPS_API_KEY = None
    ADMIN_USER_IDS = ["user_admin"]
    ADMIN_EMAILS = ["host@megrooms.test"]
    PASSWORD_HASH_METHOD = "scrypt:1024:8:1"  # fast hashes for tests only
    PASSWORD_BREACH_CHECK = False
    PUBLIC_BASE_URL = "https://megrooms.test"
    SMTP_HOST = ""
    PAYMENT_DEPOSIT_PERCENT = 100
    PAYPAL_CLIENT_ID = ""
    PAYPAL_CLIENT_SECRET = ""
    PAYPAL_WEBHOOK_ID = ""
    PAYPAL_CURRENCY = "EUR"
    PAYPAL_FX_MARGIN_PERCENT = 0.0
    PAYPAL_EUR_USD_RATE = None
    BANK_IBAN = ""
    BANK_BIC = ""
    BANK_BENEFICIARY = ""
