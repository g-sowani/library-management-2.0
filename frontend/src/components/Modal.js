import React from 'react';

function Modal({ title, onClose, children, wide, heroBg, heroTextColor, heroContent }) {
  const hasHero = Boolean(heroBg);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? ' modal-wide' : ''}${hasHero ? ' modal-has-hero' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHero ? (
          <>
            <div className="modal-hero" style={{ background: heroBg, color: heroTextColor || 'inherit' }}>
              <div className="modal-header">
                <h3>{title}</h3>
                <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
              </div>
              {heroContent && <div className="modal-hero-content">{heroContent}</div>}
            </div>
            {children && <div className="modal-body">{children}</div>}
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3>{title}</h3>
              <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
            </div>
            {children}
          </>
        )}
      </div>
    </div>
  );
}

export default Modal;
