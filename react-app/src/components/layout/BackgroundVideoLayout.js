import React from 'react';
import './BackgroundVideoLayout.scss';

const BackgroundVideoLayout = ({ videoSource, children }) => {
  return (
    <div className="video-background-layout">
      <video autoPlay loop muted className="background-video">
        <source src={videoSource} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="content-overlay">
        {children}
      </div>
    </div>
  );
};

export default BackgroundVideoLayout;
