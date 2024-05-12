import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Route, Switch } from "react-router-dom";
import SignupFormPage from "./components/SignupFormPage";
import LoginFormPage from "./components/LoginFormPage";
import { authenticate } from "./store/session";
// import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Navigation from "./components/Navigation";
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './components/pages/Home';
import Activities from './components/pages/Activities';
import Dine from './components/pages/Dine';
import Stay from './components/pages/Stay';
import About from './components/pages/About';

function App() {
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <>
      <Navigation isLoaded={isLoaded} />
      {isLoaded && (
        <Switch>
          <Header />
          <Route path="/login" >
            <LoginFormPage />
          </Route>
          <Route path="/signup">
            <SignupFormPage />
          </Route>
          <Route path="/" exact component={Home} />
          <Route path="/dine" component={Dine} />
          <Route path="/stay" component={Stay} />
          <Route path="/activities" component={Activities} />
          <Footer />
        </Switch>

      )}
    </>
  );
}

export default App;
