import React, { useState } from "react";
import { signUp } from "../../store/session";
import { useDispatch } from "react-redux";
import { useModal } from "../../context/Modal";
import "./SingUpFormModal.css";

function SignUpFormModal() {
  const dispatch = useDispatch();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const { closeModal } = useModal();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password === confirmPassword) {
      const data = await dispatch(signUp(username, email, password));
      if (data) {
        setErrors(data);
      } else {
        closeModal();
      }
    } else {
      setErrors(['Passwords do not match']);
    }
  };

  return (
    <div className="signup-modal">
      <h1 className="signup-modal-title">Sign Up</h1>
      <form onSubmit={handleSubmit} className="signup-modal-form">
        <ul className="signup-modal-errors">
          {errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
        <label className="signup-modal-label">
          Username
          <input
            type="text"
            className="signup-modal-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="signup-modal-label">
          Email
          <input
            type="text"
            className="signup-modal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="signup-modal-label">
          Password
          <input
            type="password"
            className="signup-modal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="signup-modal-label">
          Confirm Password
          <input
            type="password"
            className="signup-modal-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="signup-modal-button">Sign Up</button>
      </form>
    </div>
  );
}

export default SignUpFormModal;