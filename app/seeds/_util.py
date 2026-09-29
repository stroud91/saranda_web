from sqlalchemy.sql import text

from app.models.db import SCHEMA, db, environment


def truncate(table):
    """Empty a table (TRUNCATE on Postgres in production, DELETE elsewhere)."""
    if environment == "production" and SCHEMA:
        db.session.execute(text(f"TRUNCATE table {SCHEMA}.{table} RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text(f"DELETE FROM {table}"))
    db.session.commit()
