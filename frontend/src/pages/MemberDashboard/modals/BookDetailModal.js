import React from "react";
import Modal from "../../../components/Modal";
import StarDisplay from "../../../components/StarDisplay";

function BookActionButton({
  book,
  reservedBooks,
  borrowedBookIds,
  activeBorrows,
  onCloseBook,
  onOpenReturnModal,
  onBorrow,
  onReserve,
}) {
  const res = reservedBooks[book.id];
  const isBorrowed = borrowedBookIds.has(book.id);

  if (isBorrowed) {
    const activeBorrow = activeBorrows.find((b) => b.book_id === book.id);
    if (activeBorrow?.return_requested_at) {
      return (
        <button className="btn btn-outline" disabled>
          Return Requested
        </button>
      );
    }
    return (
      <button
        className="btn btn-outline"
        onClick={() => {
          onCloseBook();
          onOpenReturnModal(activeBorrow);
        }}
      >
        Return
      </button>
    );
  }
  if (book.available_copies > 0) {
    return (
      <button className="btn" onClick={() => onBorrow(book.id)}>
        Borrow
      </button>
    );
  }
  if (res) {
    if (res.status === "ready") {
      return (
        <button className="btn" onClick={() => onBorrow(book.id)}>
          Borrow (Ready)
        </button>
      );
    }
    return (
      <button className="btn" disabled>
        Reserved #{res.queue_position}
      </button>
    );
  }
  return (
    <button className="btn btn-outline" onClick={() => onReserve(book.id)}>
      Reserve
    </button>
  );
}

function BookDetailModal({
  book,
  onClose,
  coverPalette,
  heroCssVars,
  heroRowStyle,
  heroLabelStyle,
  heroSubtleStyle,
  heroFaintStyle,
  heroErrorColor,
  bookReviews,
  actionError,
  borrowedBookIds,
  wishlistIds,
  wishlistLoading,
  onToggleWishlist,
  reservedBooks,
  activeBorrows,
  onOpenReturnModal,
  onBorrow,
  onReserve,
}) {
  return (
    <Modal
      title={book.title}
      onClose={onClose}
      wide
      heroBg={coverPalette?.bg ?? "var(--bg-raised)"}
      heroTextColor={coverPalette?.text ?? "var(--text)"}
      heroContent={
        <>
          <div className="book-detail-header" style={heroCssVars}>
            {book.cover_url && (
              <img
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="book-cover-img"
              />
            )}
            <div className="book-detail book-detail-meta">
              <div className="book-detail-row" style={heroRowStyle}>
                <span
                  className="book-detail-label"
                  style={heroLabelStyle}
                >
                  Author
                </span>
                <span>{book.author}</span>
              </div>
              <div className="book-detail-row" style={heroRowStyle}>
                <span
                  className="book-detail-label"
                  style={heroLabelStyle}
                >
                  Genre
                </span>
                <span>
                  {book.genre || (
                    <span style={heroFaintStyle}>—</span>
                  )}
                </span>
              </div>
              <div className="book-detail-row" style={heroRowStyle}>
                <span
                  className="book-detail-label"
                  style={heroLabelStyle}
                >
                  Available
                </span>
                <span>
                  {book.available_copies} /{" "}
                  {book.total_copies}
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
                <span
                  className="book-detail-label"
                  style={heroLabelStyle}
                >
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
                      <StarDisplay rating={bookReviews.avg_rating} />
                      <span
                        style={{
                          fontSize: "0.85rem",
                          ...heroSubtleStyle,
                        }}
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
                <BookActionButton
                  book={book}
                  reservedBooks={reservedBooks}
                  borrowedBookIds={borrowedBookIds}
                  activeBorrows={activeBorrows}
                  onCloseBook={onClose}
                  onOpenReturnModal={onOpenReturnModal}
                  onBorrow={onBorrow}
                  onReserve={onReserve}
                />
                {!borrowedBookIds.has(book.id) && (
                  <button
                    className={`btn${
                      wishlistIds.has(book.id)
                        ? ""
                        : " btn-outline"
                    }`}
                    onClick={() => onToggleWishlist(book.id)}
                    disabled={wishlistLoading}
                    title={
                      wishlistIds.has(book.id)
                        ? "Remove from wishlist"
                        : "Add to wishlist"
                    }
                  >
                    {wishlistIds.has(book.id)
                      ? "♥ Wishlisted"
                      : "♡ Wishlist"}
                  </button>
                )}
              </div>
              {actionError && (
                <div
                  className="error"
                  style={
                    heroErrorColor
                      ? {
                          marginTop: 12,
                          color: heroErrorColor,
                          borderColor: heroErrorColor,
                          background: "transparent",
                        }
                      : { marginTop: 12 }
                  }
                >
                  {actionError}
                </div>
              )}
            </div>
          </div>
        </>
      }
    >
      {/* Description + author bio below the colored hero zone */}
      {book.description && (
        <div className="enrichment-section">
          <div className="enrichment-label">About this book</div>
          <p className="enrichment-text">{book.description}</p>
        </div>
      )}
      {book.author_bio && (
        <div className="enrichment-section">
          <div className="enrichment-label">About the author</div>
          <p className="enrichment-text">{book.author_bio}</p>
        </div>
      )}

      {/* Reviews list */}
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
            No reviews yet. Be the first to review after borrowing!
          </div>
        </div>
      )}
    </Modal>
  );
}

export default BookDetailModal;
