# Saranda Companion · Meg'Rooms

An app-like travel companion for Albania, built around *The Ultimate Albania Travel Planner 2027* and run from Meg'Rooms' apartments in Sarandë. Travellers can:

- **Connect any two places.** The app finds the fastest chain of roads, ferries and boats and shows distance and time ranges, noting which figures come from the planner and which are estimates.
- **Get day timelines.** Each day becomes a clock-time schedule (drives, visits, a lunch break) with warnings: long driving days, a major sight at the end of a long drive, peak-season heat and crowds, and sea conditions.
- **Plan a whole trip.** Start from the 7-, 10- or 14-day itineraries or from nothing. Reorder stops by dragging, see every day on a map, estimate the budget, tick off the packing list, then save and share a link or export to a calendar (`.ics`).
- **Pick a local guide.** Filter guides by language, speciality, vehicle and group size, check their availability calendar and send a request. The price is quoted server-side and nothing is charged until the guide confirms.
- **Book a stay.** Meg'Rooms apartments have an availability calendar and a live server-side quote. Guests pay by PayPal (or card through PayPal) or by bank transfer, optionally as a deposit; with nothing configured it falls back to request-to-book.
- **Have an account.** Email + password sign-in, with bookings shown as boarding-pass tickets, saved trips, guide requests, a device list, data export and account deletion. Hosts get a Host desk for confirming requests and transfers.
- **Ask the concierge.** Claude answers using read-only tools over the planner data. Without an API key, a built-in answer engine handles the common questions.
- **Check live data.** Weather and sea temperature (Open-Meteo), EUR→ALL rates, optional Google Places ratings, OSRM road geometry, and pre-filled searches on Booking.com, Airbnb, Google Hotels, GetYourGuide, Viator and Rentalcars.

The design uses a Mediterranean palette (Ionian blues, Ksamil turquoise, sand, terracotta, sun, olive, bougainvillea) with light and dark themes. Every destination gets a procedurally drawn, animated SVG postcard, so the site needs no licensed photos. It has a glass top bar, a mobile bottom tab bar, bottom sheets, page transitions and is installable as a PWA.

**Interactive layer**

- **Live Ionian Sea hero.** A WebGL2 shader of the bay looking out to Corfu. Drag the time dial (it follows the real clock in Sarandë by default) through sunrise, golden hour and night: stars, a moon and the town's lights appear. Tap the water for ripples, or tap the night sky for a shooting star. The sea sound is synthesised in the browser and is off until switched on.
- **3D atlas** (`/atlas`). three.js relief of Albania with holographic contour lines, a scanner sweep, glowing beacons for every destination and the road/ferry network. Connect two places to draw the route as a light trail, then **Fly it**: the camera follows the route while each leg lights up. Every route result also has a "Fly it in 3D" button.
- **Albania in motion.** A cinematic reel with chapters that follow the playback, full-screen stories (tap, hold to pause, swipe down to close), video headers on destination pages, and Sarandë films from YouTube that load only when played.
- **Micro-interactions.** A pointer halo, magnetic buttons, 3D tilt cards with glare, a reading-progress line, and a command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd> or <kbd>/</kbd>) that searches places, pages and actions.

All of it respects `prefers-reduced-motion` (still frames, no fly-throughs), pauses when off screen or in a background tab, adapts its resolution to the device, and falls back to the SVG art when WebGL isn't available.

## Architecture

```
app/                    Flask 3 API (Python 3.10+)
  data/                 Versioned travel knowledge from the planner:
                        destinations, route legs, itineraries, essentials
  services/             routing (Dijkstra), timeline, budget, live providers,
                        concierge (Claude + offline engine), payments, ics
  api/                  Blueprints (see /api/docs in development)
  models/               SQLAlchemy 2: stays, bookings, guides, guide requests,
                        saved trips, tours, cars, contact messages
  security.py auth.py validation.py
migrations/             Alembic migrations
tests/                  pytest suite (engines, API, accounts, payments, live providers, Claude loop, prod hardening)
travago-tour-app/       React 19 + Vite frontend (builds to travago-tour-app/build)
  src/engine/           JS ports of the routing/timeline/budget/concierge engines
                        + a local API for static hosting (parity-tested)
  src/components/hero/  WebGL2 ocean      src/components/atlas/  three.js atlas
  src/components/media/ reel, stories, YouTube facade
scripts/                export_static.py, edit_videos.py
deploy/                 cpanel_deploy.sh (Python app), package_static.sh (static zip)
```

The planner's knowledge (places, road times, itineraries, advice) lives in code under `app/data/`. It changes seasonally, can be reviewed in pull requests, and is fast to query. Anything transactional (guides, bookings, trips) lives in the database.

## Running locally

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # fill in what you need; everything optional works without keys
flask db upgrade && flask seed all
flask run                        # http://127.0.0.1:5000

# Frontend (second terminal)
cd travago-tour-app
npm install
npm run dev                      # http://localhost:5173 (proxies /api to Flask)

# Tests
pytest                           # backend
cd travago-tour-app && npm test  # frontend unit tests
```

For a production-like run, `npm run build` and then `gunicorn "wsgi:app"`. Flask serves the built SPA.

## Hosting on Namecheap without Python (static upload)

The whole site also runs as plain files, so it can go straight into `public_html` on Namecheap (or any Apache/LiteSpeed host) with no Python app, database or Node on the server.

```bash
bash deploy/package_static.sh     # → travago-tour-app/dist/saranda-public_html.zip
```

Then in cPanel → **File Manager** → `public_html`: back up and remove the old site files, **Upload** the zip, **Extract** it, and delete the zip. The zip includes `.htaccess`, which handles HTTPS, app routes, caching, compression and security headers. Each GitHub Actions run also produces this zip as the **namecheap-public_html** artifact.

What happens without a server:

| Feature | Static upload |
|---|---|
| Routes, timelines, budgets, quotes, concierge | Same results. JavaScript ports of the Python engines run in the browser, and `src/engine/parity.test.js` checks them against the Python output on every test run |
| Places, guides, stays, itineraries, essentials | Served from `src/data/static-api.json`, which is generated from the API |
| Bookings, guide requests, contact form | Become a pre-filled WhatsApp or email message the guest sends. Set the address and number in `travago-tour-app/.env.static` |
| Shared trips | The trip is compressed into the link itself (no database). Calendar export is built in the browser |
| Weather, sea, EUR→ALL, road shapes | Fetched by the browser from the same free APIs, with typical values as the fallback |
| Guest accounts, PayPal, bank-transfer checkout, Host desk | Need the Python app (database and secret keys). The sign-in button is hidden |
| Card payments, AI concierge, Google ratings | Need the Python app (they use secret keys) |

The frontend decides at runtime: if `/api/meta/health` answers, it uses the server; otherwise it uses the built-in engines. `npm run build:static` skips that check.

After changing anything in `app/data/` or the engines, regenerate the static bundle with `python scripts/export_static.py`. `tests/test_static_export.py` fails while it's stale.

## Deploying to cPanel

The site runs as one **cPanel "Setup Python App"** (Passenger) at the domain root. Flask serves both the website and `/api`.

**First time**
1. **Create the app** in cPanel → Setup Python App:

   | Field | Value |
   |---|---|
   | Python | 3.10+ |
   | Application root | `megrooms_flask` |
   | URL | your domain, empty path |
   | Startup file | `wsgi.py` |
   | Entry point | `app` |

2. **Create `/home/<user>/megrooms_flask/.env`** (see `.env.example`). With SQLite, use:
   ```
   FLASK_ENV=production
   SECRET_KEY=<long random string>
   DATABASE_URL=sqlite:////home/<user>/megrooms_flask/instance/saranda.db
   CORS_ORIGINS=https://yourdomain
   ```
   Leave `SCHEMA` unset unless you use PostgreSQL.
3. **Connect the repository** in cPanel → Git Version Control, then click **Deploy HEAD Commit**.
4. **Seed the database once**, from cPanel → Terminal inside the app's virtualenv: `flask seed all`. (It refuses to run on a database that already has data, so it can't wipe real bookings.)
5. **Remove the old site files from `public_html`**, but keep its `.htaccess`, which connects the domain to the app.

**Every update:** in Git Version Control, click **Update from Remote**, then **Deploy HEAD Commit**. `deploy/cpanel_deploy.sh` then:
- syncs the backend (never touching `.env` or the database);
- installs packages and runs migrations;
- restarts the app.

It builds the frontend only if the server has Node.js 20.19+/22.12+. Otherwise it keeps the current build: run `npm ci && npm run build` locally and upload `travago-tour-app/build/` to `megrooms_flask/travago-tour-app/build/`.

The account paths are set at the top of `deploy/cpanel_deploy.sh`: `CPANEL_USER`, `APP_ROOT` and `VENV_BASE`.

## Accounts and payments

Both need the Python app (they use the database and secret keys); the static upload shows neither.

**Guest accounts** work out of the box. To finish the setup in `.env`:
1. Set `PUBLIC_BASE_URL=https://yourdomain`. Links in emails are built only from this, never from the request.
2. Add a mailbox for outgoing mail (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`; cPanel → Email Accounts → Connect Devices shows the values). Without it sign-up still works, but verification and password-reset emails aren't sent.
3. Make yourself a host. Either put your address in `ADMIN_EMAILS` and confirm it by email, or run `flask users create-host you@example.com` in the cPanel terminal. The **Host desk** then appears under *My account*.

**Payments for a business in Albania.** Stripe doesn't open accounts for Albanian businesses, so the site offers:

| Method | Good for | What you set | Cost |
|---|---|---|---|
| PayPal (balance, or card as a PayPal guest) | Guests anywhere, including the USA | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV=live` | PayPal's fee per payment |
| Bank transfer with a SEPA QR code | European guests (Albania is in SEPA); SWIFT from elsewhere | `BANK_BENEFICIARY`, `BANK_IBAN`, `BANK_BIC` | Free to offer |
| Request to book, pay on arrival | Fallback when nothing is configured | nothing | Free |

- Test PayPal in `sandbox` first, then make one small live payment to confirm that your PayPal account can receive and withdraw. If it only settles in dollars, set `PAYPAL_CURRENCY=USD`; guests are then charged the dollar equivalent at the day's rate.
- Add the webhook `https://yourdomain/api/webhooks/paypal` (Payment capture events) in the PayPal app.
- `PAYMENT_DEPOSIT_PERCENT=30` takes a 30% deposit now and shows the balance as due on arrival.
- For a bank transfer the guest sees your IBAN, the exact amount and the booking reference. Dates are held for 48 hours, or 5 days once the guest reports the transfer. You press **Money received** in the Host desk when it lands.
- Stripe remains in the code for a business registered in the EU or USA.

## Free mode (current default)

Out of the box the site uses only free services and needs no API keys:

| Service | Used for | Terms to keep in mind |
|---|---|---|
| Open-Meteo | Weather, sea temperature | Free tier is non-commercial; move to their paid plan before a commercial launch (or set `LIVE_DATA_ENABLED=false`) |
| ExchangeRate-API (open feed) | EUR → ALL rate | Free with the attribution link shown on the site |
| OpenStreetMap tiles | Maps | Free with attribution; light use per the OSM tile policy |
| OSRM public server | Road shapes | Free demo server for light use; self-host for production |
| Google Fonts | Typography | Free |

Stripe, the Anthropic concierge and Google Places stay switched off until their keys are added. The site falls back to request-to-book, the built-in answer engine, and no ratings. To add them later, fill in the "PAID services" block in `.env`.

## Media and licences

- **Video clips** are from Wikimedia Commons under **CC BY-SA 4.0** (authors Ekki3, Arianit and Leeturtle; Lëkurës and Gjirokastër clips by A.jobs02 are added when present). `scripts/edit_videos.py` trims them, applies the colour grade, turns them into seamless loops, removes the audio and builds the reel. Run `python scripts/edit_videos.py <folder with the originals>` (needs ffmpeg). The script is the record of what was changed, and the edited clips are shared under the same licence. Credits are shown on each clip and on `/credits`.
- **YouTube films** play in YouTube's own player (youtube-nocookie.com), loaded only when the guest presses play. Rights stay with their creators.
- **The old hero video** (`saranda-hero.mp4`) was a stock-site preview with a watermark, so it has been removed. Re-add your own or licensed footage if you want a video hero.
- **3D atlas.** Borders come from Natural Earth (public domain, via `world-atlas`). The relief is a stylised model of Albania's ranges, not survey data. Regenerate it with `npm run atlas`.

## Configuration

Everything is set through environment variables; see `.env.example`. None of these are required to run the site:

| Feature | Variables | Without them |
|---|---|---|
| Guest accounts | `PUBLIC_BASE_URL`, `SMTP_*`, `ADMIN_EMAILS` | Sign-up works; no verification or reset emails |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV`, `PAYPAL_CURRENCY` | Not offered |
| Bank transfer | `BANK_BENEFICIARY`, `BANK_IBAN`, `BANK_BIC`, `BANK_NAME` | Not offered |
| Card payments (EU/US businesses only) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Not offered |
| AI concierge | `ANTHROPIC_API_KEY` (`CONCIERGE_MODEL`, default `claude-opus-5-5`) | Built-in answer engine |
| Google ratings/hours | `GOOGLE_MAPS_API_KEY` (Places API New; restrict it to your server) | Hidden |
| Road geometry | `OSRM_URL` (self-host for production traffic) | Straight segments |
| Affiliate links | `BOOKING_AFFILIATE_ID`, `GYG_PARTNER_ID`, `VIATOR_PARTNER_ID` | Plain search links |
| Admin API with Clerk tokens | `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES`, `ADMIN_USER_IDS` | Use a host account instead |

Point the Stripe webhook at `POST /api/webhooks/stripe` and subscribe it to `payment_intent.succeeded`, `payment_intent.processing` and `payment_intent.canceled`.

## Security model

- **Payments.** Prices are always computed on the server from the stay's nightly rate; the browser never sends an amount.
  - PayPal uses a redirect, so no PayPal script runs on the site. A booking is confirmed only after the server captures the order and PayPal reports a completed capture for the expected reference, amount and currency. Webhooks are verified with PayPal before use, and guests are only ever redirected to paypal.com.
  - Bank transfers are confirmed by the host. Stripe bookings are confirmed by a signed webhook or a server-side status check.
  - Overlapping dates are rejected and unpaid holds expire. A hold that ran out is only charged if the dates are still free.
- **Accounts.**
  - Passwords are stored as salted scrypt hashes (N=2¹⁵, r=8, p=3). They must be at least 10 characters, and common or breached passwords are refused (only 5 characters of a SHA-1 hash leave the server).
  - Sessions are random 256-bit tokens in an `HttpOnly`, `SameSite=Lax`, `__Host-` cookie; only their SHA-256 digests are stored, so they can be revoked (sign out everywhere, password change, reset).
  - Failed sign-ins are throttled per address whether or not it exists, with a dummy hash check for unknown addresses, so responses and timing don't reveal accounts. Password-reset requests always answer the same way. Sign-up does say when an address is already registered; it is rate-limited.
  - Verification and reset links are single-use, short-lived, stored hashed and built only from `PUBLIC_BASE_URL`.
  - An account sees bookings made earlier with its address only after that address is verified.
  - State-changing requests from other sites are rejected (`Origin` / `Sec-Fetch-Site` checks on top of SameSite and JSON-only writes).
  - Hosts are verified, allow-listed addresses or accounts created from the server's terminal, and host sessions last 12 hours.
- **No enumerable IDs.** Bookings and guide requests use unguessable 60-bit references, and public reads mask contact details. Shared trips have a public share id plus a secret edit key, which is stored hashed and compared in constant time.
- **Request hardening.** CORS is allow-listed, writes must be JSON (which blocks cross-site form CSRF), bodies are capped at 256 KB, every write is validated against a declared schema, and bot-facing forms have honeypots. Rate limits apply per IP, with stricter ones on booking, contact, trip-saving and concierge endpoints.
- **Headers.** Strict CSP (Stripe, map tiles and the YouTube player only; the static build also allows the browser's calls to the free weather, rates and routing APIs), HSTS, `X-Frame-Options: DENY`, `nosniff`, a restrictive `Permissions-Policy` and COOP. The same set is applied in `.htaccess` for the static host.
- **Outbound calls.** HTTPS only, to an explicit host allowlist (an SSRF guard), with timeouts, size caps and negative caching.
- **Admin authentication.** Clerk RS256 JWTs are verified against JWKS with issuer, expiry and authorized-party checks, and admins come from an allow-list.
- **Concierge.** Tools are read-only, conversation length is capped, and model output is rendered by a markdown renderer that allows no raw HTML and same-site links only.
- **Production mode.** Startup fails without `SECRET_KEY`, the route map is hidden, and `X-Forwarded-Host` is ignored.

## Content notes

- The guide profiles in `app/seeds/guides.py` are **samples**, labelled "Sample profile" in the UI and seeded with no ratings or reviews. Replace them with real, vetted guides through `POST /api/admin/guides` before launch.
- Rental cars and experiences are sample seed data too.
- Distances, times and prices are planning estimates. Legs from the planner are labelled "Planner data" and everything else "Estimate". Ferry schedules are never shown as fixed; the site always tells travellers to check the operator.
- Update `app/data/` each season: ferry notes, budget ranges and attraction details (see `LAST_REVIEWED` in `app/data/essentials.py`).
