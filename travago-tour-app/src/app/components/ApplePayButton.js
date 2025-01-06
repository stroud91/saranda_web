"use client";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { useState } from "react";

const ApplePayButton = ({ amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState("");

  const handlePayment = async () => {
    if (!stripe) {
      setErrorMessage("Stripe has not loaded yet.");
      return;
    }

    const response = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const paymentIntent = await response.json();

    const paymentRequest = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: "Your Total",
        amount: amount * 100, 
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    paymentRequest.canMakePayment().then((result) => {
      if (result && result.applePay) {
        paymentRequest.show();
      } else {
        setErrorMessage("Apple Pay is not available on this device.");
      }
    });

    paymentRequest.on("paymentmethod", async (event) => {
      const { error } = await stripe.confirmCardPayment(paymentIntent.clientSecret, {
        payment_method: event.paymentMethod.id,
      });

      if (error) {
        setErrorMessage(error.message);
        event.complete("fail");
      } else {
        event.complete("success");
        alert("Payment successful!");
      }
    });
  };

  return (
    <div>
      <button onClick={handlePayment} style={{ backgroundColor: "#000", color: "#fff", padding: "10px 20px", borderRadius: "8px" }}>
        Pay with Apple Pay
      </button>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
    </div>
  );
};

export default ApplePayButton;
