"use client";
import styles from './Checkout.module.css';

const Checkout = ({ booking }) => {
  return (
    <div className={styles.checkoutPage}>
      <h1>Checkout</h1>
      <div className={styles.bookingDetails}>
        <h2>Booking Summary</h2>
        <p><strong>Item:</strong> {booking.itemName}</p>
        <p><strong>Price:</strong> ${booking.price}</p>
        <p><strong>Duration:</strong> {booking.duration} days</p>
        <p><strong>Total Cost:</strong> ${booking.totalCost}</p>
      </div>
      <div className={styles.paymentSection}>
        <h2>Payment Information</h2>
        <form>
          <label>
            Name on Card
            <input type="text" name="name" required />
          </label>
          <label>
            Card Number
            <input type="text" name="cardNumber" required />
          </label>
          <label>
            Expiration Date
            <input type="text" name="expiry" required />
          </label>
          <label>
            CVV
            <input type="text" name="cvv" required />
          </label>
          <button type="submit" className={styles.payButton}>Pay Now</button>
        </form>
      </div>
    </div>
  );
};

export default Checkout;