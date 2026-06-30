import React from 'react';

const VARIANT_CLASS = {
  active: 'badge-active',
  overdue: 'badge-overdue',
  returned: 'badge-returned',
  queue: 'badge-queue',
};

function Badge({ variant, children }) {
  return (
    <span className={`badge ${VARIANT_CLASS[variant] || ''}`}>
      {children}
    </span>
  );
}

export default Badge;
