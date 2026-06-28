import React from 'react';

function TopBar({ title, username, onLogout, badge }) {
  return (
    <div className="topbar">
      <h2>{title}</h2>
      <div className="topbar-right">
        <span>{username}</span>
        {badge}
        <button className="btn btn-outline btn-sm" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default TopBar;
