import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAccount, updateAccount } from "../../store/account";
import './Account.css';

function Account() {
  const dispatch = useDispatch();
  const account = useSelector((state) => state.account.account);
  const [username, setUsername] = useState(account?.username || "");
  const [email, setEmail] = useState(account?.email || "");
  const [bio, setBio] = useState(account?.bio || "");
  const [profilePicture, setProfilePicture] = useState(account?.profile_picture || "");

  useEffect(() => {
    dispatch(fetchAccount());
  }, [dispatch]);

  useEffect(() => {
    if (account) {
      setUsername(account.username);
      setEmail(account.email);
      setBio(account.bio);
      setProfilePicture(account.profile_picture);
    }
  }, [account]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedData = { username, email, bio, profile_picture: profilePicture };
    dispatch(updateAccount(updatedData));
  };

  if (!account) {
    return <div>Loading...</div>;
  }

  return (
    <div className="account-container">
      <h1 className="account-title">Your Account</h1>
      <div className="account-content">
        <div className="account-info">
          <img
            src={profilePicture || "/default-profile.png"}
            alt="Profile"
            className="account-profile-picture"
          />
          <h2>{username}</h2>
          <p>{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="account-form">
          <label className="account-label">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="account-input"
              required
            />
          </label>
          <label className="account-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="account-input"
              required
            />
          </label>
          <label className="account-label">
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="account-textarea"
            />
          </label>
          <label className="account-label">
            Profile Picture URL
            <input
              type="text"
              value={profilePicture}
              onChange={(e) => setProfilePicture(e.target.value)}
              className="account-input"
            />
          </label>
          <button type="submit" className="account-button">Update Account</button>
        </form>
      </div>
    </div>
  );
}

export default Account;