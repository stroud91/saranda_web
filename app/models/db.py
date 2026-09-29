import os
import secrets
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")
# Schemas are a PostgreSQL feature: only use one in production, when SCHEMA is
# set and DATABASE_URL points at PostgreSQL. SQLite deployments ignore it.
USE_SCHEMA = (environment == "production" and bool(SCHEMA)
              and os.environ.get("DATABASE_URL", "").startswith(("postgres://", "postgresql")))

db = SQLAlchemy()

# Crockford base32 without ambiguous characters (no I, L, O, U).
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def add_prefix_for_prod(attr):
    """Prefix foreign-key targets with the schema name in production."""
    if USE_SCHEMA:
        return f"{SCHEMA}.{attr}"
    return attr


def table_args(*extra):
    """``__table_args__`` that puts tables in SCHEMA in production."""
    if USE_SCHEMA:
        return (*extra, {"schema": SCHEMA})
    return tuple(extra) if extra else ()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_reference(prefix=""):
    """Unguessable, human-friendly reference: 60 bits, e.g. ``7KQ2-9XWD-P3MA``."""
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(12))
    return prefix + "-".join(raw[i:i + 4] for i in range(0, 12, 4))


def mask_email(email):
    if not email or "@" not in email:
        return None
    name, domain = email.split("@", 1)
    return (name[:1] + "•••" + name[-1:] if len(name) > 2 else name[:1] + "•••") + "@" + domain
