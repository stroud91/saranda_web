from sqlalchemy.sql import text

from app.models.db import SCHEMA, USE_SCHEMA, db


def truncate(table):
    """Empty a table (TRUNCATE on Postgres with a schema, DELETE elsewhere)."""
    if USE_SCHEMA:
        db.session.execute(text(f"TRUNCATE table {SCHEMA}.{table} RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text(f"DELETE FROM {table}"))
    db.session.commit()
