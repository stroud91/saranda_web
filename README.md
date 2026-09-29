# Saranda Companion · Meg'Rooms

An app-like travel companion for Albania, built around *The Ultimate Albania Travel Planner 2027* and run from Meg'Rooms' apartments in Sarandë. Travellers can:

- **Connect any two places.** The app finds the fastest chain of roads, ferries and boats and shows distance and time ranges, noting which figures come from the planner and which are estimates.
- **Get day timelines.** Each day becomes a clock-time schedule (drives, visits, a lunch break) with warnings: long driving days, a major sight at the end of a long drive, peak-season heat and crowds, and sea conditions.
- **Plan a whole trip.** Start from the 7-, 10- or 14-day itineraries or from nothing. Reorder stops by dragging, see every day on a map, estimate the budget, tick off the packing list, then save and share a link or export to a calendar (`.ics`).
- **Pick a local guide.** Filter guides by language, speciality, vehicle and group size, check their availability calendar and send a request. The price is quoted server-side and nothing is charged until the guide confirms.
- **Book a stay.** Meg'Rooms apartments have an availability calendar and a live server-side quote. Checkout uses Stripe when it's configured and falls back to request-to-book when it isn't.
- **Ask the concierge.** Claude answers using read-only tools over the planner data. Without an API key, a built-in answer engine handles the common questions.
- **Check live data.** Weather and sea temperature (Open-Meteo), EUR→ALL rates, optional Google Places ratings, OSRM road geometry, and pre-filled searches on Booking.com, Airbnb, Google Hotels, GetYourGuide, Viator and Rentalcars.

The design uses a Mediterranean palette (Ionian blues, Ksamil turquoise, sand, terracotta, sun, olive, bougainvillea) with light and dark themes. Every destination gets a procedurally drawn, animated SVG postcard, so the site needs no licensed photos. It has a glass top bar, a mobile bottom tab bar, bottom sheets, page transitions and is installable as a PWA.

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
tests/                  pytest suite (engines, API, live providers, Claude loop, prod hardening)
travago-tour-app/       React 19 + Vite frontend (builds to travago-tour-app/build)
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
4. **Seed the database once**, from cPanel → Terminal inside the app's virtualenv: `flask seed all`.
5. **Remove the old site files from `public_html`**, but keep its `.htaccess`, which connects the domain to the app.

**Every update:** in Git Version Control, click **Update from Remote**, then **Deploy HEAD Commit**. `deploy/cpanel_deploy.sh` then:
- syncs the backend (never touching `.env` or the database);
- installs packages and runs migrations;
- restarts the app.

It builds the frontend only if the server has Node.js 20.19+/22.12+. Otherwise it keeps the current build: run `npm ci && npm run build` locally and upload `travago-tour-app/build/` to `megrooms_flask/travago-tour-app/build/`.

The account paths are set at the top of `deploy/cpanel_deploy.sh`: `CPANEL_USER`, `APP_ROOT` and `VENV_BASE`.

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

## Configuration

Everything is set through environment variables; see `.env.example`. None of these are required to run the site:

| Feature | Variables | Without them |
|---|---|---|
| Card payments | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Request-to-book (the host confirms) |
| AI concierge | `ANTHROPIC_API_KEY` (`CONCIERGE_MODEL`, default `claude-opus-5-5`) | Built-in answer engine |
| Google ratings/hours | `GOOGLE_MAPS_API_KEY` (Places API New; restrict it to your server) | Hidden |
| Road geometry | `OSRM_URL` (self-host for production traffic) | Straight segments |
| Affiliate links | `BOOKING_AFFILIATE_ID`, `GYG_PARTNER_ID`, `VIATOR_PARTNER_ID` | Plain search links |
| Admin API | `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES`, `ADMIN_USER_IDS` / `ADMIN_EMAILS` | Admin endpoints return 503 |

Point the Stripe webhook at `POST /api/webhooks/stripe` and subscribe it to `payment_intent.succeeded`, `payment_intent.processing` and `payment_intent.canceled`.

## Security model

- **Payments.** Prices are always computed on the server from the stay's nightly rate. Bookings are confirmed only by a signed Stripe webhook or a server-side status check. Overlapping dates are rejected, and unpaid holds expire after 30 minutes.
- **No enumerable IDs.** Bookings and guide requests use unguessable 60-bit references, and public reads mask contact details. Shared trips have a public share id plus a secret edit key, which is stored hashed and compared in constant time.
- **Request hardening.** CORS is allow-listed, writes must be JSON (which blocks cross-site form CSRF), bodies are capped at 256 KB, every write is validated against a declared schema, and bot-facing forms have honeypots. Rate limits apply per IP, with stricter ones on booking, contact, trip-saving and concierge endpoints.
- **Headers.** Strict CSP (Stripe and map tiles only), HSTS, `X-Frame-Options: DENY`, `nosniff`, a restrictive `Permissions-Policy` and COOP. The same set is applied in `.htaccess` for the static host.
- **Outbound calls.** HTTPS only, to an explicit host allowlist (an SSRF guard), with timeouts, size caps and negative caching.
- **Admin authentication.** Clerk RS256 JWTs are verified against JWKS with issuer, expiry and authorized-party checks, and admins come from an allow-list.
- **Concierge.** Tools are read-only, conversation length is capped, and model output is rendered by a markdown renderer that allows no raw HTML and same-site links only.
- **Production mode.** Startup fails without `SECRET_KEY`, the route map is hidden, and `X-Forwarded-Host` is ignored.

## Content notes

- The guide profiles in `app/seeds/guides.py` are **samples**, labelled "Sample profile" in the UI and seeded with no ratings or reviews. Replace them with real, vetted guides through `POST /api/admin/guides` before launch.
- Rental cars and experiences are sample seed data too.
- Distances, times and prices are planning estimates. Legs from the planner are labelled "Planner data" and everything else "Estimate". Ferry schedules are never shown as fixed; the site always tells travellers to check the operator.
- Update `app/data/` each season: ferry notes, budget ranges and attraction details (see `LAST_REVIEWED` in `app/data/essentials.py`).
