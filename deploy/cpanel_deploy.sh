#!/bin/bash
# Deploys Saranda Companion to a cPanel "Setup Python App" (Passenger) application.
# Called by .cpanel.yml from cPanel → Git Version Control → "Deploy HEAD Commit".
#
# What it does:
#   1. Syncs backend code (app/, migrations/, wsgi.py, requirements.txt) into APP_ROOT.
#      Never touches APP_ROOT/.env or APP_ROOT/instance/ (your secrets and database).
#   2. Builds the frontend if Node.js/npm exists on the server; otherwise keeps the
#      build/ folder you uploaded (build it locally with `npm ci && npm run build`).
#   3. Installs Python packages and runs database migrations inside the app's virtualenv.
#   4. Restarts the Passenger app.
set -euo pipefail

# ---- Settings (match these to your cPanel account) --------------------------------
CPANEL_USER="${CPANEL_USER:-megruhsm}"
APP_ROOT="${APP_ROOT:-/home/$CPANEL_USER/megrooms_flask}"
VENV_BASE="${VENV_BASE:-/home/$CPANEL_USER/virtualenv/megrooms_flask}"
SRC="${DEPLOYMENT_SOURCE:-$(cd "$(dirname "$0")/.." && pwd)}"
# -----------------------------------------------------------------------------------

log() { echo "[deploy] $*"; }

sync_dir() {  # sync_dir <source dir> <dest dir>: mirror, removing stale files
  mkdir -p "$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude '__pycache__/' --exclude '*.pyc' "$1/" "$2/"
  else
    rm -rf "$2" && mkdir -p "$2" && cp -R "$1/." "$2/"
    find "$2" -name '__pycache__' -type d -prune -exec rm -rf {} +
  fi
}

log "Source: $SRC"
log "App root: $APP_ROOT"
mkdir -p "$APP_ROOT" "$APP_ROOT/instance" "$APP_ROOT/tmp"

# 1. Backend code
sync_dir "$SRC/app" "$APP_ROOT/app"
sync_dir "$SRC/migrations" "$APP_ROOT/migrations"
cp "$SRC/wsgi.py" "$SRC/requirements.txt" "$APP_ROOT/"
log "Backend code synced"

if [ ! -f "$APP_ROOT/.env" ]; then
  log "WARNING: $APP_ROOT/.env is missing. Create it (see .env.example) before the app can start in production."
fi

# 2. Frontend
FRONTEND_DEST="$APP_ROOT/travago-tour-app/build"
if command -v npm >/dev/null 2>&1; then
  log "npm found ($(npm --version)); building frontend"
  (cd "$SRC/travago-tour-app" && npm ci --no-audit --no-fund && npm run build)
  sync_dir "$SRC/travago-tour-app/build" "$FRONTEND_DEST"
  log "Frontend built and deployed"
elif [ -d "$SRC/travago-tour-app/build" ]; then
  sync_dir "$SRC/travago-tour-app/build" "$FRONTEND_DEST"
  log "Frontend copied from repository build/"
elif [ -f "$FRONTEND_DEST/index.html" ]; then
  log "npm not available: keeping the existing frontend in $FRONTEND_DEST."
  log "If the frontend changed, build it locally and upload travago-tour-app/build/ there."
else
  log "WARNING: no frontend build found. Build locally (npm ci && npm run build) and upload"
  log "         travago-tour-app/build/ to $FRONTEND_DEST"
fi

# 3. Python packages + migrations
ACTIVATE="$(ls -d "$VENV_BASE"/*/bin/activate 2>/dev/null | sort -V | tail -n 1 || true)"
if [ -n "$ACTIVATE" ]; then
  log "Using virtualenv: $(dirname "$(dirname "$ACTIVATE")")"
  # shellcheck disable=SC1090
  source "$ACTIVATE"
  (cd "$APP_ROOT" && pip install --quiet -r requirements.txt)
  log "Python packages installed"
  if [ -f "$APP_ROOT/.env" ]; then
    (cd "$APP_ROOT" && FLASK_APP=app flask db upgrade)
    log "Database migrations applied"
  else
    log "Skipping migrations until $APP_ROOT/.env exists"
  fi
  deactivate || true
else
  log "WARNING: no virtualenv under $VENV_BASE. Create the app in cPanel → Setup Python App first."
fi

# 4. Restart Passenger
touch "$APP_ROOT/tmp/restart.txt"
log "App restart requested. Deployment complete."
