import React, { useEffect, useRef, useState } from "react";
import ChevronLeft from "./icons/ChevronLeft";
import ChevronRight from "./icons/ChevronRight";

function BookStrip({ children }) {
  const ref = useRef(null);
  const timerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const scroll = (dir) => {
    ref.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), 2000);
  };

  return (
    <div
      className={`book-strip-wrapper${
        active && overflows ? " arrows-active" : ""
      }`}
      onMouseEnter={() => {
        if (overflows) {
          clearTimeout(timerRef.current);
          setActive(true);
        }
      }}
      onMouseLeave={() => {
        clearTimeout(timerRef.current);
        setActive(false);
      }}
    >
      {overflows && (
        <button
          className="strip-arrow strip-arrow-left"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          <ChevronLeft />
        </button>
      )}
      <div className="rec-strip" ref={ref}>
        {children}
      </div>
      {overflows && (
        <button
          className="strip-arrow strip-arrow-right"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

export default BookStrip;
