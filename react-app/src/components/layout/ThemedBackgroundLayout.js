import React from 'react';
import './ThemedBackgroundLayout.scss';

const ThemedBackgroundLayout = ({ backgroundImage, children }) => {
  return (
    <div className="themed-background-layout" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="content-overlay">
        {children}
      </div>
    </div>
  );
};

export default ThemedBackgroundLayout;
