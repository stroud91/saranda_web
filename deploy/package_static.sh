#!/bin/bash
# Builds the static version of the site and zips it for Namecheap (or any
# Apache/LiteSpeed host) — no Python app, no database, no Node on the server.
#
#   bash deploy/package_static.sh
#
# Then in cPanel → File Manager → public_html: Upload the zip, Extract it,
# and delete the zip. (Back up / clear the old site files first.)
#
# Bookings, guide requests and messages become ready-to-send WhatsApp/email
# messages; set the email and WhatsApp number in travago-tour-app/.env.static.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/travago-tour-app"
OUT="$APP/dist/saranda-public_html.zip"

cd "$APP"
[ -d node_modules ] || npm ci
npm run build:static
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"
# Zip the *contents* of build/ (including .htaccess) so they extract into public_html.
python3 - "$APP/build" "$OUT" <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk(src):
        dirs.sort()
        for name in sorted(files):
            if name.endswith(".map"):
                continue
            path = os.path.join(base, name)
            arc = os.path.relpath(path, src)
            # mp4/jpg are already compressed
            kind = zipfile.ZIP_STORED if name.endswith((".mp4", ".jpg", ".png", ".woff2")) else zipfile.ZIP_DEFLATED
            z.write(path, arc, compress_type=kind)
print(f"{out} ({os.path.getsize(out) / 1e6:.1f} MB)")
PY
echo "Upload $OUT to public_html and extract it there."
