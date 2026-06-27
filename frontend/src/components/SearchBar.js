import React from 'react';

function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input
      className="search-bar"
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default SearchBar;
