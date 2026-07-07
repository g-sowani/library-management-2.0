import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

const MARGIN = 8;

// Portal-based dropdown anchored to a trigger button. Renders into document.body
// (position: fixed) and clamps itself to the viewport so it can never render
// partially off-screen, regardless of where the trigger sits or whether an
// ancestor has a transform (which would otherwise break plain absolute
// positioning's escape from the viewport).
function ActionMenu({ open, anchorRef, onClose, children }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || 190;
    const menuHeight = menuEl?.offsetHeight || 160;

    let left = anchorRect.right - menuWidth;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - menuWidth - MARGIN));

    let top = anchorRect.bottom + 8;
    if (top + menuHeight > window.innerHeight - MARGIN) {
      top = anchorRect.top - menuHeight - 8;
    }

    setPos({ top, left });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        !anchorRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="action-menu"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default ActionMenu;
