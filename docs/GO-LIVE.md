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
- `cancellation`: the refund rules. The defaults are a full refund 14+ days before check-in, 50% at 7–13 days, and nothing within 7 days.

These details appear on **/privacy** and **/terms**. Empty fields are just left off. The pages are written to match what the site really does, but they aren't legal advice: have a local lawyer or accountant read both once.

## 3. Create the Python app

cPanel → **Setup Python App** → *Create Application*:

| Field | Value |
|---|---|
| Python version | 3.10 or newer (the newest offered) |
| Application root | `megrooms_flask` |
| Application URL | your domain, path left empty |
| Application startup file | `wsgi.py` |
| Application Entry point | `app` |

Click **Create**. At the top of the app's page, cPanel shows a command that starts with `source /home/…/virtualenv/megrooms_flask/…/bin/activate`. Copy it; steps 6, 7 and 11 use it.

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
   ```
4. Save. Right-click `.env` → **Change Permissions** → `600` (only you can read it).

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
   Zip the `build` folder, upload it to `megrooms_flask/travago-tour-app/` in File Manager, and **Extract** it there.
4. Clear out the old site: in `public_html`, delete the old site files but **keep `.htaccess`**, which connects the domain to the app.

## 7. Set up the database and your host account

In cPanel → **Terminal**, paste the `source …/activate` command from step 3, then:

```bash
cd ~/megrooms_flask
flask --app app db upgrade                         # safe to repeat
flask --app app seed all                           # first time only; refuses if data exists
flask --app app users create-host bookings@yourdomain --name "Your name"
```

The last command asks for a password twice. Sign in on the site with that email and password, and **My account → Host desk** appears. That's where you see and confirm bookings, guide requests and messages.

## 8. First check

Setup Python App → **Restart**, then open these:

- `https://yourdomain/api/meta/health` should say `"status": "ok"`.
- The home page loads with a padlock, and `http://yourdomain` redirects to `https://`.
- **Sign up** with a personal email: the confirmation email arrives (check spam). **Forgot password** sends a link.
- **/privacy** and **/terms** show your business details.
- **/guides** says guides are on their way. The sample profiles stay hidden from guests (see step 10).

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

## 11. Daily clean-up and backups

**Cron job.** cPanel → **Cron Jobs** → *Once Per Day*. Take the `source …/bin/activate` command from step 3, drop `source ` from the front and change `activate` at the end to `flask`. That gives the full path of the app's `flask`, for example `/home/<user>/virtualenv/megrooms_flask/3.11/bin/flask`. The command is then:
```bash
cd /home/<user>/megrooms_flask && /home/<user>/virtualenv/megrooms_flask/3.11/bin/flask --app app users cleanup >/dev/null 2>&1
```
It removes expired sign-ins and email links, and photos that were uploaded but never used. It also removes contact messages, questions sent to partner businesses and unconfirmed guide requests older than 24 months, as the privacy policy promises (`MESSAGE_RETENTION_MONTHS`).

**Calendar cron job.** Add a second one with *Twice Per Hour* (`0,30 * * * *`). It re-reads the calendars you connected from Airbnb, Booking.com and others:
```bash
cd /home/<user>/megrooms_flask && /home/<user>/virtualenv/megrooms_flask/3.11/bin/flask --app app calendars sync >/dev/null 2>&1
```
Skip it if no apartment is connected to another site.

**Backups.** At least weekly, download these and keep them somewhere private:

- `megrooms_flask/instance/saranda.db`: your bookings, accounts and listings.
- `megrooms_flask/instance/uploads/`: every photo. In File Manager, right-click the folder → **Compress**, then download the zip.
- `megrooms_flask/.env`: your settings and keys.

Or use cPanel → **Backup** / **JetBackup** if your plan has it.

## 12. Optional extras (paid, off until you add keys)

| Extra | Setting | Cost |
|---|---|---|
| Live weather and sea temperature for a business | Open-Meteo commercial plan, then `LIVE_DATA_ENABLED=true` | Monthly plan |
| AI concierge | `ANTHROPIC_API_KEY` | Per message |
| Google ratings and opening hours | `GOOGLE_MAPS_API_KEY` (Places API, restricted to your server) | Per request |
| Affiliate links for tours and hotels elsewhere | `BOOKING_AFFILIATE_ID`, `GYG_PARTNER_ID`, `VIATOR_PARTNER_ID` | Free; you earn commission |

## Every update after this

cPanel → **Git Version Control** → your repository → **Update from Remote**, then **Deploy HEAD Commit**. Your `.env` and database are never touched by a deploy.
