# Going live on Namecheap (cPanel)

A checklist for taking Saranda Companion from "works" to "taking real bookings". Do the steps in order; each one says where to click. Nothing here costs money except where it says so.

> **Keep secrets out of chat and email.** Passwords and API keys go only into the `.env` file on the server (cPanel → File Manager). Never paste them into a chat, an email, a GitHub issue or the repository.

You need the full Python app for accounts and payments. If you only want the information site with booking requests by email or WhatsApp, the static upload in the README is enough; skip to step 2, then follow "Hosting on Namecheap without Python" in the README.

---

## 1. Before you start

| You need | Where | Cost |
|---|---|---|
| Namecheap hosting with cPanel and a domain | You have this | — |
| HTTPS certificate | cPanel → **SSL/TLS Status** → *Run AutoSSL* (usually already on) | Free |
| A mailbox for the site, e.g. `bookings@yourdomain` | cPanel → **Email Accounts** | Included |
| Your bank account's IBAN and BIC (for bank transfers) | Your bank | Free to offer |
| A PayPal **Business** account (optional, for card/PayPal payments) | paypal.com | PayPal's fee per payment |

## 2. Fill in your business details

Open `travago-tour-app/src/data/business.json` and fill in:

- `legal_name`: the registered name of your business.
- `nipt`: your NIPT (tax number).
- `email` and `phone`: the contact details guests should use.
- `check_in_from` and `check_out_by`: for example `"14:00"` and `"11:00"`.
- `cancellation`: the refund rules. The defaults are a full refund 14+ days before check-in, 50% at 7–13 days, and nothing within 7 days. With the Python app, the rules guests are actually held to come from `CANCEL_FULL_REFUND_DAYS`, `CANCEL_PARTIAL_REFUND_DAYS` and `CANCEL_PARTIAL_REFUND_PERCENT` in `.env` (step 5); keep both the same.

These details appear on **/privacy** and **/terms**. Empty fields are just left off. The pages are written to match what the site really does, but they aren't legal advice: have a local lawyer or accountant read both once. Both pages are also shown in Albanian, French, Italian and German, and say that the English version applies; if your lawyer changes a sentence, its translations in `travago-tour-app/src/i18n/legal.js` need the same change (the tests name each one).

## 3. Create the Python app

cPanel → **Setup Python App** → *Create Application*:

| Field | Value |
|---|---|
| Python version | 3.11 or newer (pick the newest offered; 3.10 can't install the photo library) |
| Application root | `megrooms_flask` |
| Application URL | your domain, path left empty |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

Click **Create**. (The repository has its own `passenger_wsgi.py`, and every deploy copies it over the placeholder cPanel creates. Don't use `wsgi.py` / `app` here: the wrapper cPanel writes for those uses a module that Python 3.12 removed.) At the top of the app's page, cPanel shows a command like `source /home/<user>/virtualenv/megrooms_flask/3.11/bin/activate && cd /home/<user>/megrooms_flask`. Copy it; steps 7 and 11 use it.

**Check the server is new enough.** cPanel → **Terminal**, run `ldd --version`. The first line ends with a version number, which must be **2.28 or higher** (for example `ldd (GNU libc) 2.28`). The photo library (Pillow) only installs ready-made on those servers. If it shows 2.17, ask Namecheap support to move your account to a CloudLinux 8 server before deploying.

## 4. Create the mailbox

1. cPanel → **Email Accounts** → *Create*: `bookings@yourdomain`, with a strong password.
2. Click **Connect Devices** next to it. Under *Secure SSL/TLS Settings* note the **Outgoing Server** and the port (465).
3. cPanel → **Email Deliverability** → if SPF or DKIM shows a problem, click **Repair**. Without this, sign-up and booking emails land in spam.

## 5. Create the `.env` file (your settings and secrets)

1. cPanel → **Terminal**, and create a secret key:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```
2. cPanel → **File Manager** → open `megrooms_flask` → **+ File** → name it `.env` → right-click → **Edit**. (Turn on *Settings → Show Hidden Files* to see it later.)
3. Paste this and fill in your values (`<user>` is your cPanel username):
   ```ini
   FLASK_ENV=production
   SECRET_KEY=<the long random value from step 1>
   DATABASE_URL=sqlite:////home/<user>/megrooms_flask/instance/saranda.db
   PUBLIC_BASE_URL=https://yourdomain
   CORS_ORIGINS=https://yourdomain
   CONTACT_EMAIL=bookings@yourdomain
   WHATSAPP_NUMBER=+3556XXXXXXXX

   # Email (values from step 4)
   SMTP_HOST=<outgoing server>
   SMTP_PORT=465
   SMTP_USER=bookings@yourdomain
   SMTP_PASSWORD=<the mailbox password>
   SMTP_FROM=bookings@yourdomain

   # Open-Meteo's free plan is for non-commercial use. Leave this false until you
   # buy their commercial plan; the site then shows typical-season figures.
   LIVE_DATA_ENABLED=false

   # Backups are encrypted with this. Make a second long random value as in step 1,
   # and keep a copy somewhere safe OFF the server: without it no backup can be opened.
   BACKUP_PASSPHRASE=<another long random value>

   # Host accounts must use two-step sign-in (an authenticator app on your phone).
   REQUIRE_TWO_STEP_FOR_HOSTS=true

   # Your cancellation rules (the same as in business.json, step 2).
   CANCEL_FULL_REFUND_DAYS=14
   CANCEL_PARTIAL_REFUND_DAYS=7
   CANCEL_PARTIAL_REFUND_PERCENT=50
   ```
4. Save. Right-click `.env` → **Change Permissions** → `600` (only you can read it).

> **Never change `SECRET_KEY` after launch.** Sign-ins, email links and the two-step sign-in secrets depend on it. If it changes, everyone is signed out and nobody who uses two-step sign-in can sign in until you reset it for them (`flask --app app users disable-two-step their@email`).

Payments are added in step 9. Leave them out for now, and the site takes "request to book, pay on arrival" bookings.

## 6. Put the code on the server

1. cPanel → **Git Version Control** → *Create*:
   - Clone URL: `https://github.com/stroud91/saranda_web.git`
   - Repository path: `repositories/saranda_web`
   - If the repository is private, first create an SSH key (cPanel → **SSH Access** → *Manage SSH Keys*) and add its public key to GitHub → the repository → *Settings* → *Deploy keys* (read-only). Then use the SSH clone URL.
2. Open the repository → **Pull or Deploy** → **Deploy HEAD Commit**. This copies the code into `megrooms_flask`, installs packages, sets up the database tables and restarts the app.
3. The website itself (the frontend) is built only if the server has Node.js 20.19 or newer. If the deploy log says *no frontend installed yet*, build it on your computer and upload it:
   ```bash
   cd travago-tour-app && npm ci && npm run build
   ```
   Zip the `build` folder, upload it to `megrooms_flask/travago-tour-app/` in File Manager (the deploy creates that folder), and **Extract** it there. You should then have `megrooms_flask/travago-tour-app/build/index.html`.
4. Clear out the old site in `public_html` (turn on *Settings → Show Hidden Files* in File Manager):
   - Delete the old site's files and folders (`index.html`, `assets`, `media` and the rest).
   - **Edit `.htaccess`, don't keep it as it is.** Keep only the block cPanel added when you created the app, from `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN` to `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END`, and delete every other line. If you uploaded the static site before, the rest of that file answers every `/api/` address with "not found", so the site would open but quietly as the static version, with no accounts, bookings or payments. The app itself now does the HTTPS redirect and security headers those lines used to add.
   - Before editing, right-click `.htaccess` → **Copy** and name the copy `.htaccess.bak`, so you can go back. If the file has no Passenger block at all, don't write one by hand: ask Namecheap support to repair the Python app's `.htaccess`.

   Every deploy warns in its log if the old static rules are still in `public_html/.htaccess`.

## 7. Set up the database and your host account

In cPanel → **Terminal**, paste the `source …/activate` command from step 3, then:

```bash
cd ~/megrooms_flask
flask --app app db upgrade                         # safe to repeat
flask --app app seed all                           # first time only; refuses if data exists
flask --app app users create-host bookings@yourdomain --name "Your name"
```

The last command asks for a password twice. Sign in on the site with that email and password. Because `REQUIRE_TWO_STEP_FOR_HOSTS=true`, the site first asks you to switch on two-step sign-in:

1. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password or Aegis).
2. *My account → Security → Two-step sign-in → Set it up*, type your password, scan the QR code and type the 6-digit code.
3. Write down or print the ten recovery codes it shows, and keep them away from your phone. Each one lets you in once if the phone is lost.

**My account → Host desk** then opens. That's where you see and confirm bookings, guide requests and messages, send refunds, answer reviews and see your visitor numbers.

## 8. First check

Setup Python App → **Restart**, then open these:

- `https://yourdomain/api/meta/health` should say `"status": "ok"`.
- The home page loads with a padlock, and `http://yourdomain` redirects to `https://`.
- **Sign up** with a personal email: the confirmation email arrives (check spam). **Forgot password** sends a link.
- **/privacy** and **/terms** show your business details.
- **/guides** says guides are on their way. The sample profiles stay hidden from guests (see step 10).
- `https://yourdomain/sitemap.xml` lists your pages with your domain, and `https://yourdomain/robots.txt` points to it.
- Open the site with `?lang=sq` at the end of the address: it switches to Albanian, and so do **/privacy** and **/terms**.

## 9. Payments

Restart the app (Setup Python App → **Restart**) after each change to `.env`.

### Bank transfer (free, best for European guests)

Add to `.env`:
```ini
BANK_BENEFICIARY=<name on the account>
BANK_IBAN=<your IBAN>
BANK_BIC=<your bank's BIC/SWIFT code>
BANK_NAME=<your bank>
```
The guest sees your details, the exact amount, the booking reference and a QR code that European banking apps can scan. Dates are held for 48 hours, or 5 days once the guest says the money is on its way (`BANK_HOLD_HOURS`, `BANK_CLAIM_HOLD_DAYS`). When it reaches your account, press **Money received** in the Host desk.

### PayPal (guests anywhere pay by PayPal, or by card without a PayPal account)

1. Go to **developer.paypal.com** and log in with your PayPal Business account → **Apps & Credentials**.
2. **Test first (Sandbox).** Turn the *Sandbox* switch on → **Create App** → copy the *Client ID* and *Secret* into `.env`:
   ```ini
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=<client id>
   PAYPAL_CLIENT_SECRET=<secret>
   ```
3. In the same app → **Add Webhook** → URL `https://yourdomain/api/webhooks/paypal` → tick the **Payment capture** events (completed, denied, pending, refunded, reversed) → save, and copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID=`.
4. Restart, and book a stay with a sandbox *personal* test account (under *Testing Tools → Sandbox Accounts*). The booking should turn **confirmed**.
5. **Go live.** Switch to *Live*, then create a live app and a live webhook the same way. Put the live keys and webhook ID in `.env` with `PAYPAL_ENV=live`.
6. Make **one small real booking** with your own card. Check that the money shows in PayPal and that you can withdraw it to your Albanian bank. Then refund it in PayPal and cancel it in the Host desk.
7. If your PayPal account only holds US dollars, set `PAYPAL_CURRENCY=USD`. Guests are then charged the dollar equivalent at the day's rate.

### Deposits

`PAYMENT_DEPOSIT_PERCENT=30` takes 30% when booking; the rest is shown as due on arrival. The booking terms update automatically.

### Refunds

When a guest cancels on their booking page, they see what they'll get back under your rules, and the booking appears in **Host desk → Needs you** as *Refund due*. Nothing is paid back until you press a button:

- Paid by PayPal or card: **Refund … via PayPal** (or **to the card**) sends it through the provider straight away.
- Paid by bank transfer: send the money back from your bank, then press **I've paid it back**.

The guest is emailed either way, and the hourly check reminds you of refunds still due after three days. The booking terms promise refunds within 14 days.

## 10. Content to replace before launch

You do all of this yourself in **My account → Host desk → Your listings**. Changes show on the site as soon as you press Save.

- **Apartments.** Press **Edit** on each one. Check the name, description, price and guest numbers, then press **Add photos** and pick 5–12 photos from your phone or computer. Put the best one first with the arrows; it is the cover on the /stays cards.
- **Tours and rental cars** on /experiences are sample data. Edit them into your real offers, **Pause** the ones you don't offer, or **Remove** them.
- **Guides.** The eight seeded guide profiles are samples, and guests don't see them. Press **Add a guide** for each real guide, or edit a sample into a real person and untick *Sample profile*. The guide pages and links appear by themselves once one real guide exists. `SHOW_SAMPLE_GUIDES=true` shows the samples again, for demos only.

### Stop double bookings (Airbnb, Booking.com)

If an apartment is also listed on another site, connect the two calendars so a night sold on one is blocked on the other. Do this for each apartment, in **Your listings → Calendar**:

1. **Bring the other site's bookings here.** On Airbnb: *Calendar → Availability → Connect calendars → Export calendar*, and copy the link. On Booking.com: *Calendar → Sync calendars → Export calendar*. Paste the link under **Connect a calendar**, choose the site and press **Connect**. Its reserved nights turn orange in the calendar.
2. **Send this site's bookings there.** Under the site you just connected, press **Copy the link to paste into Airbnb** (or Booking.com). On that site, choose *Import calendar* and paste it.
3. Add the cron job in step 11 so the calendars are checked every 30 minutes.

For anything else (repairs, family visiting, a booking taken by phone), use **Block nights** in the same screen.

Other sites read our link every few hours, not instantly. After a last-minute booking here, block the same nights on the other site by hand, and the other way round.

### Local businesses (the business portal)

Other businesses can list their own apartments, rentals and activities at `https://yourdomain/business`. Nothing they add is visible until you approve it:

1. You get an email each time something is waiting ("Review needed").
2. Open **My account → Host desk → Partners**. Read what was submitted, then **Approve** or **Ask for changes** (your note is emailed to them).
3. To remove a business later, press **Take offline** next to it.

Each business can also style its own page (background, colours, header picture) under **Page style** in its dashboard. The choices come from fixed lists, so they need no review.

Businesses can add photos and manage a calendar for each of their stays, the same way you do. New photos show in the review queue as small pictures; click one to see it full size before you approve.

Guests book and pay those businesses directly; no money for them passes through your PayPal or bank account. Read the "Listings from local businesses" section on **/terms** and adjust it with your lawyer if you want different rules. To switch the whole feature off, put `PARTNERS_ENABLED=false` in `.env`.

## 11. Scheduled jobs: clean-up, backups and alerts

Four jobs keep the site healthy. Add each one in cPanel → **Cron Jobs**. Each command needs the full path of the app's `flask`: take the command from step 3, keep only the path that ends in `/bin/activate` (drop `source ` before it and `&& cd …` after it), and change `activate` to `flask`, for example `/home/<user>/virtualenv/megrooms_flask/3.11/bin/flask`. Below, `FLASK` stands for that path and `<user>` for your cPanel username.

| How often | Cron setting | Command |
|---|---|---|
| Once a day | `15 3 * * *` | `cd /home/<user>/megrooms_flask && FLASK --app app users cleanup >/dev/null 2>&1` |
| Once a day | `45 3 * * *` | `cd /home/<user>/megrooms_flask && FLASK --app app backup run >/dev/null 2>&1` |
| Every hour | `20 * * * *` | `cd /home/<user>/megrooms_flask && FLASK --app app monitor check --quiet >/dev/null 2>&1` |
| Twice an hour | `0,30 * * * *` | `cd /home/<user>/megrooms_flask && FLASK --app app calendars sync >/dev/null 2>&1` |

- **Clean-up** removes expired sign-ins and email links, photos that were uploaded but never used, yesterday's visitor codes, and contact messages, questions to partner businesses and unconfirmed guide requests older than 24 months, as the privacy policy promises (`MESSAGE_RETENTION_MONTHS`). It also emails guests whose stay ended yesterday a link to review it.
- **Backup** saves the database every day and the photos when they changed, encrypted with `BACKUP_PASSPHRASE`, in `megrooms_flask/instance/backups/`. It keeps one per day for a week, one per week for a month and one per month for six months, and deletes the rest.
- **Check** emails you (at `CONTACT_EMAIL`, or `ALERT_EMAIL` if you set it) when something needs you: a failed or missing backup, a connected calendar that stopped updating, low disk space, mail that stopped working, the site not answering or its certificate about to run out, booking requests waiting more than a day, refunds not sent. You get one email, a reminder each day while it lasts, and a note when it's solved. The same list shows at the top of the Host desk. Errors on the site are emailed as they happen, at most one an hour.
- **Calendars** re-reads the calendars you connected from Airbnb, Booking.com and others. Skip it if no apartment is connected to another site.

Then, in the terminal (after the `source …/activate` command):
```bash
cd ~/megrooms_flask
flask --app app backup run        # the first backup, now
flask --app app backup verify     # opens it and checks it: "… is good"
flask --app app monitor test      # a test alert: check that it arrives
flask --app app monitor check     # should end with "All good: nothing needs you."
```

**Keep a copy off the server.** A backup on the same server is lost with the server. Do at least one of these:

- Once a month, download the newest `data-….tar.gz.enc` (and `photos-….tar.gz.enc` after adding photos) from `megrooms_flask/instance/backups/` in File Manager, and keep them with your passphrase.
- Or set `BACKUP_UPLOAD_URL` to a WebDAV folder at a storage provider (many offer one, for example Koofr, pCloud or Hetzner Storage Box), with `BACKUP_UPLOAD_USER` and `BACKUP_UPLOAD_PASSWORD`. Each backup is then copied there automatically, encrypted.
- cPanel → **Backup** or **JetBackup**, if your plan has it, covers the whole account as well.

Keep `megrooms_flask/.env` somewhere safe too: it holds your keys, and the backups don't include it.

**Know when the server itself is down.** The alerts above come from the server, so they can't tell you when it's off. Create a free check at healthchecks.io (or a similar service) set to "every hour", and put its address in `.env` as `ALERT_HEARTBEAT_URL=https://hc-ping.com/…`. The service then emails you if the hourly check stops arriving or reports a problem.

**Restoring.** `flask --app app backup list` shows the backups. `flask --app app backup restore data-<date>.tar.gz.enc` puts the database back: it first saves the current one as a new backup, so this can be undone. Then run `flask --app app db upgrade` and press **Restart** in Setup Python App. `backup restore photos-<date>.tar.gz.enc` copies back photos that are missing.

## 12. Search engines

1. Go to search.google.com/search-console, add your domain and confirm it (the *HTML tag* or *DNS* method; cPanel → **Zone Editor** for DNS).
2. Under *Sitemaps*, submit `https://yourdomain/sitemap.xml`.
3. Do the same at bing.com/webmasters if you like; it can import the site from Search Console.

Each page already has its own title, description and preview image in every language, and your apartments show their price and review rating to search engines. Reviews start arriving the day after your first guests check out.

## 13. Optional extras (paid, off until you add keys)

| Extra | Setting | Cost |
|---|---|---|
| Live weather and sea temperature for a business | Open-Meteo commercial plan, then `LIVE_DATA_ENABLED=true` | Monthly plan |
| AI concierge | `ANTHROPIC_API_KEY` | Per message |
| Google ratings and opening hours | `GOOGLE_MAPS_API_KEY` (Places API, restricted to your server) | Per request |
| Affiliate links for tours and hotels elsewhere | `BOOKING_AFFILIATE_ID`, `GYG_PARTNER_ID`, `VIATOR_PARTNER_ID` | Free; you earn commission |

## Every update after this

cPanel → **Git Version Control** → your repository → **Update from Remote**, then **Deploy HEAD Commit**. Your `.env` and database are never touched by a deploy.
