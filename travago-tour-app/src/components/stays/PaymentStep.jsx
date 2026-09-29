import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { Alert } from "../ui";
import { euro } from "../../lib/format";

function Form({ reference, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/${reference}` },
    });
    // Only reached on immediate errors; success redirects to return_url.
    if (err) setError(err.message || "Payment failed");
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="stack">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn primary lg block" disabled={!stripe || busy}>{busy ? <span className="spinner" /> : <Lock size={18} />} Pay {euro(amount)}</button>
      <p className="tiny muted center">Payments are processed securely by Stripe. Card details never touch our servers.</p>
    </form>
  );
}

export default function PaymentStep({ publishableKey, clientSecret, reference, amount }) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: dark ? "night" : "stripe", variables: { colorPrimary: "#0b5c7e", borderRadius: "12px", fontFamily: "Manrope, system-ui, sans-serif" } } }}>
      <Form reference={reference} amount={amount} />
    </Elements>
  );
}
