import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAccount, updateAccount } from "../../store/account";

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
    <div>
      <h1>Your Account</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label>
          Profile Picture URL
          <input
            type="text"
            value={profilePicture}
            onChange={(e) => setProfilePicture(e.target.value)}
          />
        </label>
        <button type="submit">Update Account</button>
      </form>
    </div>
  );
}

export default Account;