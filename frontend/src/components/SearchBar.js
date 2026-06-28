import React from 'react';

function SearchBar({ value, onChange, placeholder = 'Search…', className = '', autoFocus = false }) {
  return (
    <input
      className={`search-bar${className ? ' ' + className : ''}`}
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}

export default SearchBar;
