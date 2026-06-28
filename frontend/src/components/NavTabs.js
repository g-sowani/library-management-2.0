import React from 'react';

function NavTabs({ tabs, active, onChange, badges = {} }) {
  return (
    <div className="nav-tabs">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          className={`nav-tab ${active === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
          {badges[id] > 0 && (
            <span className="nav-tab-badge">{badges[id] > 99 ? '99+' : badges[id]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default NavTabs;
