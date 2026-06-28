import React from 'react';

function UserAvatar({ avatar, username, size = 32 }) {
  const initials = username ? username[0].toUpperCase() : '?';
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        className="user-avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="user-avatar user-avatar-initials"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </div>
  );
}

export default UserAvatar;
