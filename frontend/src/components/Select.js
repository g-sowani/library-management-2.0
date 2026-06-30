import React, { useState, useRef, useEffect } from 'react';

function Select({ value, onChange, children, className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = React.Children.toArray(children).map(child => ({
    value: child.props.value ?? '',
    label: child.props.children,
  }));

  const strVal = String(value ?? '');
  const selected = options.find(o => String(o.value) === strVal);

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function pick(val) {
    onChange({ target: { value: val } });
    setOpen(false);
  }

  return (
    <div
      className={`custom-select${open ? ' custom-select-open' : ''}${className ? ' ' + className : ''}`}
      ref={ref}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <span className="custom-select-value">{selected ? selected.label : ''}</span>
        <svg className="custom-select-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 3.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-dropdown">
          {options.map((opt, i) => (
            <div
              key={`${opt.value}-${i}`}
              className={`custom-select-option${String(opt.value) === strVal ? ' custom-select-option-active' : ''}`}
              onMouseDown={() => pick(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Select;
