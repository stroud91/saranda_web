"use client";
import { useState } from 'react';
// import styles from './SearchBar.module.css';

const SearchBar = () => {
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const handleSearch = () => {
    // Perform search action
    console.log(`Searching for ${location} on ${date}`);
  };

  return (
    <div className={styles.searchBar}>
      <input
        type="text"
        placeholder="Where are you going?"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>
    </div>
  );
};

export default SearchBar;