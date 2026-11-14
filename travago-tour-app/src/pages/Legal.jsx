// Privacy policy and booking terms. Business details come from src/data/business.json;
// what the site actually does (payment methods, accounts, AI concierge) comes from the
// live configuration, so the pages never describe a feature that is switched off.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import business from "../data/business.json";
import { useConfig } from "../lib/useConfig";
import { PageHeader } from "../components/ui";
import { currentLang, tr } from "../i18n";

/** These pages are legal text, so they aren't machine-swapped sentence by sentence. */
function EnglishOnly() {
  if (currentLang() === "en") return null;
  return <p className="legal-note">{tr("This page is in English for now. Write to us if anything is unclear and we'll explain it in your language.")}</p>;
}

const ext = { target: "_blank", rel: "noopener noreferrer" };

const updated = new Date(business.policies_updated + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const who = business.legal_name ? `${business.legal_name} (trading as ${business.trading_name})` : business.trading_name;

function useBusiness() {
  const cfg = useConfig();
  const email = business.email || cfg.contact_email || "";
  const methods = (cfg.payments?.methods || []).map((m) => m.id);
  return { cfg, email, methods, mailto: email ? <a href={`mailto:${email}`}>{email}</a> : <Link to="/contact">our contact page</Link> };
}

function Contents({ items }) {
  return (
    <nav className="legal-toc card pad" aria-label="On this page">
      <b className="small">On this page</b>
      <ol>{items.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
    </nav>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="legal-section">
      <h2 className="h3">{title}</h2>
      {children}
    </section>
  );
}

function BusinessCard({ email, mailto }) {
  return (
    <address className="legal-business card pad">
      <b>{who}</b>
      {business.nipt && <span>NIPT {business.nipt}</span>}
      {business.address && <span>{business.address}</span>}
      {email && <span>Email: {mailto}</span>}
      {business.phone && <span>Phone: <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}>{business.phone}</a></span>}
    </address>
  );
}

/** "14 days or more before check-in → everything you paid", … from the cancellation settings. */
export function cancellationRules(c = business.cancellation) {
  const rules = [{ when: `${c.full_refund_days} days or more before check-in`, refund: "Everything you paid" }];
  const partial = c.partial_refund_percent > 0 && c.partial_refund_days < c.full_refund_days;
  if (partial) {
    const to = c.full_refund_days - 1;
    rules.push({ when: c.partial_refund_days === to ? `${to} days before check-in` : `${c.partial_refund_days}–${to} days before check-in`, refund: `${c.partial_refund_percent}% of what you paid` });
  }
  rules.push({ when: `Less than ${partial ? c.partial_refund_days : c.full_refund_days} days before check-in, or no-show`, refund: "Nothing" });
  return rules;
}

export function Privacy() {
  const { cfg, email, methods, mailto } = useBusiness();
  const accounts = cfg.auth?.enabled;
  const isStatic = cfg.mode === "static";
  const months = cfg.retention_months ?? 24;
  const partners = cfg.partners === true;
  useEffect(() => { document.title = "Privacy policy · Meg'Rooms"; }, []);
  return (
    <div className="page container narrow legal">
      <PageHeader eyebrow="Privacy" icon={ShieldCheck} title="Privacy policy" lead={`How ${business.trading_name} uses the details you share with us — in plain words. No advertising, no tracking cookies, and we never sell your data.`}>
        <p className="tiny muted">Last updated {updated}</p>
      </PageHeader>
      <EnglishOnly />
      <Contents items={[["who", "Who we are"], ["collect", "What we collect and why"], ["shared", "Who else sees it"], ["storage", "Cookies and browser storage"], ["keep", "How long we keep it"], ["rights", "Your rights"], ["security", "How we protect it"], ["changes", "Children and changes"]]} />

      <Section id="who" title="Who we are">
        <p>The website and the apartments are run by:</p>
        <BusinessCard email={email} mailto={mailto} />
        <p>We decide how your personal data is used (we are the “controller”). We follow Albania's Law No. 124/2024 on Personal Data Protection and, for visitors in the European Union, the GDPR. Questions about your data: {mailto}.</p>
      </Section>

      <Section id="collect" title="What we collect and why">
        {isStatic && <p className="legal-note">This version of the site has no database. Booking requests, guide requests and messages open as a ready-written email or WhatsApp message in your own app, and reach us only if you send them.</p>}
        <dl className="legal-list">
          <dt>Booking a stay</dt>
          <dd>Your name, email, phone number if you give it, dates, number of guests and any notes; plus how you paid, the amount and the payment provider's reference. We need these to take and run your booking and to keep the accounting records the law requires.</dd>
          <dt>Requesting a local guide</dt>
          <dd>Your name, email, phone if given, the date, group size, pickup point, language and your message — to arrange the day with the guide.</dd>
          <dt>Messages to us</dt>
          <dd>Your name, email, topic and message, so we can reply.</dd>
          {partners && (
            <>
              <dt>Booking with, or asking, a local business</dt>
              <dd>Some stays, rentals and activities are offered by independent local businesses. When you request one or send them a question, we store your name, email, phone if given, dates, group size and message, and pass them to that business so it can answer you.</dd>
              <dt>Business accounts</dt>
              <dd>If you list a business here: the profile you write (name, description, address and public contact details) and your listings with their photos, which are published once we've approved them, and the account details below. We use them to run the directory and to contact you about it. Photos are saved again without the location and camera details that phones store inside them. If you connect a calendar from another booking site, we read only the dates from it, never guest names.</dd>
            </>
          )}
          {accounts && (
            <>
              <dt>Your account</dt>
              <dd>Your name and email, your password stored only as a one-way scrambled “hash” that nobody can read back, when you signed in and confirmed your email, and the devices you're signed in on (browser type and when last used). Your bookings, guide requests and saved trips are linked to it.</dd>
            </>
          )}
          <dt>Saved and shared trips</dt>
          <dd>{isStatic ? "Trips you share are packed into the link itself; we don't store them." : "Trip plans you save are stored under a random link. Anyone you give the link to can open the trip, so don't put private details in it."}</dd>
          <dt>Keeping the site safe</dt>
          <dd>
            Like every website, the server sees your IP address. We use it only to limit how fast requests can be made, and those counts live briefly in memory and aren't saved. Our web host keeps standard server logs (IP address, page and time) for security.
            {accounts && <> Failed sign-ins are counted against a scrambled code of the email address, not the address itself. When you choose a password, we check it against passwords leaked in other breaches using Have I Been Pwned: only the first 5 characters of a hash of your password ever leave our server, never the password.</>}
          </dd>
          {(cfg.concierge?.enabled ?? true) && (
            <>
              <dt>The travel concierge</dt>
              <dd>{cfg.concierge?.ai ? "What you type is sent to our server and on to Anthropic, which runs the AI that writes the answer. We don't save the conversation on our server; your browser keeps it until you close the tab." : `${isStatic ? "Answers are worked out in your browser" : "Answers are worked out on our server"} and the conversation is not saved; your browser keeps it until you close the tab.`} Please don't type passwords or payment details into it.</dd>
            </>
          )}
        </dl>
      </Section>

      <Section id="shared" title="Who else sees it">
        <ul>
          <li><b>Our web host</b>{business.hosting ? ` — ${business.hosting}` : ""} — stores the site, its database and our email.</li>
          {methods.includes("paypal") && <li><b>PayPal</b> handles PayPal and card payments. We receive the payment status, amount and PayPal's reference — never your card or PayPal login. PayPal's own privacy statement applies to what you give PayPal.</li>}
          {methods.includes("card") && <li><b>Stripe</b> handles card payments. We never see your full card number.</li>}
          {methods.includes("bank") && <li><b>Banks</b> — for a bank transfer, your bank and ours process the payment details (such as the account holder's name and IBAN), which then appear on our bank statement.</li>}
          {cfg.concierge?.ai && <li><b>Anthropic</b> (United States) processes concierge messages to write the answers.</li>}
          {partners && <li><b>The local business you book with or ask</b> receives your request and contact details, by email and in its dashboard here. It is responsible for how it uses them from then on.</li>}
          {cfg.guides && <li><b>The guide you request</b> receives your name, contact details and the trip details so they can confirm and meet you.</li>}
          <li><b>Maps, weather and exchange rates.</b> Your browser loads map images from OpenStreetMap and CARTO, and may fetch weather from Open-Meteo, exchange rates from ExchangeRate-API and road shapes from OSRM. Like any website, they see your IP address; we send them no personal details.</li>
          <li><b>Videos</b> load from YouTube's privacy-enhanced domain (youtube-nocookie.com) only when you press play; from then on Google's terms apply.</li>
          <li><b>WhatsApp and email</b> — if you choose to message us that way, the app you use also handles the message.</li>
          <li>Authorities, only when the law requires it.</li>
        </ul>
        <p>Some of these providers are outside Albania and the EU (for example in the United States). We only use providers that protect data with recognised safeguards, such as the EU's Standard Contractual Clauses.</p>
      </Section>

      <Section id="storage" title="Cookies and browser storage">
        <p>We use no advertising or analytics cookies, so there's no cookie banner. What your browser stores only makes the site work:</p>
        <ul>
          {accounts && <li><code>__Host-sc_session</code> — a cookie that keeps you signed in. Set only when you sign in; removed when you sign out. It holds a random code, not your details.</li>}
          <li><code>saranda-ui</code> — your light/dark theme and language choice.</li>
          <li><code>saranda-trip-v2</code> — the trip you're planning, so it's still there next time.</li>
          <li><code>saranda-concierge</code> — your concierge chat, deleted when you close the tab.</li>
          <li><code>celebrated:…</code> — remembers that we already showed the booking celebration, deleted when you close the tab.</li>
        </ul>
        <p>You can clear all of these in your browser settings at any time.</p>
      </Section>

      <Section id="keep" title="How long we keep it">
        <ul>
          <li><b>Bookings and payments:</b> as long as Albanian tax and accounting law requires us to keep business records.</li>
          <li><b>Guide requests:</b> the same as bookings when they lead to a paid service; otherwise up to {months} months.</li>
          <li><b>Messages to us{partners ? " and questions to local businesses" : ""}:</b> up to {months} months, then deleted.</li>
          {partners && <li><b>Business profiles and listings:</b> until the owner removes them or deletes the account; the page then comes down and its contact details are erased.</li>}
          {accounts && <li><b>Your account:</b> until you delete it. Sign-in sessions and email links expire on their own and are cleared out regularly. If you delete your account, your saved trips go with it; bookings stay with us as business records but are no longer linked to an account.</li>}
          <li><b>Server logs:</b> as long as our web host keeps them for security.</li>
        </ul>
      </Section>

      <Section id="rights" title="Your rights">
        <p>You can ask us to show you the data we hold about you, correct it, delete it, restrict or object to how we use it, or give it to you in a portable format.{accounts && <> With an account you can download everything and delete your account yourself, under <Link to="/account?tab=security">My account → Security</Link>.</>} Otherwise email {mailto}. We answer within one month.</p>
        <p>If you're unhappy with how we handled your data, you can complain to Albania's data protection authority, the <a href="https://idp.al/en/" {...ext}>Commissioner for the Right to Information and Personal Data Protection</a>, or, in the EU, to the data protection authority where you live.</p>
      </Section>

      <Section id="security" title="How we protect it">
        <p>The site is served only over encrypted HTTPS. Passwords are stored as slow one-way hashes, sign-in cookies can't be read by scripts, and sessions, reset links and confirmation links are stored only as fingerprints. Card and PayPal details are entered with the payment provider, never stored by us. Only the host can see bookings and messages.</p>
      </Section>

      <Section id="changes" title="Children and changes">
        <p>The site isn't meant for children under 16 — a parent or guardian should make the booking. If we change this policy, we'll update the date at the top of this page.</p>
        <p className="small muted">See also our <Link to="/terms">booking terms</Link>.</p>
      </Section>
    </div>
  );
}

export function Terms() {
  const { cfg, email, methods, mailto } = useBusiness();
  const accounts = cfg.auth?.enabled;
  const deposit = cfg.payments?.deposit_percent ?? 100;
  const partners = cfg.partners === true;
  const online = methods.some((m) => m !== "request");
  useEffect(() => { document.title = "Booking terms · Meg'Rooms"; }, []);
  return (
    <div className="page container narrow legal">
      <PageHeader eyebrow="Booking terms" icon={FileText} title="Booking terms" lead="The agreement between you and us when you book one of our apartments — what you pay, when, and what happens if plans change.">
        <p className="tiny muted">Last updated {updated}</p>
      </PageHeader>
      <EnglishOnly />
      <Contents items={[["us", "Who you book with"], ["booking", "How booking works"], ["cancel", "Cancelling and changes"], ["stay", "During your stay"], ["guides", "Guides and tours"], ...(partners ? [["partners", "Local businesses"]] : []), ["info", "Travel information"], ["other", "Everything else"]]} />

      <Section id="us" title="Who you book with">
        <BusinessCard email={email} mailto={mailto} />
        <p>By sending a booking or booking request you accept these terms. Please read them with our <Link to="/privacy">privacy policy</Link>.</p>
      </Section>

      <Section id="booking" title="How booking works">
        <p>Prices are per apartment per night, in euros, as shown when you book. Our system works out the total from the dates you pick; the amount you see before you confirm is the amount that applies.</p>
        <ul>
          {methods.includes("request") && <li><b>Request to book:</b> nothing is paid online. Your booking is confirmed only when we email you to say the dates are yours. You then pay on arrival.</li>}
          {methods.includes("paypal") && <li><b>PayPal or card:</b> you pay on PayPal's own page. We hold your dates for 30 minutes while you pay. Your booking is confirmed as soon as PayPal confirms the payment; if PayPal reviews the payment first, we keep holding your dates for up to 3 days.</li>}
          {methods.includes("card") && <li><b>Card:</b> you pay on the secure payment form; the booking is confirmed when the payment succeeds.</li>}
          {methods.includes("bank") && <li><b>Bank transfer:</b> we hold your dates until the deadline shown with our bank details. Send the exact amount with your booking reference. Your booking is confirmed when the money reaches our account. If it doesn't arrive in time, the hold ends and the dates may go to someone else.</li>}
          {!methods.length && <li>The ways to pay are shown when you book.</li>}
        </ul>
        {online && (deposit < 100
          ? <p>When you pay online you pay a {deposit}% deposit to confirm the booking. The rest is paid on arrival.</p>
          : <p>When you pay online you pay the full price of the stay to confirm the booking.</p>)}
        {methods.includes("paypal") && <p>If our PayPal account charges in another currency, the converted amount is shown before you pay.</p>}
      </Section>

      <Section id="cancel" title="Cancelling and changes">
        <p>To cancel, email {mailto} with your booking reference. What you get back depends on how long before check-in we receive it:</p>
        <table className="legal-table">
          <thead><tr><th scope="col">When you cancel</th><th scope="col">What you get back</th></tr></thead>
          <tbody>{cancellationRules().map((r) => <tr key={r.when}><td>{r.when}</td><td><b>{r.refund}</b></td></tr>)}</tbody>
        </table>
        <ul>
          <li>Refunds go back the way you paid, within 14 days.</li>
          <li>If you haven't paid anything yet (a request to book), you can cancel free of charge — just let us know as early as you can.</li>
          <li><b>Changing dates:</b> ask us and we'll move your stay if the apartment is free. Moving before the full-refund deadline is free; after it, the change counts as a cancellation under the table above.</li>
          <li><b>If we have to cancel</b> — for example if the apartment can't be used — you get back everything you paid, and we'll help you find somewhere else to stay.</li>
          <li>Because a stay is booked for specific dates, the 14-day “cooling-off” right for online purchases doesn't apply to it. The cancellation terms above apply instead.</li>
        </ul>
      </Section>

      <Section id="stay" title="During your stay">
        <ul>
          {(business.check_in_from || business.check_out_by) && <li>{business.check_in_from && <>Check-in from <b>{business.check_in_from}</b>. </>}{business.check_out_by && <>Check-out by <b>{business.check_out_by}</b>.</>} If you need other times, ask us — we'll help if we can.</li>}
          <li>We'll ask to see a passport or ID card for each adult when you arrive.</li>
          <li>Only the number of guests in your booking may stay overnight.</li>
          <li>Please treat the apartment as your own home and follow the house rules we send with your confirmation. You're responsible for damage caused during your stay beyond normal wear and tear.</li>
        </ul>
      </Section>

      <Section id="guides" title="Local guides and tours">
        <p>A request for a guide is not a booking until it is confirmed. Guides are local professionals who set their own prices; the price shown is an estimate for your group. Nothing is charged on this website for guides — how and when you pay is confirmed with the booking. Entry tickets, fuel and meals are usually extra.</p>
      </Section>

      {partners && (
        <Section id="partners" title="Listings from local businesses">
          <p>Stays, rentals and activities marked with a business's name are offered by that independent business, not by {business.trading_name}. We check each business and listing before it appears, but we don't run them.</p>
          <ul>
            <li>Your booking or enquiry is a request to that business. The agreement, the price, payment, cancellation and any refund are between you and them. Nothing is charged through this website, and the cancellation table above applies only to {business.trading_name}'s own apartments.</li>
            <li>If something about a business here seems wrong, tell us at {mailto} and we'll look into it; we can take a business offline.</li>
          </ul>
          <p><b>If you list a business here</b>, you agree to these rules:</p>
          <ul>
            <li>List only what you really offer and are allowed to offer, with accurate descriptions and prices, and keep it up to date. You're responsible for your own licences, taxes and insurance.</li>
            <li>Upload only photos that you took or have the right to use, and that show what you're offering as it is now. Don't upload photos in which people can be recognised unless they've agreed.</li>
            <li>Keep your calendar up to date. If you connect calendars from other booking sites, you're still responsible for avoiding double bookings.</li>
            <li>Answer guests promptly, honour what you confirm, and use guests' details only to handle their request, in line with data protection law.</li>
            <li>We review every profile and listing before it goes live, including later changes to their text and new photos. We may decline, edit for clarity, or take down a listing or business that breaks these rules or draws justified complaints.</li>
            <li>Listing is free. You can pause or remove a listing, or delete your account, at any time.</li>
          </ul>
        </Section>
      )}

      <Section id="info" title="Travel information">
        <p>Drive times, routes, budgets, weather, exchange rates and prices of places we don't run are planning estimates from public sources. They change, so please check before you rely on them. Ferries, buses, boats and other services are run by other companies under their own terms.</p>
      </Section>

      <Section id="other" title="Everything else">
        <ul>
          {accounts && <li><b>Accounts:</b> keep your password to yourself. We may close an account that's used to abuse the site. You can delete yours at any time.</li>}
          <li><b>Our responsibility:</b> nothing in these terms limits rights you have under consumer law that can't be limited. Otherwise, our liability for a booking is limited to the amount you paid for it.</li>
          <li><b>Problems:</b> tell us straight away, during your stay if possible, so we can put things right.</li>
          <li><b>Law:</b> these terms are governed by Albanian law. If you live elsewhere, you keep any protection your own country's consumer law gives you.</li>
          <li><b>Changes:</b> we may update these terms. The version in force when you booked applies to your booking.</li>
        </ul>
      </Section>
    </div>
  );
}
