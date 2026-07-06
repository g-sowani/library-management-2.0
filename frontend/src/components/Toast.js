import React from 'react';

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          {t.action && (
            <button className="toast-action" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
