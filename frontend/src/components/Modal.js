import React, { useEffect } from 'react';

let openModalCount = 0;

function Modal({ title, subtitle, onClose, children, wide, className = '', heroBg, heroTextColor, heroContent }) {
  const hasHero = Boolean(heroBg);

  useEffect(() => {
    openModalCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? ' modal-wide' : ''}${hasHero ? ' modal-has-hero' : ''}${className ? ' ' + className : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHero ? (
          <>
            <div className="modal-hero" style={{ background: heroBg, color: heroTextColor || 'inherit' }}>
              <div className="modal-header">
                <div className="modal-header-text">
                  <h3>{title}</h3>
                  {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                </div>
                <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
              </div>
              {heroContent && <div className="modal-hero-content">{heroContent}</div>}
            </div>
            {children && <div className="modal-body">{children}</div>}
          </>
        ) : (
          <>
            <div className="modal-header">
              <div className="modal-header-text">
                <h3>{title}</h3>
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
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
