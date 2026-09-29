from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

from app.models import db

migrate = Migrate()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)

__all__ = ["db", "migrate", "cors", "limiter"]
