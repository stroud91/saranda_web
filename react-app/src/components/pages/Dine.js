import React from 'react';


const Dine = () => {
  return (
    <div className="dine-page">
      <h1>Explore Dining Options</h1>
      <div className="dining-options">
        {/* Example card */}
        <div className="dining-card">
          <img src="/path-to-image.jpg" alt="Restaurant Image" />
          <div className="info">
            <h2>Seaside Restaurant</h2>
            <p>Enjoy fresh seafood right by the sea.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dine;
