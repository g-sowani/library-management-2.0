import React from 'react';

function SearchBar({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <input
      className={`search-bar${className ? ' ' + className : ''}`}
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default SearchBar;
