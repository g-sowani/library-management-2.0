import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';

const TABS = [
  { id: 'books', label: 'Available Books' },
  { id: 'borrowed', label: 'My Books' },
  { id: 'fines', label: 'Fines' },
];

function StarPicker({ value, hover, onRate, onHover, onLeave }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          className={`star ${star <= (hover || value) ? 'star-filled' : ''}`}
          onClick={() => onRate(value === star ? 0 : star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          title={`${star} star${star > 1 ? 's' : ''}`}
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
      {'★'.repeat(rounded)}{'☆'.repeat(5 - rounded)}
    </span>
  );
}

function MemberDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Book detail modal
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [bookReviews, setBookReviews] = useState(null);

  // Return + review modal
  const [returnModal, setReturnModal] = useState(null); // { borrowId, bookTitle }
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewAnonymous, setReviewAnonymous] = useState(false);

  const selectedBook = books.find(b => b.id === selectedBookId) || null;

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.get('/books').then(r => setBooks(r.data)),
      api.get('/my-borrows').then(r => setBorrows(r.data)),
      api.get('/my-fines').then(r => setFines(r.data)),
      api.get('/my-reservations').then(r => setReservations(r.data)),
    ]).catch(() => setError('Failed to load data. Is the server running?'));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch reviews whenever a book detail is opened
  useEffect(() => {
    if (!selectedBookId) { setBookReviews(null); return; }
    setBookReviews(null);
    api.get(`/books/${selectedBookId}/reviews`)
      .then(r => setBookReviews(r.data))
      .catch(() => setBookReviews({ avg_rating: null, rating_count: 0, reviews: [] }));
  }, [selectedBookId]);

  const openBook = (bookId) => {
    setSelectedBookId(bookId);
    setActionError('');
  };

  const closeBook = () => {
    setSelectedBookId(null);
    setActionError('');
  };

  const borrow = async (bookId) => {
    setActionError('');
    try {
      await api.post(`/borrow/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || 'Failed to borrow book');
    }
  };

  const openReturnModal = (borrowId, bookTitle) => {
    setReturnModal({ borrowId, bookTitle });
    setReviewRating(0);
    setReviewHover(0);
    setReviewText('');
    setReviewAnonymous(false);
  };

  const closeReturnModal = () => setReturnModal(null);

  const handleReturn = async () => {
    const payload = reviewRating > 0
      ? { rating: reviewRating, review_text: reviewText.trim(), is_anonymous: reviewAnonymous }
      : {};
    try {
      await api.post(`/return/${returnModal.borrowId}`, Object.keys(payload).length ? payload : undefined);
      setReturnModal(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to return book');
      setReturnModal(null);
    }
  };

  const reserve = async (bookId) => {
    setActionError('');
    try {
      await api.post(`/reserve/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || 'Failed to reserve book');
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      await api.delete(`/cancel-reservation/${reservationId}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to cancel reservation');
    }
  };

  const activeBorrows = borrows.filter(b => !b.return_date);
  const borrowedBookIds = new Set(activeBorrows.map(b => b.book_id));
  const reservedBooks = Object.fromEntries(reservations.map(r => [r.book_id, r]));

  const filteredBooks = books.filter(b => {
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q)
      || b.author.toLowerCase().includes(q)
      || (b.genre || '').toLowerCase().includes(q);
  });

  function BookActionButton({ book }) {
    const res = reservedBooks[book.id];
    const isBorrowed = borrowedBookIds.has(book.id);

    if (isBorrowed) {
      return <button className="btn btn-sm" disabled>Borrowed</button>;
    }
    if (book.available_copies > 0) {
      return (
        <button className="btn btn-sm" onClick={() => borrow(book.id)}>
          Borrow
        </button>
      );
    }
    if (res) {
      if (res.status === 'ready') {
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
      <button className="btn btn-sm btn-outline" onClick={() => reserve(book.id)}>
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

        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>Available Books</h3>
              <SearchBar value={search} onChange={setSearch} placeholder="Search by title, author or genre…" />
            </div>
            {filteredBooks.length === 0 ? (
              <div className="empty">{search ? 'No books match your search' : 'No books available'}</div>
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
                  {filteredBooks.map(b => (
                    <tr key={b.id} className="clickable-row" onClick={() => openBook(b.id)}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
                      <td>
                        {b.rating_count > 0 ? (
                          <span className="book-rating-cell">
                            <span className="star-display">
                              {'★'.repeat(Math.round(b.avg_rating))}{'☆'.repeat(5 - Math.round(b.avg_rating))}
                            </span>
                            <span className="rating-count-small">{b.avg_rating} ({b.rating_count})</span>
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

        {tab === 'borrowed' && (
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
                  {activeBorrows.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={b.is_overdue ? 'overdue' : 'active'}>
                          {b.is_overdue ? 'Overdue' : 'Active'}
                        </Badge>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => openReturnModal(b.id, b.book_title)}>
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
                  {reservations.map(r => (
                    <tr key={r.id}>
                      <td>{r.book_title}</td>
                      <td>{r.book_author}</td>
                      <td>
                        {r.status === 'ready' ? (
                          <Badge variant="active">Ready — go borrow!</Badge>
                        ) : (
                          <Badge variant="overdue">Queue #{r.queue_position}</Badge>
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

        {tab === 'fines' && (
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
                  {fines.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td className="fine-amount">${b.fine.toFixed(2)}</td>
                      <td>
                        <Badge variant={b.fine_paid ? 'returned' : 'overdue'}>
                          {b.fine_paid ? 'Paid' : 'Unpaid'}
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
              <span>{selectedBook.genre || <span className="muted">—</span>}</span>
            </div>
            <div className="book-detail-row">
              <span className="book-detail-label">Available</span>
              <span>
                {selectedBook.available_copies} / {selectedBook.total_copies}
                {selectedBook.available_copies === 0 && selectedBook.reservation_count > 0 && (
                  <span className="muted" style={{ marginLeft: 6, fontSize: '0.8em' }}>
                    ({selectedBook.reservation_count} waiting)
                  </span>
                )}
              </span>
            </div>
            <div className="book-detail-row">
              <span className="book-detail-label">Rating</span>
              <span>
                {bookReviews && bookReviews.rating_count > 0 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StarDisplay rating={bookReviews.avg_rating} />
                    <span style={{ fontSize: '0.85rem', color: '#555' }}>
                      {bookReviews.avg_rating} / 5
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                      · {bookReviews.rating_count} {bookReviews.rating_count === 1 ? 'rating' : 'ratings'}
                    </span>
                  </span>
                ) : (
                  <span className="muted">No ratings yet</span>
                )}
              </span>
            </div>
          </div>

          {actionError && <div className="error" style={{ marginTop: 16 }}>{actionError}</div>}
          <div className="modal-actions">
            <button className="btn btn-sm btn-outline" onClick={closeBook}>Close</button>
            <BookActionButton book={selectedBook} />
          </div>

          {/* Reviews list */}
          {bookReviews && bookReviews.reviews.length > 0 && (
            <div className="reviews-section">
              <div className="reviews-header">Reviews</div>
              {bookReviews.reviews.map(r => (
                <div key={r.id} className="review-item">
                  <div className="review-meta">
                    <span className="review-author">{r.reviewer}</span>
                    <span className="review-stars">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
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
              <div className="empty" style={{ padding: '20px 0' }}>No reviews yet. Be the first to review after borrowing!</div>
            </div>
          )}
        </Modal>
      )}

      {/* Return + optional review modal */}
      {returnModal && (
        <Modal title="Return Book" onClose={closeReturnModal}>
          <p style={{ marginBottom: 20, fontSize: '0.9rem', color: '#555' }}>
            Returning <strong>{returnModal.bookTitle}</strong>
          </p>

          <div style={{ marginBottom: 16 }}>
            <div className="book-detail-label" style={{ marginBottom: 10 }}>
              Rate this book <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span>
            </div>
            <StarPicker
              value={reviewRating}
              hover={reviewHover}
              onRate={setReviewRating}
              onHover={setReviewHover}
              onLeave={() => setReviewHover(0)}
            />
            {reviewRating > 0 && (
              <span style={{ marginLeft: 8, fontSize: '0.85rem', color: '#888' }}>
                {reviewRating} / 5
              </span>
            )}
          </div>

          {reviewRating > 0 && (
            <>
              <div className="form-group">
                <label>Write a review <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Share your thoughts about this book…"
                  className="review-textarea"
                />
              </div>
              <div className="anonymous-row">
                <input
                  type="checkbox"
                  id="anon-check"
                  checked={reviewAnonymous}
                  onChange={e => setReviewAnonymous(e.target.checked)}
                />
                <label htmlFor="anon-check">Post as Anonymous</label>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button className="btn btn-sm btn-outline" onClick={closeReturnModal}>Cancel</button>
            <button className="btn btn-sm" onClick={handleReturn}>
              {reviewRating > 0 ? 'Submit & Return' : 'Return'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberDashboard;
