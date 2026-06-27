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

  const returnBook = async (borrowId) => {
    try {
      await api.post(`/return/${borrowId}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to return book');
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
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map(b => (
                    <tr key={b.id} className="clickable-row" onClick={() => openBook(b.id)}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
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
                        <button className="btn btn-sm btn-outline" onClick={() => returnBook(b.id)}>
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

      {selectedBook && (
        <Modal title={selectedBook.title} onClose={closeBook}>
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
          </div>
          {actionError && <div className="error" style={{ marginTop: 16 }}>{actionError}</div>}
          <div className="modal-actions">
            <button className="btn btn-sm btn-outline" onClick={closeBook}>Close</button>
            <BookActionButton book={selectedBook} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberDashboard;
