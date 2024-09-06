import React, { useState } from "react";
import { login } from "../../store/session";
import { useDispatch } from "react-redux";
import { useModal } from "../../context/Modal";
import "./LoginForm.css";

function LoginFormModal() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const { closeModal } = useModal();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await dispatch(login(email, password));
    if (data) {
      setErrors(data);
    } else {
        closeModal()
    }
  };

  return (
    <div className="login-modal-container">
      <h1 className="login-modal-title">Log In</h1>
      <form onSubmit={handleSubmit} className="login-modal-form">
        <ul className="login-modal-errors">
          {errors.map((error, idx) => (
            <li key={idx} className="login-modal-error">{error}</li>
          ))}
        </ul>
        <label className="login-modal-label">
          Email
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-modal-input"
          />
        </label>
        <label className="login-modal-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-modal-input"
          />
        </label>
        <button type="submit" className="login-modal-button">Log In</button>
      </form>
    </div>
  );
}

export default LoginFormModal;
