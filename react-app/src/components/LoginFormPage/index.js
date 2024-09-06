import React, { useState } from "react";
import { login } from "../../store/session";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import './LoginForm.css';

function LoginFormPage() {
  const dispatch = useDispatch();
  const sessionUser = useSelector((state) => state.session.user);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState([]);

  if (sessionUser) return <Redirect to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await dispatch(login(email, password));
    if (data) {
      setErrors(data);
    }
  };

  return (
    <div className="login-page-container">
      <h1 className="login-page-title">Log In</h1>
      <form onSubmit={handleSubmit} className="login-page-form">
        <ul className="login-page-errors">
          {errors.map((error, idx) => (
            <li key={idx} className="login-page-error">{error}</li>
          ))}
        </ul>
        <label className="login-page-label">
          Email
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-page-input"
          />
        </label>
        <label className="login-page-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-page-input"
          />
        </label>
        <button type="submit" className="login-page-button">Log In</button>
      </form>
    </div>
  );
}

export default LoginFormPage;
