import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { authenticate } from "./store/session";
import Navigation from "./components/Navigation";
import Footer from './components/layout/Footer';
import Home from './components/pages/Home';
import Activities from './components/pages/Activities';
import Dine from './components/pages/Dine';
import Stay from './components/pages/Stay';
import About from './components/pages/About';
import PersonalizedTrip from './components/pages/PersonalizedTrip';
import BackgroundVideoLayout from './components/layout/BackgroundVideoLayout';
import ThemedBackgroundLayout from './components/layout/ThemedBackgroundLayout';
import backgroundImage from './components/assets/background.jpg';
import { ModalProvider, Modal } from './context/Modal';
import AboutSaranda from './components/pages/AboutSaranda';

function App() {
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <Router>
      <ModalProvider>
        <Modal />
        <Navigation isLoaded={isLoaded} />
        {isLoaded && (
          <Switch>
            <Route path="/" exact>
              <BackgroundVideoLayout>
                <Home />
              </BackgroundVideoLayout>
            </Route>
            <Route path="/dine">
              <ThemedBackgroundLayout backgroundImage={backgroundImage}>
                <Dine />
              </ThemedBackgroundLayout>
            </Route>
            <Route path="/stay">
              <ThemedBackgroundLayout backgroundImage={backgroundImage}>
                <Stay />
              </ThemedBackgroundLayout>
            </Route>
            <Route path="/activities">
              <ThemedBackgroundLayout backgroundImage={backgroundImage}>
                <Activities />
              </ThemedBackgroundLayout>
            </Route>
            <Route path="/saranda">
            <ThemedBackgroundLayout backgroundImage={backgroundImage}>
              <AboutSaranda />
            </ThemedBackgroundLayout>
           </Route>
            <Route path="/about">
              <ThemedBackgroundLayout backgroundImage={backgroundImage}>
                <About />
              </ThemedBackgroundLayout>
            </Route>

            <Route path="/personalized-trip">
              <ThemedBackgroundLayout backgroundImage={backgroundImage}>
                <PersonalizedTrip />
              </ThemedBackgroundLayout>
            </Route>

          </Switch>
        )}
        <Footer />
      </ModalProvider>
    </Router>
  );
}

export default App;
