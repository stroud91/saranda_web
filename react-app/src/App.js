import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import SignupFormPage from "./components/SignupFormPage";
import LoginFormPage from "./components/LoginFormPage";
import { authenticate } from "./store/session";
import Navigation from "./components/Navigation";
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './components/pages/Home';
import Activities from './components/pages/Activities';
import Dine from './components/pages/Dine';
import Stay from './components/pages/Stay';
import About from './components/pages/About';
import BackgroundVideoLayout from './components/layout/BackgroundVideoLayout';
import ThemedBackgroundLayout from './components/layout/ThemedBackgroundLayout';
import backgroundImage from './components/assets/background.jpg'

function App() {
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <Router>
      <Header />
      <Navigation isLoaded={isLoaded} />
      {isLoaded && (
        <Switch>
          <Route path="/login">
            <ThemedBackgroundLayout backgroundImage={backgroundImage}>
              <LoginFormPage />
            </ThemedBackgroundLayout>
          </Route>
          <Route path="/signup">
            <ThemedBackgroundLayout backgroundImage={backgroundImage}>
              <SignupFormPage />
            </ThemedBackgroundLayout>
          </Route>
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
          <Route path="/about">
            <ThemedBackgroundLayout backgroundImage={backgroundImage}>
              <About />
            </ThemedBackgroundLayout>
          </Route>
        </Switch>
      )}
      <Footer />
    </Router>
  );
}

export default App;
