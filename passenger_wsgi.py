"""Start file for cPanel → Setup Python App (Passenger).

In Setup Python App set "Application startup file" to ``passenger_wsgi.py`` and
"Application Entry point" to ``application``. Passenger looks for a WSGI callable named
``application``, and the wrapper cPanel writes for any other start file uses the ``imp``
module, which Python 3.12 removed. deploy/cpanel_deploy.sh copies this file into the app
folder on every deploy.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wsgi import app as application  # noqa: E402,F401  (wsgi.py loads .env first)
