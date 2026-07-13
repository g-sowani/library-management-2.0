import React from "react";
import Modal from "../../../../components/Modal";
import ActionMenu from "../../../../components/ActionMenu";
import NoCoverPlaceholder from "../../../../components/NoCoverPlaceholder";

function BookDetailModal({
  book,
  onClose,
  coverPalette,
  heroCssVars,
  heroRowStyle,
  heroLabelStyle,
  heroSubtleStyle,
  heroFaintStyle,
  bookReviews,
  bioExpanded,
  setBioExpanded,
  authorBioTruncated,
  bookDetailMenuOpen,
  setBookDetailMenuOpen,
  bookDetailMenuRef,
  onOpenCoverUpload,
  onEdit,
  onOpenLogs,
  onRefreshMeta,
  refreshingAll,
  refreshingBookId,
  onShowRefreshLog,
  onDelete,
  onOpenAiGen,
  onOpenManualEdit,
}) {
  return (
    <Modal
      title={book.title}
      onClose={onClose}
      wide
      heroBg={coverPalette?.bg ?? "var(--bg-raised)"}
      heroTextColor={coverPalette?.text ?? "var(--text)"}
      heroContent={
        <div className="book-detail-header" style={heroCssVars}>
          {book.cover_url ? (
            <div className="admin-cover-slot">
              <img
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="book-cover-img"
              />
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onOpenCoverUpload(book.id)}
              >
                Change cover
              </button>
            </div>
          ) : (
            <div className="admin-cover-slot">
              <div className="book-cover-placeholder">
                <NoCoverPlaceholder title={book.title} />
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onOpenCoverUpload(book.id)}
              >
                + Add cover
              </button>
            </div>
          )}
          <div className="book-detail book-detail-meta">
            <div className="book-detail-row" style={heroRowStyle}>
              <span className="book-detail-label" style={heroLabelStyle}>
                Author
              </span>
              <span>{book.author}</span>
            </div>
            <div className="book-detail-row" style={heroRowStyle}>
              <span className="book-detail-label" style={heroLabelStyle}>
                Genre
              </span>
              <span>
                {book.genre || (
                  <span style={heroFaintStyle}>—</span>
                )}
              </span>
            </div>
            <div className="book-detail-row" style={heroRowStyle}>
              <span className="book-detail-label" style={heroLabelStyle}>
                ISBN-13
              </span>
              <span>{book.isbn}</span>
            </div>
            <div className="book-detail-row" style={heroRowStyle}>
              <span className="book-detail-label" style={heroLabelStyle}>
                Copies
              </span>
              <span>
                {book.available_copies} /{" "}
                {book.total_copies} available
                {book.available_copies === 0 &&
                  book.reservation_count > 0 && (
                    <span
                      style={{
                        ...heroFaintStyle,
                        marginLeft: 6,
                        fontSize: "0.8em",
                      }}
                    >
                      ({book.reservation_count} waiting)
                    </span>
                  )}
              </span>
            </div>
            <div
              className="book-detail-row"
              style={{ ...heroRowStyle, borderBottom: "none" }}
            >
              <span className="book-detail-label" style={heroLabelStyle}>
                Rating
              </span>
              <span>
                {bookReviews && bookReviews.rating_count > 0 ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span className="star-display">
                      {"★".repeat(Math.round(bookReviews.avg_rating))}
                      {"☆".repeat(5 - Math.round(bookReviews.avg_rating))}
                    </span>
                    <span
                      style={{ fontSize: "0.85rem", ...heroSubtleStyle }}
                    >
                      {bookReviews.avg_rating} / 5
                    </span>
                    <span
                      style={{ fontSize: "0.8rem", ...heroFaintStyle }}
                    >
                      · {bookReviews.rating_count}{" "}
                      {bookReviews.rating_count === 1
                        ? "rating"
                        : "ratings"}
                    </span>
                  </span>
                ) : (
                  <span style={heroFaintStyle}>No ratings yet</span>
                )}
              </span>
            </div>
            <div className="book-detail-action">
              <button
                className="btn btn-sm btn-icon btn-icon-ghost"
                onClick={() => {
                  onClose();
                  onEdit(book);
                }}
                aria-label="Edit book"
                title="Edit book"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
              <div className="action-menu-wrap">
                <button
                  className="btn btn-sm btn-icon btn-icon-ghost"
                  ref={bookDetailMenuRef}
                  onClick={() => setBookDetailMenuOpen((o) => !o)}
                  aria-label="More actions"
                  aria-expanded={bookDetailMenuOpen}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>
                <ActionMenu
                  open={bookDetailMenuOpen}
                  anchorRef={bookDetailMenuRef}
                  onClose={() => setBookDetailMenuOpen(false)}
                >
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setBookDetailMenuOpen(false);
                      onClose();
                      onOpenLogs(book);
                    }}
                  >
                    Logs
                  </button>
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setBookDetailMenuOpen(false);
                      refreshingBookId === book.id
                        ? onShowRefreshLog()
                        : onRefreshMeta(book.id);
                    }}
                    disabled={refreshingAll}
                  >
                    {refreshingBookId === book.id
                      ? "Refreshing…"
                      : "Refresh metadata"}
                  </button>
                  <div className="action-menu-divider" />
                  <button
                    className="action-menu-item action-menu-danger"
                    onClick={() => {
                      setBookDetailMenuOpen(false);
                      onClose();
                      onDelete(book.id);
                    }}
                  >
                    Delete
                  </button>
                </ActionMenu>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {book.description ? (
        <div className="enrichment-section">
          <div className="enrichment-label-row">
            <span className="enrichment-label">About this book</span>
            <button
              className="btn-link"
              onClick={() => onOpenAiGen(book.id, "description")}
            >
              Edit
            </button>
          </div>
          <p className="enrichment-text">{book.description}</p>
        </div>
      ) : (
        <div className="enrichment-section">
          <div className="enrichment-label">About this book</div>
          <p className="enrichment-text muted">No description yet.</p>
          <div className="btn-row">
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                onOpenManualEdit(book.id, "description")
              }
            >
              Write manually
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onOpenAiGen(book.id, "description")}
            >
              Generate with AI
            </button>
          </div>
        </div>
      )}
      {book.author_bio ? (
        <div className="enrichment-section">
          <div className="enrichment-label-row">
            <span className="enrichment-label">About the author</span>
            <button
              className="btn-link"
              onClick={() => onOpenAiGen(book.id, "author_bio")}
            >
              Edit
            </button>
          </div>
          <p className="enrichment-text">
            {bioExpanded || !authorBioTruncated
              ? book.author_bio
              : authorBioTruncated}
            {authorBioTruncated && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setBioExpanded((e) => !e)}
              >
                {bioExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="enrichment-section">
          <div className="enrichment-label">About the author</div>
          <p className="enrichment-text muted">No author bio yet.</p>
          <div className="btn-row">
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                onOpenManualEdit(book.id, "author_bio")
              }
            >
              Write manually
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onOpenAiGen(book.id, "author_bio")}
            >
              Generate with AI
            </button>
          </div>
        </div>
      )}

      {bookReviews && bookReviews.reviews.length > 0 && (
        <div className="reviews-section">
          <div className="reviews-header">Reviews</div>
          {bookReviews.reviews.map((r) => (
            <div key={r.id} className="review-item">
              <div className="review-meta">
                <span className="review-author">{r.reviewer}</span>
                <span className="review-stars">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
                <span className="review-date">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.review_text && (
                <p className="review-text">{r.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {bookReviews && bookReviews.reviews.length === 0 && (
        <div className="reviews-section">
          <div className="reviews-header">Reviews</div>
          <div className="empty" style={{ padding: "20px 0" }}>
            No reviews yet.
          </div>
        </div>
      )}
    </Modal>
  );
}

export default BookDetailModal;
