// Privacy policy and booking terms. Business details come from src/data/business.json;
// what the site actually does (payment methods, accounts, AI concierge) comes from the
// live configuration, so the pages never describe a feature that is switched off.
//
// Every sentence goes through tr() or R() and has a row in src/i18n/legal.js, which
// only these two pages load. A test fails if a sentence here has no translation, so
// the English and the other languages can't drift apart unnoticed.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import business from "../data/business.json";
import { useConfig } from "../lib/useConfig";
import { PageHeader, Skeleton } from "../components/ui";
import { addTable, currentLang, locale, rich, tr } from "../i18n";

const ext = { target: "_blank", rel: "noopener noreferrer" };
const bold = (c) => <b>{c}</b>;
/** A sentence with <b>bold</b>, links or values; drawn by rich(). */
const R = (text, parts, vars) => rich(text, { b: bold, ...parts }, vars);

/** Loads this page's translations; false while they are on their way. */
function useLegalText() {
  const [ready, setReady] = useState(currentLang() === "en");
  useEffect(() => {
    let live = true;
    addTable(() => import("../i18n/legal.js")).catch(() => {}).finally(() => live && setReady(true));
    return () => { live = false; };
  }, []);
  return ready;
}

/** A translation helps people read the page; the English text is the one that counts. */
function TranslationNote() {
  if (currentLang() === "en") return null;
  return <p className="legal-note">{tr("This is a translation to help you. If it differs from the English version, the English version applies.")}</p>;
}

function useBusiness() {
  const cfg = useConfig();
  const email = business.email || cfg.contact_email || "";
  const methods = (cfg.payments?.methods || []).map((m) => m.id);
  const mailto = email ? <a href={`mailto:${email}`}>{email}</a> : <Link to="/contact">{tr("our contact page")}</Link>;
  return { cfg, email, methods, mailto, mail: () => mailto };
}

const updated = () => tr("Last updated {date}", { date: new Date(business.policies_updated + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" }) });

function Contents({ items }) {
  return (
    <nav className="legal-toc card pad" aria-label={tr("On this page")}>
      <b className="small">{tr("On this page")}</b>
      <ol>{items.map(([id, label]) => <li key={id}><a href={`#${id}`}>{tr(label)}</a></li>)}</ol>
    </nav>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="legal-section">
      <h2 className="h3">{tr(title)}</h2>
      {children}
    </section>
  );
}

function BusinessCard({ email, mailto }) {
  const who = business.legal_name ? tr("{legal} (trading as {name})", { legal: business.legal_name, name: business.trading_name }) : business.trading_name;
  return (
    <address className="legal-business card pad">
      <b>{who}</b>
      {business.nipt && <span>NIPT {business.nipt}</span>}
      {business.address && <span>{business.address}</span>}
      {email && <span>{tr("Email")}: {mailto}</span>}
      {business.phone && <span>{tr("Phone")}: <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}>{business.phone}</a></span>}
    </address>
  );
}

/** "14 days or more before check-in → everything you paid", … from the cancellation settings. */
export function cancellationRules(c = business.cancellation) {
  const rules = [{ when: tr("{n} days or more before check-in", { n: c.full_refund_days }), refund: tr("Everything you paid") }];
  const partial = c.partial_refund_percent > 0 && c.partial_refund_days < c.full_refund_days;
  if (partial) {
    const to = c.full_refund_days - 1;
    rules.push({
      when: c.partial_refund_days === to ? tr("{n} days before check-in", { n: to }) : tr("{from}–{to} days before check-in", { from: c.partial_refund_days, to }),
      refund: tr("{percent}% of what you paid", { percent: c.partial_refund_percent }),
    });
  }
  rules.push({ when: tr("Less than {n} days before check-in, or no-show", { n: partial ? c.partial_refund_days : c.full_refund_days }), refund: tr("Nothing back") });
  return rules;
}

export function Privacy() {
  const { cfg, email, methods, mailto, mail } = useBusiness();
  const ready = useLegalText();
  const accounts = cfg.auth?.enabled;
  const isStatic = cfg.mode === "static";
  const months = cfg.retention_months ?? 24;
  const partners = cfg.partners === true;
  const counting = cfg.stats === true && !isStatic; // cookie-less visit counts (server only)
  useEffect(() => { if (ready) document.title = `${tr("Privacy policy")} · Meg'Rooms`; }, [ready]);
  if (!ready) return <div className="page container narrow legal"><Skeleton h={420} r={20} /></div>;
  return (
    <div className="page container narrow legal">
      <PageHeader eyebrow={tr("Privacy")} icon={ShieldCheck} title={tr("Privacy policy")} lead={tr("How {name} uses the details you share with us, in plain words. No advertising, no tracking cookies, and we never sell your data.", { name: business.trading_name })}>
        <p className="tiny muted">{updated()}</p>
      </PageHeader>
      <TranslationNote />
      <Contents items={[["who", "Who we are"], ["collect", "What we collect and why"], ["shared", "Who else sees it"], ["storage", "Cookies and browser storage"], ["keep", "How long we keep it"], ["rights", "Your rights"], ["security", "How we protect it"], ["changes", "Children and changes"]]} />

      <Section id="who" title="Who we are">
        <p>{tr("The website and the apartments are run by:")}</p>
        <BusinessCard email={email} mailto={mailto} />
        <p>{R("We decide how your personal data is used (we are the “controller”). We follow Albania's Law No. 124/2024 on Personal Data Protection and, for visitors in the European Union, the GDPR. Questions about your data: <mail>@</mail>.", { mail })}</p>
      </Section>

      <Section id="collect" title="What we collect and why">
        {isStatic && <p className="legal-note">{tr("This version of the site has no database. Booking requests, guide requests and messages open as a ready-written email or WhatsApp message in your own app, and reach us only if you send them.")}</p>}
        <dl className="legal-list">
          <dt>{tr("Booking a stay")}</dt>
          <dd>{tr("Your name, email, phone number if you give it, dates, number of guests and any notes; plus how you paid, the amount and the payment provider's reference. We need these to take and run your booking and to keep the accounting records the law requires.")}</dd>
          <dt>{tr("Requesting a local guide")}</dt>
          <dd>{tr("Your name, email, phone if given, the date, group size, pickup point, language and your message, to arrange the day with the guide.")}</dd>
          <dt>{tr("Messages to us")}</dt>
          <dd>{tr("Your name, email, topic and message, so we can reply.")}</dd>
          {cfg.reviews !== false && !isStatic && (
            <>
              <dt>{tr("Reviews")}</dt>
              <dd>{tr("If you review a stay, we publish the rating and text you write with your first name, the first letter of your surname and the month you stayed. The host may reply in public. If you delete your account, your name is removed from your reviews.")}</dd>
            </>
          )}
          {partners && (
            <>
              <dt>{tr("Booking with, or asking, a local business")}</dt>
              <dd>{tr("Some stays, rentals and activities are offered by independent local businesses. When you request one or send them a question, we store your name, email, phone if given, dates, group size and message, and pass them to that business so it can answer you.")}</dd>
              <dt>{tr("Business accounts")}</dt>
              <dd>{tr("If you list a business here: the profile you write (name, description, address and public contact details) and your listings with their photos, which are published once we've approved them, and the account details below. We use them to run the directory and to contact you about it. Photos are saved again without the location and camera details that phones store inside them. If you connect a calendar from another booking site, we read only the dates from it, never guest names.")}</dd>
            </>
          )}
          {accounts && (
            <>
              <dt>{tr("Your account")}</dt>
              <dd>
                {tr("Your name and email, your password stored only as a one-way scrambled “hash” that nobody can read back, when you signed in and confirmed your email, and the devices you're signed in on (browser type and when last used). Your bookings, guide requests and saved trips are linked to it.")}{" "}
                {tr("If you switch on two-step sign-in, we also keep the secret your authenticator app uses, encrypted, and your recovery codes as one-way hashes.")}
              </dd>
            </>
          )}
          <dt>{tr("Saved and shared trips")}</dt>
          <dd>{isStatic ? tr("Trips you share are packed into the link itself; we don't store them.") : tr("Trip plans you save are stored under a random link. Anyone you give the link to can open the trip, so don't put private details in it.")}</dd>
          <dt>{tr("Keeping the site safe")}</dt>
          <dd>
            {tr("Like every website, the server sees your IP address. We use it only to limit how fast requests can be made, and those counts live briefly in memory and aren't saved. Our web host keeps standard server logs (IP address, page and time) for security.")}
            {accounts && <> {tr("Failed sign-ins are counted against a scrambled code of the email address, not the address itself. When you choose a password, we check it against passwords leaked in other breaches using Have I Been Pwned: only the first 5 characters of a hash of your password ever leave our server, never the password.")}</>}
          </dd>
          {counting && (
            <>
              <dt>{tr("Counting visits")}</dt>
              <dd>{tr("We count how many people open each page, the name of the site they arrived from, the language they use and whether they're on a phone or a computer, so we know what is useful. No cookie is used and nothing is stored on your device. To count each visitor only once a day, your IP address and browser type are turned into a scrambled code with a key that changes every day. The code is deleted the next day, so we can't recognise you from one day to the next or follow what you read. If your browser sends “Do Not Track” or “Global Privacy Control”, your visit isn't counted at all.")}</dd>
            </>
          )}
          {(cfg.concierge?.enabled ?? true) && (
            <>
              <dt>{tr("The travel concierge")}</dt>
              <dd>
                {cfg.concierge?.ai
                  ? tr("What you type is sent to our server and on to Anthropic, which runs the AI that writes the answer. We don't save the conversation on our server; your browser keeps it until you close the tab.")
                  : isStatic
                    ? tr("Answers are worked out in your browser and the conversation is not saved; your browser keeps it until you close the tab.")
                    : tr("Answers are worked out on our server and the conversation is not saved; your browser keeps it until you close the tab.")}{" "}
                {tr("Please don't type passwords or payment details into it.")}
              </dd>
            </>
          )}
        </dl>
      </Section>

      <Section id="shared" title="Who else sees it">
        <ul>
          <li>{business.hosting ? R("<b>Our web host</b> ({host}) stores the site, its database and our email.", null, { host: business.hosting }) : R("<b>Our web host</b> stores the site, its database and our email.")}</li>
          {methods.includes("paypal") && <li>{R("<b>PayPal</b> handles PayPal and card payments. We receive the payment status, amount and PayPal's reference, never your card or PayPal login. PayPal's own privacy statement applies to what you give PayPal.")}</li>}
          {methods.includes("card") && <li>{R("<b>Stripe</b> handles card payments. We never see your full card number.")}</li>}
          {methods.includes("bank") && <li>{R("<b>Banks:</b> for a bank transfer, your bank and ours process the payment details (such as the account holder's name and IBAN), which then appear on our bank statement.")}</li>}
          {cfg.concierge?.ai && <li>{R("<b>Anthropic</b> (United States) processes concierge messages to write the answers.")}</li>}
          {partners && <li>{R("<b>The local business you book with or ask</b> receives your request and contact details, by email and in its dashboard here. It is responsible for how it uses them from then on.")}</li>}
          {cfg.guides && <li>{R("<b>The guide you request</b> receives your name, contact details and the trip details so they can confirm and meet you.")}</li>}
          {cfg.backup_offsite && !isStatic && <li>{R("<b>A backup storage provider</b> keeps copies of our backups. They are encrypted before they leave our server, so the provider can't read them.")}</li>}
          <li>{R("<b>Maps, weather and exchange rates.</b> Your browser loads map images from OpenStreetMap and CARTO, and may fetch weather from Open-Meteo, exchange rates from ExchangeRate-API and road shapes from OSRM. Like any website, they see your IP address; we send them no personal details.")}</li>
          <li>{R("<b>Videos</b> load from YouTube's privacy-enhanced domain (youtube-nocookie.com) only when you press play; from then on Google's terms apply.")}</li>
          <li>{R("<b>WhatsApp and email:</b> if you choose to message us that way, the app you use also handles the message.")}</li>
          <li>{tr("Authorities, only when the law requires it.")}</li>
        </ul>
        <p>{tr("Some of these providers are outside Albania and the EU (for example in the United States). We only use providers that protect data with recognised safeguards, such as the EU's Standard Contractual Clauses.")}</p>
      </Section>

      <Section id="storage" title="Cookies and browser storage">
        <p>
          {tr("We use no advertising or analytics cookies, so there's no cookie banner.")}{" "}
          {counting && <>{tr("Visits are counted without any cookie (see “Counting visits” above).")} </>}
          {tr("What your browser stores only makes the site work:")}
        </p>
        <ul>
          {accounts && <li><code>__Host-sc_session</code>: {tr("a cookie that keeps you signed in. Set only when you sign in; removed when you sign out. It holds a random code, not your details.")}</li>}
          <li><code>saranda-ui</code>: {tr("your light/dark theme and language choice.")}</li>
          <li><code>saranda-trip-v2</code>: {tr("the trip you're planning, so it's still there next time.")}</li>
          <li><code>saranda-concierge</code>: {tr("your concierge chat, deleted when you close the tab.")}</li>
          <li><code>celebrated:…</code>: {tr("remembers that we already showed the booking celebration, deleted when you close the tab.")}</li>
        </ul>
        <p>{tr("You can clear all of these in your browser settings at any time.")}</p>
      </Section>

      <Section id="keep" title="How long we keep it">
        <ul>
          <li>{R("<b>Bookings and payments:</b> as long as Albanian tax and accounting law requires us to keep business records.")}</li>
          <li>{R("<b>Guide requests:</b> the same as bookings when they lead to a paid service; otherwise up to {months} months.", null, { months })}</li>
          <li>{partners ? R("<b>Messages to us and questions to local businesses:</b> up to {months} months, then deleted.", null, { months }) : R("<b>Messages to us:</b> up to {months} months, then deleted.", null, { months })}</li>
          {partners && <li>{R("<b>Business profiles and listings:</b> until the owner removes them or deletes the account; the page then comes down and its contact details are erased.")}</li>}
          {accounts && <li>{R("<b>Your account:</b> until you delete it. Sign-in sessions and email links expire on their own and are cleared out regularly. If you delete your account, your saved trips go with it; bookings stay with us as business records but are no longer linked to an account.")}</li>}
          {counting && <li>{R("<b>Visit counts:</b> the one-day visitor codes are deleted the next day. What stays is daily totals (so many visitors, so many views of a page) with nothing in them about any person.")}</li>}
          {!isStatic && <li>{R("<b>Backups:</b> copies of our database are kept for up to {months} months and then deleted. Something we deleted at your request can stay inside those copies until then; it isn't used for anything else.", null, { months: cfg.backup_months ?? 6 })}</li>}
          <li>{R("<b>Server logs:</b> as long as our web host keeps them for security.")}</li>
        </ul>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          {tr("You can ask us to show you the data we hold about you, correct it, delete it, restrict or object to how we use it, or give it to you in a portable format.")}{" "}
          {accounts && <>{R("With an account you can download everything and delete your account yourself, under <a>My account → Security</a>.", { a: (c) => <Link to="/account?tab=security">{c}</Link> })} </>}
          {R("To use these rights, email <mail>@</mail>. We answer within one month.", { mail })}
        </p>
        <p>{R("If you're unhappy with how we handled your data, you can complain to Albania's data protection authority, the <a>Commissioner for the Right to Information and Personal Data Protection</a>, or, in the EU, to the data protection authority where you live.", { a: (c) => <a href="https://idp.al/en/" {...ext}>{c}</a> })}</p>
      </Section>

      <Section id="security" title="How we protect it">
        <p>
          {tr("The site is served only over encrypted HTTPS. Passwords are stored as slow one-way hashes, sign-in cookies can't be read by scripts, and sessions, reset links and confirmation links are stored only as fingerprints. Card and PayPal details are entered with the payment provider, never stored by us. Only the host can see bookings and messages.")}
          {accounts && <> {tr("You can add two-step sign-in to your account for extra protection.")}</>}
        </p>
      </Section>

      <Section id="changes" title="Children and changes">
        <p>{tr("The site isn't meant for children under 16; a parent or guardian should make the booking. If we change this policy, we'll update the date at the top of this page.")}</p>
        <p className="small muted">{R("See also our <a>booking terms</a>.", { a: (c) => <Link to="/terms">{c}</Link> })}</p>
      </Section>
    </div>
  );
}

export function Terms() {
  const { cfg, email, methods, mailto, mail } = useBusiness();
  const ready = useLegalText();
  const accounts = cfg.auth?.enabled;
  const deposit = cfg.payments?.deposit_percent ?? 100;
  const partners = cfg.partners === true;
  const online = methods.some((m) => m !== "request");
  const name = business.trading_name;
  useEffect(() => { if (ready) document.title = `${tr("Booking terms")} · Meg'Rooms`; }, [ready]);
  if (!ready) return <div className="page container narrow legal"><Skeleton h={420} r={20} /></div>;
  return (
    <div className="page container narrow legal">
      <PageHeader eyebrow={tr("Booking terms")} icon={FileText} title={tr("Booking terms")} lead={tr("The agreement between you and us when you book one of our apartments: what you pay, when, and what happens if plans change.")}>
        <p className="tiny muted">{updated()}</p>
      </PageHeader>
      <TranslationNote />
      <Contents items={[["us", "Who you book with"], ["booking", "How booking works"], ["cancel", "Cancelling and changes"], ["stay", "During your stay"], ["reviews", "Reviews"], ["guides", "Guides and tours"], ...(partners ? [["partners", "Local businesses"]] : []), ["info", "Travel information"], ["other", "Everything else"]]} />

      <Section id="us" title="Who you book with">
        <BusinessCard email={email} mailto={mailto} />
        <p>{R("By sending a booking or booking request you accept these terms. Please read them with our <a>privacy policy</a>.", { a: (c) => <Link to="/privacy">{c}</Link> })}</p>
      </Section>

      <Section id="booking" title="How booking works">
        <p>{tr("Prices are per apartment per night, in euros, as shown when you book. Our system works out the total from the dates you pick; the amount you see before you confirm is the amount that applies.")}</p>
        <ul>
          {methods.includes("request") && <li>{R("<b>Request to book:</b> nothing is paid online. Your booking is confirmed only when we email you to say the dates are yours. You then pay on arrival.")}</li>}
          {methods.includes("paypal") && <li>{R("<b>PayPal or card:</b> you pay on PayPal's own page. We hold your dates for 30 minutes while you pay. Your booking is confirmed as soon as PayPal confirms the payment; if PayPal reviews the payment first, we keep holding your dates for up to 3 days.")}</li>}
          {methods.includes("card") && <li>{R("<b>Card:</b> you pay on the secure payment form; the booking is confirmed when the payment succeeds.")}</li>}
          {methods.includes("bank") && <li>{R("<b>Bank transfer:</b> we hold your dates until the deadline shown with our bank details. Send the exact amount with your booking reference. Your booking is confirmed when the money reaches our account. If it doesn't arrive in time, the hold ends and the dates may go to someone else.")}</li>}
          {!methods.length && <li>{tr("The ways to pay are shown when you book.")}</li>}
        </ul>
        {online && <p>{deposit < 100
          ? tr("When you pay online you pay a {percent}% deposit to confirm the booking. The rest is paid on arrival.", { percent: deposit })
          : tr("When you pay online you pay the full price of the stay to confirm the booking.")}</p>}
        {methods.includes("paypal") && <p>{tr("If our PayPal account charges in another currency, the converted amount is shown before you pay.")}</p>}
      </Section>

      <Section id="cancel" title="Cancelling and changes">
        <p>{R("To cancel, open your booking page (the link is in your confirmation email) and press <b>Cancel booking</b>; this works until the day before check-in. You can also email <mail>@</mail> with your booking reference. What you get back depends on how long before check-in you cancel:", { mail })}</p>
        <table className="legal-table">
          <thead><tr><th scope="col">{tr("When you cancel")}</th><th scope="col">{tr("What you get back")}</th></tr></thead>
          <tbody>{cancellationRules(cfg.cancellation || business.cancellation).map((r) => <tr key={r.when}><td>{r.when}</td><td><b>{r.refund}</b></td></tr>)}</tbody>
        </table>
        <ul>
          <li>{tr("Refunds go back the way you paid, within 14 days. The booking page shows the exact amount before you confirm, and we email you when the refund is sent.")}</li>
          <li>{tr("If you haven't paid anything yet (a request to book), you can cancel free of charge. Just let us know as early as you can.")}</li>
          <li>{R("<b>Changing dates:</b> ask us and we'll move your stay if the apartment is free. Moving before the full-refund deadline is free; after it, the change counts as a cancellation under the table above.")}</li>
          <li>{R("<b>If we have to cancel</b>, for example because the apartment can't be used, you get back everything you paid, and we'll help you find somewhere else to stay.")}</li>
          <li>{tr("Because a stay is booked for specific dates, the 14-day “cooling-off” right for online purchases doesn't apply to it. The cancellation terms above apply instead.")}</li>
        </ul>
      </Section>

      <Section id="stay" title="During your stay">
        <ul>
          {(business.check_in_from || business.check_out_by) && (
            <li>
              {business.check_in_from && <>{R("Check-in from <b>{time}</b>.", null, { time: business.check_in_from })} </>}
              {business.check_out_by && <>{R("Check-out by <b>{time}</b>.", null, { time: business.check_out_by })} </>}
              {tr("If you need other times, ask us and we'll help if we can.")}
            </li>
          )}
          <li>{tr("We'll ask to see a passport or ID card for each adult when you arrive.")}</li>
          <li>{tr("Only the number of guests in your booking may stay overnight.")}</li>
          <li>{tr("Please treat the apartment as your own home and follow the house rules we send with your confirmation. You're responsible for damage caused during your stay beyond normal wear and tear.")}</li>
        </ul>
      </Section>

      <Section id="reviews" title="Reviews">
        <ul>
          <li>{tr("Only guests who booked on this website and finished their stay can review it, once per stay. We email a personal link the day after check-out.")}</li>
          <li>{tr("Reviews are published as written, positive or negative, as soon as they are sent. We don't write reviews ourselves or pay for them.")}</li>
          <li>{tr("We hide a review only if it is abusive, off-topic, advertising, or reveals someone's personal details. The host may post one public reply.")}</li>
        </ul>
      </Section>

      <Section id="guides" title="Local guides and tours">
        <p>{tr("A request for a guide is not a booking until it is confirmed. Guides are local professionals who set their own prices; the price shown is an estimate for your group. Nothing is charged on this website for guides; how and when you pay is confirmed with the booking. Entry tickets, fuel and meals are usually extra.")}</p>
      </Section>

      {partners && (
        <Section id="partners" title="Listings from local businesses">
          <p>{tr("Stays, rentals and activities marked with a business's name are offered by that independent business, not by {name}. We check each business and listing before it appears, but we don't run them.", { name })}</p>
          <ul>
            <li>{tr("Your booking or enquiry is a request to that business. The agreement, the price, payment, cancellation and any refund are between you and them. Nothing is charged through this website, and the cancellation table above applies only to the apartments of {name} itself.", { name })}</li>
            <li>{R("If something about a business here seems wrong, tell us at <mail>@</mail> and we'll look into it; we can take a business offline.", { mail })}</li>
          </ul>
          <p>{R("<b>If you list a business here</b>, you agree to these rules:")}</p>
          <ul>
            <li>{tr("List only what you really offer and are allowed to offer, with accurate descriptions and prices, and keep it up to date. You're responsible for your own licences, taxes and insurance.")}</li>
            <li>{tr("Upload only photos that you took or have the right to use, and that show what you're offering as it is now. Don't upload photos in which people can be recognised unless they've agreed.")}</li>
            <li>{tr("Keep your calendar up to date. If you connect calendars from other booking sites, you're still responsible for avoiding double bookings.")}</li>
            <li>{tr("Answer guests promptly, honour what you confirm, and use guests' details only to handle their request, in line with data protection law.")}</li>
            <li>{tr("We review every profile and listing before it goes live, including later changes to their text and new photos. We may decline, edit for clarity, or take down a listing or business that breaks these rules or draws justified complaints.")}</li>
            <li>{tr("Listing is free. You can pause or remove a listing, or delete your account, at any time.")}</li>
          </ul>
        </Section>
      )}

      <Section id="info" title="Travel information">
        <p>{tr("Drive times, routes, budgets, weather, exchange rates and prices of places we don't run are planning estimates from public sources. They change, so please check before you rely on them. Ferries, buses, boats and other services are run by other companies under their own terms.")}</p>
      </Section>

      <Section id="other" title="Everything else">
        <ul>
          {accounts && <li>{R("<b>Accounts:</b> keep your password to yourself. We may close an account that's used to abuse the site. You can delete yours at any time.")}</li>}
          <li>{R("<b>Our responsibility:</b> nothing in these terms limits rights you have under consumer law that can't be limited. Otherwise, our liability for a booking is limited to the amount you paid for it.")}</li>
          <li>{R("<b>Problems:</b> tell us straight away, during your stay if possible, so we can put things right.")}</li>
          <li>{R("<b>Law:</b> these terms are governed by Albanian law. If you live elsewhere, you keep any protection your own country's consumer law gives you.")}</li>
          <li>{R("<b>Changes:</b> we may update these terms. The version in force when you booked applies to your booking.")}</li>
        </ul>
      </Section>
    </div>
  );
}
