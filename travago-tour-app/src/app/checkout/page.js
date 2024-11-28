"use client";
import Checkout from './Checkout';

const booking = {
  itemName: 'Explore the Albanian Riviera',
  price: 350,
  duration: 5,
  totalCost: 1750
};

const CheckoutPage = () => {
  return <Checkout booking={booking} />;
};

export default CheckoutPage;
