import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftIcon, ArrowRightIcon } from "./Icons";

const QUEUE_SPACING = 108; // px between neighbouring books in the queue
const QUEUE_DEPTH = 77; // px each step recedes into the screen
const QUEUE_ANGLE = 24; // deg each step turns to face the focused book
const DRAG_UNIT = QUEUE_SPACING;
const OPEN_MS = 600;

function angleFor(delta) {
  return delta * -QUEUE_ANGLE;
}
function xFor(delta) {
  return delta * QUEUE_SPACING;
}
function depthFor(delta) {
  return -Math.abs(delta) * QUEUE_DEPTH;
}
function scaleFor(delta) {
  const d = Math.abs(delta);
  if (d === 0) return 1.14;
  if (d === 1) return 0.96;
  if (d === 2) return 0.85;
  if (d === 3) return 0.76;
  return Math.max(0.6, 0.76 - (d - 3) * 0.06);
}
function liftFor(delta) {
  return delta === 0 ? -14 : 0;
}
function opacityFor(delta) {
  const d = Math.abs(delta);
  if (d <= 4) return 1;
  if (d <= 6) return Math.max(0, 1 - (d - 4) * 0.5);
  return 0;
}

function shade(hex, amt) {
  if (!hex) return null;
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  if (c.length !== 6) return null;
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return null;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 255) * (1 + amt));
  const g = clamp(((num >> 8) & 255) * (1 + amt));
  const b = clamp((num & 255) * (1 + amt));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const FALLBACK_COVER_A = "#4a4038";
const FALLBACK_COVER_B = "#1c1712";
const FALLBACK_DESCRIPTION =
  "No synopsis has been added for this title yet — check back soon, or open it in the full catalogue for borrowing details.";

function coverTones(book) {
  const a = book.cover_color || FALLBACK_COVER_A;
  const b = shade(book.cover_color, -0.6) || FALLBACK_COVER_B;
  return { a, b };
}

function BookCarousel({ books }) {
  const [focus, setFocusState] = useState(0);
  const [openIndex, setOpenIndex] = useState(null);
  const [activeGenre, setActiveGenre] = useState(null);

  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const plateRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragBaseFocusRef = useRef(0);
  const lastWheelRef = useRef(0);
  const lastTriggerRef = useRef(null);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const genres = useMemo(() => {
    const seen = [];
    books.forEach((b) => {
      if (b.genre && seen.indexOf(b.genre) === -1) seen.push(b.genre);
    });
    return seen;
  }, [books]);

  const setFocus = useCallback(
    (i) => {
      const clamped = Math.max(0, Math.min(books.length - 1, i));
      setFocusState(clamped);
    },
    [books.length]
  );

  const isMobile = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;

  const onCardActivate = (i) => {
    if (openIndex !== null) return;
    if (isMobile()) {
      openDetail(i);
      return;
    }
    if (i === focus) openDetail(i);
    else setFocus(i);
  };

  const onCardEnter = (i) => {
    if (draggingRef.current || openIndex !== null || isMobile()) return;
    setFocus(i);
  };

  // ── Keyboard ────────────────────────────────────────────────────────────
  const onStageKeyDown = (e) => {
    if (openIndex !== null) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocus(focus - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocus(focus + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocus(books.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(focus);
    }
  };

  // ── Drag-to-browse ──────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (isMobile() || openIndex !== null) return;
    if (e.target.closest(".landing-carousel-cover")) return;
    draggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragBaseFocusRef.current = focus;
    stageRef.current?.classList.add("is-dragging");
    stageRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    const shift = Math.round(-dx / DRAG_UNIT);
    const target = dragBaseFocusRef.current + shift;
    setFocus(target);
  };
  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    stageRef.current?.classList.remove("is-dragging");
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* noop */
    }
  };
  const onWheel = (e) => {
    if (isMobile() || openIndex !== null) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    if (Math.abs(dx) < 12) return;
    const now = Date.now();
    if (now - lastWheelRef.current < 320) return;
    lastWheelRef.current = now;
    e.preventDefault();
    setFocus(focus + (dx > 0 ? 1 : -1));
  };

  // ── Detail open/close (FLIP) ────────────────────────────────────────────
  const openDetail = (i) => {
    const cover = cardRefs.current[i]?.querySelector(".landing-carousel-cover");
    const plate = plateRef.current;
    if (!cover || !plate) return;
    const rect = cover.getBoundingClientRect();
    lastTriggerRef.current = cover;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const finalW = Math.min(860, vw - 48);
    const finalH = Math.min(520, vh - 64);
    const finalL = (vw - finalW) / 2;
    const finalT = (vh - finalH) / 2;

    plate.style.transition = "none";
    plate.style.left = `${rect.left}px`;
    plate.style.top = `${rect.top}px`;
    plate.style.width = `${rect.width}px`;
    plate.style.height = `${rect.height}px`;
    plate.style.transform = reduceMotion ? "none" : "rotateY(-16deg) scale(0.95)";

    setOpenIndex(i);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dur = reduceMotion ? 90 : OPEN_MS;
        plate.style.transition = [
          `left ${dur}ms cubic-bezier(0.19,1,0.22,1)`,
          `top ${dur}ms cubic-bezier(0.19,1,0.22,1)`,
          `width ${dur}ms cubic-bezier(0.19,1,0.22,1)`,
          `height ${dur}ms cubic-bezier(0.19,1,0.22,1)`,
          `transform ${dur}ms cubic-bezier(0.19,1,0.22,1)`,
        ].join(", ");
        plate.style.left = `${finalL}px`;
        plate.style.top = `${finalT}px`;
        plate.style.width = `${finalW}px`;
        plate.style.height = `${finalH}px`;
        plate.style.transform = "rotateY(0deg) scale(1)";
        plate.classList.add("is-open");
      });
    });
  };

  const closeDetail = useCallback(() => {
    if (openIndex === null) return;
    const plate = plateRef.current;
    const cover = cardRefs.current[openIndex]?.querySelector(".landing-carousel-cover");
    plate?.classList.remove("is-open");

    if (plate && cover) {
      const rect = cover.getBoundingClientRect();
      plate.style.left = `${rect.left}px`;
      plate.style.top = `${rect.top}px`;
      plate.style.width = `${rect.width}px`;
      plate.style.height = `${rect.height}px`;
      plate.style.transform = reduceMotion ? "none" : "rotateY(16deg) scale(0.95)";
    } else if (plate) {
      plate.style.opacity = "0";
    }

    const dur = reduceMotion ? 100 : OPEN_MS + 20;
    window.setTimeout(() => {
      setOpenIndex(null);
      lastTriggerRef.current?.focus();
    }, dur);
  }, [openIndex, reduceMotion]);

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeDetail();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openIndex, closeDetail]);

  useEffect(() => {
    const onResize = () => {
      if (openIndex !== null) closeDetail();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openIndex, closeDetail]);

  const selectGenre = (genre) => {
    setActiveGenre(genre);
    if (!genre) return;
    const idx = books.findIndex((b) => b.genre === genre);
    if (idx !== -1) setFocus(idx);
  };

  if (!books.length) return null;

  const focused = books[focus];
  const openBook = openIndex !== null ? books[openIndex] : null;

  return (
    <>
      <div className="landing-carousel-root">
        <div
          className="landing-carousel-stage-wrap"
        tabIndex={0}
        role="group"
        aria-label="Book carousel. Use left and right arrow keys to browse, Enter to open."
        onKeyDown={onStageKeyDown}
      >
        <div
          className="landing-carousel-stage"
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          {books.map((book, i) => {
            const delta = i - focus;
            const isFocused = delta === 0;
            return (
              <div
                key={book.id}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`landing-carousel-card${isFocused ? " is-focused" : ""}`}
                style={{
                  transform: `translateX(${xFor(delta)}px) translateZ(${depthFor(
                    delta
                  )}px) rotateY(${angleFor(delta)}deg)`,
                  zIndex: 50 - Math.abs(delta),
                  opacity: opacityFor(delta),
                  pointerEvents: opacityFor(delta) < 0.05 ? "none" : "auto",
                }}
              >
                <div
                  className="landing-carousel-card-inner"
                  style={{
                    transform: `translateY(${liftFor(delta)}px) scale(${scaleFor(delta)})`,
                  }}
                >
                  <button
                    type="button"
                    className="landing-carousel-cover"
                    onClick={() => onCardActivate(i)}
                    onMouseEnter={() => onCardEnter(i)}
                    aria-label={`${book.title} by ${book.author}${
                      isFocused ? ". Open details." : ". Bring to center."
                    }`}
                    style={{ "--cover-a": coverTones(book).a, "--cover-b": coverTones(book).b }}
                  >
                    {book.cover_url ? (
                      <img src={book.cover_url} alt="" draggable={false} />
                    ) : (
                      <>
                        {book.genre && (
                          <div className="landing-carousel-cover-genre">{book.genre}</div>
                        )}
                        <div className="landing-carousel-cover-text">
                          <div className="landing-carousel-cover-title">{book.title}</div>
                          <div className="landing-carousel-cover-author">{book.author}</div>
                        </div>
                      </>
                    )}
                  </button>
                  <div
                    className="landing-carousel-reflection"
                    aria-hidden="true"
                    style={{
                      backgroundImage: book.cover_url
                        ? `url(${book.cover_url})`
                        : `linear-gradient(200deg, ${coverTones(book).a}, ${coverTones(book).b})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="landing-carousel-arrow prev"
          onClick={() => setFocus(focus - 1)}
          disabled={focus === 0}
          aria-label="Previous book"
        >
          <ArrowLeftIcon size={17} />
        </button>
        <button
          type="button"
          className="landing-carousel-arrow next"
          onClick={() => setFocus(focus + 1)}
          disabled={focus === books.length - 1}
          aria-label="Next book"
        >
          <ArrowRightIcon size={17} />
        </button>
      </div>

      <div className="landing-carousel-caption">
        <div className="landing-carousel-caption-title">{focused.title}</div>
        <div className="landing-carousel-caption-meta">
          {focused.author}
          {focused.genre ? ` · ${focused.genre}` : ""}
          <span className="landing-carousel-caption-count">
            {focus + 1} / {books.length}
          </span>
        </div>
      </div>

      {genres.length > 1 && (
        <div className="landing-carousel-genre-row">
          <button
            type="button"
            className={`landing-carousel-genre-pill${activeGenre === null ? " is-active" : ""}`}
            onClick={() => selectGenre(null)}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              className={`landing-carousel-genre-pill${activeGenre === g ? " is-active" : ""}`}
              onClick={() => selectGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      </div>

      {createPortal(
        <>
          <div
            className={`landing-carousel-backdrop${openIndex !== null ? " is-open" : ""}`}
            onClick={closeDetail}
            aria-hidden="true"
          />
          <div className="landing-carousel-detail-viewport" aria-hidden={openIndex === null}>
            <div
              className={`landing-carousel-detail-plate${openIndex !== null ? " is-active" : ""}`}
              ref={plateRef}
            >
              <button
                type="button"
                className="landing-carousel-detail-close"
                onClick={closeDetail}
                aria-label="Close"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {openBook && (
                <>
                  <div
                    className="landing-carousel-detail-cover"
                    style={{
                      "--cover-a": coverTones(openBook).a,
                      "--cover-b": coverTones(openBook).b,
                    }}
                  >
                    {openBook.cover_url ? (
                      <img src={openBook.cover_url} alt="" draggable={false} />
                    ) : (
                      <>
                        <div className="landing-carousel-cover-genre">
                          {openBook.genre || ""}
                        </div>
                        <div className="landing-carousel-detail-cover-title">
                          {openBook.title}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="landing-carousel-detail-text">
                    {openBook.genre && (
                      <div className="landing-carousel-detail-tag">{openBook.genre}</div>
                    )}
                    <div className="landing-carousel-detail-title">{openBook.title}</div>
                    <div className="landing-carousel-detail-author">by {openBook.author}</div>
                    <hr className="landing-carousel-detail-rule" />
                    <p className="landing-carousel-detail-desc">
                      {openBook.description || FALLBACK_DESCRIPTION}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default BookCarousel;
