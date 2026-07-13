import React from "react";
import NoCoverPlaceholder from "../../../../components/NoCoverPlaceholder";

function BooksGrid({ books, onOpenBookDetail, renderBookActions }) {
  return (
    <div className="books-grid admin-books-grid">
      {books.map((b) => {
        const stars = b.avg_rating ? Math.round(b.avg_rating) : 0;
        const missing = [
          !b.description && "description",
          !b.author_bio && "author bio",
          !b.cover_url && "cover",
        ].filter(Boolean);
        return (
          <div
            key={b.id}
            className="rec-card admin-book-card"
            onClick={() => onOpenBookDetail(b.id)}
            role="button"
            tabIndex={0}
          >
            <div className="admin-card-cover-wrap">
              {b.cover_url ? (
                <img
                  src={b.cover_url}
                  alt=""
                  className="rec-card-cover"
                />
              ) : (
                <NoCoverPlaceholder
                  title={b.title}
                  className="rec-card-cover"
                />
              )}
              {missing.length > 0 && (
                <span
                  className="admin-missing-badge"
                  title={`Missing: ${missing.join(", ")}`}
                >
                  Incomplete
                </span>
              )}
            </div>
            <div className="rec-card-title">{b.title}</div>
            <div className="rec-card-author">{b.author}</div>
            <div className="rec-card-meta">
              {b.genre && (
                <span className="rec-card-genre">{b.genre}</span>
              )}
              {b.rating_count > 0 && (
                <span className="rec-card-rating">
                  <span className="rec-stars">
                    {"★".repeat(stars)}
                    {"☆".repeat(5 - stars)}
                  </span>
                  <span className="rec-rating-val">
                    {b.avg_rating}
                  </span>
                </span>
              )}
            </div>
            <div className="admin-card-bottom-row">
              <div className="rec-card-avail">
                {b.available_copies} / {b.total_copies} available
              </div>
              <div
                className="admin-card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {renderBookActions(b)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BooksGrid;
