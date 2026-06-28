import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/TopBar";
import NavTabs from "../components/NavTabs";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";

const TABS = [
  { id: "books", label: "Available Books" },
  { id: "borrowed", label: "My Books" },
  { id: "fines", label: "Fines" },
];

function StarPicker({ value, hover, onRate, onHover, onLeave }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star ${star <= (hover || value) ? "star-filled" : ""}`}
          onClick={() => onRate(value === star ? 0 : star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          title={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating }) {
  const rounded = Math.round(rating);
  return (
    <span className="star-display">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

function MemberDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [collabRecs, setCollabRecs] = useState([]);
  const [trending, setTrending] = useState([]);

  // Book detail modal
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [bookReviews, setBookReviews] = useState(null);

  // Return + review modal
  const [returnModal, setReturnModal] = useState(null); // { borrowId, bookTitle }
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);

  const selectedBook = books.find((b) => b.id === selectedBookId) || null;

  const load = useCallback(() => {
    setError("");
    Promise.all([
      api.get("/books").then((r) => setBooks(r.data)),
      api.get("/my-borrows").then((r) => setBorrows(r.data)),
      api.get("/my-fines").then((r) => setFines(r.data)),
      api.get("/my-reservations").then((r) => setReservations(r.data)),
      api
        .get("/recommendations")
        .then((r) => setRecommendations(r.data))
        .catch(() => {}),
      api
        .get("/collaborative-recommendations")
        .then((r) => setCollabRecs(r.data))
        .catch(() => {}),
      api
        .get("/trending")
        .then((r) => setTrending(r.data))
        .catch(() => {}),
    ]).catch(() => setError("Failed to load data. Is the server running?"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch reviews whenever a book detail is opened
  useEffect(() => {
    if (!selectedBookId) {
      setBookReviews(null);
      return;
    }
    setBookReviews(null);
    api
      .get(`/books/${selectedBookId}/reviews`)
      .then((r) => setBookReviews(r.data))
      .catch(() =>
        setBookReviews({ avg_rating: null, rating_count: 0, reviews: [] })
      );
  }, [selectedBookId]);

  const openBook = (bookId) => {
    setSelectedBookId(bookId);
    setActionError("");
  };

  const closeBook = () => {
    setSelectedBookId(null);
    setActionError("");
  };

  const borrow = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/borrow/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to borrow book");
    }
  };

  const openReturnModal = (borrowId, bookTitle) => {
    setReturnModal({ borrowId, bookTitle });
    setReviewRating(0);
    setReviewHover(0);
    setReviewText("");
    setReviewAnonymous(false);
  };

  const closeReturnModal = () => setReturnModal(null);

  const handleReturn = async () => {
    const payload =
      reviewRating > 0
        ? {
            rating: reviewRating,
            review_text: reviewText.trim(),
            is_anonymous: reviewAnonymous,
          }
        : {};
    try {
      await api.post(
        `/return/${returnModal.borrowId}`,
        Object.keys(payload).length ? payload : undefined
      );
      setReturnModal(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to return book");
      setReturnModal(null);
    }
  };

  const reserve = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/reserve/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to reserve book");
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      await api.delete(`/cancel-reservation/${reservationId}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to cancel reservation");
    }
  };

  const activeBorrows = borrows.filter((b) => !b.return_date);
  const borrowedBookIds = new Set(activeBorrows.map((b) => b.book_id));
  const reservedBooks = Object.fromEntries(
    reservations.map((r) => [r.book_id, r])
  );

  const genreCounts = useMemo(() => {
    const counts = {};
    books.forEach((b) => {
      const g = b.genre || "Other";
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [books]);

  const availableGenres = useMemo(
    () => Object.keys(genreCounts).sort(),
    [genreCounts]
  );

  const filteredBooks = useMemo(
    () =>
      books.filter((b) => {
        const q = search.toLowerCase();
        const matchSearch =
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.genre || "").toLowerCase().includes(q);
        const matchGenre =
          !selectedGenre || (b.genre || "Other") === selectedGenre;
        const matchAvail =
          availFilter === "all" ||
          (availFilter === "available" && b.available_copies > 0) ||
          (availFilter === "unavailable" && b.available_copies === 0);
        const matchRating =
          ratingFilter === 0 || (b.avg_rating || 0) >= ratingFilter;
        return matchSearch && matchGenre && matchAvail && matchRating;
      }),
    [books, search, selectedGenre, availFilter, ratingFilter]
  );

  const trendingIds = useMemo(
    () => new Set(trending.map((b) => b.id)),
    [trending]
  );

  const hasActiveFilters =
    search || selectedGenre || availFilter !== "all" || ratingFilter > 0;

  const clearFilters = () => {
    setSearch("");
    setSelectedGenre("");
    setAvailFilter("all");
    setRatingFilter(0);
  };

  function BookActionButton({ book }) {
    const res = reservedBooks[book.id];
    const isBorrowed = borrowedBookIds.has(book.id);

    if (isBorrowed) {
      return (
        <button className="btn btn-sm" disabled>
          Borrowed
        </button>
      );
    }
    if (book.available_copies > 0) {
      return (
        <button className="btn btn-sm" onClick={() => borrow(book.id)}>
          Borrow
        </button>
      );
    }
    if (res) {
      if (res.status === "ready") {
        return (
          <button className="btn btn-sm" onClick={() => borrow(book.id)}>
            Borrow (Ready)
          </button>
        );
      }
      return (
        <button className="btn btn-sm" disabled>
          Reserved #{res.queue_position}
        </button>
      );
    }
    return (
      <button
        className="btn btn-sm btn-outline"
        onClick={() => reserve(book.id)}
      >
        Reserve
      </button>
    );
  }

  return (
    <div className="layout">
      <TopBar title="Library" username={user.username} onLogout={logout} />
      <NavTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="content">
        {error && <div className="error">{error}</div>}

        {tab === "books" && (
          <>
            <div className="section-header">
              <h3>Available Books</h3>
              {books.length > 0 && (
                <span className="book-count-label">
                  {filteredBooks.length === books.length
                    ? `${books.length} books`
                    : `${filteredBooks.length} of ${books.length} books`}
                </span>
              )}
            </div>

            {/* Trending This Week */}
            {trending.length > 0 && (
              <div className="rec-section">
                <div className="rec-heading trending-heading">
                  Trending This Week
                </div>
                <div className="rec-strip">
                  {trending.map((book) => {
                    const stars = book.avg_rating
                      ? Math.round(book.avg_rating)
                      : 0;
                    const n = book.borrow_count_week;
                    return (
                      <button
                        key={book.id}
                        className="rec-card rec-card-trending"
                        onClick={() => openBook(book.id)}
                      >
                        <div className="rec-card-reason">
                          {n} borrow{n !== 1 ? "s" : ""} this week
                        </div>
                        <div className="rec-card-title">{book.title}</div>
                        <div className="rec-card-author">{book.author}</div>
                        <div className="rec-card-meta">
                          {book.genre && (
                            <span className="rec-card-genre">{book.genre}</span>
                          )}
                          {book.avg_rating && (
                            <span className="rec-card-rating">
                              <span className="rec-stars">
                                {"★".repeat(stars)}
                                {"☆".repeat(5 - stars)}
                              </span>
                              <span className="rec-rating-val">
                                {book.avg_rating}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="rec-card-avail">
                          {book.available_copies > 0 ? (
                            `${book.available_copies} available`
                          ) : (
                            <span className="muted">Unavailable</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="rec-section">
                <div className="rec-heading">Recommended for you</div>
                <div className="rec-strip">
                  {recommendations.map((book) => {
                    const stars = book.avg_rating
                      ? Math.round(book.avg_rating)
                      : 0;
                    return (
                      <button
                        key={book.id}
                        className="rec-card"
                        onClick={() => openBook(book.id)}
                      >
                        <div className="rec-card-reason">{book.reason}</div>
                        <div className="rec-card-title">{book.title}</div>
                        <div className="rec-card-author">{book.author}</div>
                        <div className="rec-card-meta">
                          {book.genre && (
                            <span className="rec-card-genre">{book.genre}</span>
                          )}
                          {book.avg_rating && (
                            <span className="rec-card-rating">
                              <span className="rec-stars">
                                {"★".repeat(stars)}
                                {"☆".repeat(5 - stars)}
                              </span>
                              <span className="rec-rating-val">
                                {book.avg_rating}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="rec-card-avail">
                          {book.available_copies > 0 ? (
                            `${book.available_copies} available`
                          ) : (
                            <span className="muted">Unavailable</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collaborative recommendations */}
            {(() => {
              const contentIds = new Set(recommendations.map((r) => r.id));
              const dedupedCollab = collabRecs.filter(
                (r) => !contentIds.has(r.id)
              );
              if (!dedupedCollab.length) return null;
              return (
                <div className="rec-section">
                  <div className="rec-heading">
                    Readers like you also enjoyed
                  </div>
                  <div className="rec-strip">
                    {dedupedCollab.map((book) => {
                      const stars = book.avg_rating
                        ? Math.round(book.avg_rating)
                        : 0;
                      return (
                        <button
                          key={book.id}
                          className="rec-card rec-card-collab"
                          onClick={() => openBook(book.id)}
                        >
                          <div className="rec-card-reason">{book.reason}</div>
                          <div className="rec-card-title">{book.title}</div>
                          <div className="rec-card-author">{book.author}</div>
                          <div className="rec-card-meta">
                            {book.genre && (
                              <span className="rec-card-genre">
                                {book.genre}
                              </span>
                            )}
                            {book.avg_rating && (
                              <span className="rec-card-rating">
                                <span className="rec-stars">
                                  {"★".repeat(stars)}
                                  {"☆".repeat(5 - stars)}
                                </span>
                                <span className="rec-rating-val">
                                  {book.avg_rating}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="rec-card-avail">
                            {book.available_copies > 0 ? (
                              `${book.available_copies} available`
                            ) : (
                              <span className="muted">Unavailable</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Search + filters */}
            <div className="filter-bar">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by title, author…"
              />
              <select
                className="filter-select"
                value={availFilter}
                onChange={(e) => setAvailFilter(e.target.value)}
              >
                <option value="all">All copies</option>
                <option value="available">Available now</option>
                <option value="unavailable">Unavailable</option>
              </select>
              <select
                className="filter-select"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(Number(e.target.value))}
              >
                <option value={0}>Any rating</option>
                <option value={4}>4+ stars</option>
                <option value={3}>3+ stars</option>
                <option value={2}>2+ stars</option>
              </select>
              {hasActiveFilters && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Genre category cards */}
            {availableGenres.length > 0 && (
              <div className="genre-strip">
                <button
                  className={`genre-card${!selectedGenre ? " active" : ""}`}
                  onClick={() => setSelectedGenre("")}
                >
                  <span className="genre-card-name">All</span>
                  <span className="genre-card-count">{books.length}</span>
                </button>
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    className={`genre-card${
                      selectedGenre === genre ? " active" : ""
                    }`}
                    onClick={() =>
                      setSelectedGenre(selectedGenre === genre ? "" : genre)
                    }
                  >
                    <span className="genre-card-name">{genre}</span>
                    <span className="genre-card-count">
                      {genreCounts[genre]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {filteredBooks.length === 0 ? (
              <div className="empty">
                {hasActiveFilters
                  ? "No books match your filters"
                  : "No books available"}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Genre</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((b) => (
                    <tr
                      key={b.id}
                      className="clickable-row"
                      onClick={() => openBook(b.id)}
                    >
                      <td>
                        <span className="title-cell">
                          {b.title}
                          {trendingIds.has(b.id) && (
                            <span className="trending-tag">Trending</span>
                          )}
                        </span>
                      </td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
                      <td>
                        {b.rating_count > 0 ? (
                          <span className="book-rating-cell">
                            <span className="star-display">
                              {"★".repeat(Math.round(b.avg_rating))}
                              {"☆".repeat(5 - Math.round(b.avg_rating))}
                            </span>
                            <span className="rating-count-small">
                              {b.avg_rating} ({b.rating_count})
                            </span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "borrowed" && (
          <>
            <div className="section-header">
              <h3>My Borrowed Books</h3>
            </div>
            {activeBorrows.length === 0 ? (
              <div className="empty">No active borrows</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeBorrows.map((b) => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={b.is_overdue ? "overdue" : "active"}>
                          {b.is_overdue ? "Overdue" : "Active"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => openReturnModal(b.id, b.book_title)}
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="section-header" style={{ marginTop: 32 }}>
              <h3>My Reservations</h3>
            </div>
            {reservations.length === 0 ? (
              <div className="empty">No reservations</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.book_title}</td>
                      <td>{r.book_author}</td>
                      <td>
                        {r.status === "ready" ? (
                          <Badge variant="active">Ready — go borrow!</Badge>
                        ) : (
                          <Badge variant="overdue">
                            Queue #{r.queue_position}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => cancelReservation(r.id)}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "fines" && (
          <>
            <div className="section-header">
              <h3>My Fines</h3>
            </div>
            {fines.length === 0 ? (
              <div className="empty">No fines</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Due Date</th>
                    <th>Fine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((b) => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td className="fine-amount">${b.fine.toFixed(2)}</td>
                      <td>
                        <Badge variant={b.fine_paid ? "returned" : "overdue"}>
                          {b.fine_paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Book detail modal */}
      {selectedBook && (
        <Modal title={selectedBook.title} onClose={closeBook} wide>
          <div className="book-detail">
            <div className="book-detail-row">
              <span className="book-detail-label">Author</span>
              <span>{selectedBook.author}</span>
            </div>
            <div className="book-detail-row">
              <span className="book-detail-label">Genre</span>
              <span>
                {selectedBook.genre || <span className="muted">—</span>}
              </span>
            </div>
            <div className="book-detail-row">
              <span className="book-detail-label">Available</span>
              <span>
                {selectedBook.available_copies} / {selectedBook.total_copies}
                {selectedBook.available_copies === 0 &&
                  selectedBook.reservation_count > 0 && (
                    <span
                      className="muted"
                      style={{ marginLeft: 6, fontSize: "0.8em" }}
                    >
                      ({selectedBook.reservation_count} waiting)
                    </span>
                  )}
              </span>
            </div>
            <div className="book-detail-row">
              <span className="book-detail-label">Rating</span>
              <span>
                {bookReviews && bookReviews.rating_count > 0 ? (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <StarDisplay rating={bookReviews.avg_rating} />
                    <span style={{ fontSize: "0.85rem", color: "#555" }}>
                      {bookReviews.avg_rating} / 5
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#aaa" }}>
                      · {bookReviews.rating_count}{" "}
                      {bookReviews.rating_count === 1 ? "rating" : "ratings"}
                    </span>
                  </span>
                ) : (
                  <span className="muted">No ratings yet</span>
                )}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="error" style={{ marginTop: 16 }}>
              {actionError}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-sm btn-outline" onClick={closeBook}>
              Close
            </button>
            <BookActionButton book={selectedBook} />
          </div>

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
      )}

      {/* Return + optional review modal */}
      {returnModal && (
        <Modal title="Return Book" onClose={closeReturnModal}>
          <p style={{ marginBottom: 20, fontSize: "0.9rem", color: "#555" }}>
            Returning <strong>{returnModal.bookTitle}</strong>
          </p>

          <div style={{ marginBottom: 16 }}>
            <div className="book-detail-label" style={{ marginBottom: 10 }}>
              Rate this book{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </div>
            <StarPicker
              value={reviewRating}
              hover={reviewHover}
              onRate={setReviewRating}
              onHover={setReviewHover}
              onLeave={() => setReviewHover(0)}
            />
            {reviewRating > 0 && (
              <span
                style={{ marginLeft: 8, fontSize: "0.85rem", color: "#888" }}
              >
                {reviewRating} / 5
              </span>
            )}
          </div>

          {reviewRating > 0 && (
            <>
              <div className="form-group">
                <label>
                  Write a review{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your thoughts about this book…"
                  className="review-textarea"
                />
              </div>
              <div className="anonymous-row">
                <input
                  type="checkbox"
                  id="anon-check"
                  checked={reviewAnonymous}
                  onChange={(e) => setReviewAnonymous(e.target.checked)}
                />
                <label htmlFor="anon-check">Post as Anonymous</label>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-sm btn-outline"
              onClick={closeReturnModal}
            >
              Cancel
            </button>
            <button className="btn btn-sm" onClick={handleReturn}>
              {reviewRating > 0 ? "Submit & Return" : "Return"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberDashboard;
