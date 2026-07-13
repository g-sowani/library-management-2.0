import React from "react";
import NoCoverPlaceholder from "../../../../components/NoCoverPlaceholder";

function BooksListView({ books, onOpenBookDetail, renderBookActions }) {
  return (
    <div className="admin-book-list">
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
            className="admin-list-row"
            onClick={() => onOpenBookDetail(b.id)}
            role="button"
            tabIndex={0}
          >
            <div className="admin-list-cover">
              {b.cover_url ? (
                <img src={b.cover_url} alt="" />
              ) : (
                <NoCoverPlaceholder title={b.title} />
              )}
              {missing.length > 0 && (
                <span
                  className="admin-missing-dot"
                  title={`Missing: ${missing.join(", ")}`}
                />
              )}
            </div>
            <div className="admin-list-info">
              <div className="admin-list-title">{b.title}</div>
              <div className="admin-list-author">{b.author}</div>
            </div>
            <div className="admin-list-genre">
              {b.genre || <span className="muted">—</span>}
            </div>
            <div className="admin-list-rating">
              {b.rating_count > 0 ? (
                <>
                  <span className="rec-stars">
                    {"★".repeat(stars)}
                    {"☆".repeat(5 - stars)}
                  </span>
                  <span className="rec-rating-val">
                    {b.avg_rating}
                  </span>
                </>
              ) : (
                <span className="muted">No ratings</span>
              )}
            </div>
            <div className="admin-list-avail">
              {b.available_copies} / {b.total_copies} available
            </div>
            <div
              className="admin-list-actions"
              onClick={(e) => e.stopPropagation()}
            >
              {renderBookActions(b)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BooksListView;
