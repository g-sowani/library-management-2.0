import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { GENRES } from '../constants';

const TABS = [
  { id: 'books', label: 'Books' },
  { id: 'borrows', label: 'Borrowed Books' },
  { id: 'fines', label: 'Pending Fines' },
  { id: 'policy', label: 'Fine Policy' },
];

const EMPTY_BOOK_FORM = { title: '', author: '', isbn: '', total_copies: 1, genre: '' };

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');

  // Add book
  const [showAdd, setShowAdd] = useState(false);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [bookError, setBookError] = useState('');

  // Edit book
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');

  // Book logs
  const [logsBook, setLogsBook] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fine policy
  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({ fine_per_day: '', borrow_days: '' });
  const [policyError, setPolicyError] = useState('');
  const [policySaved, setPolicySaved] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    Promise.all([
      api.get('/books').then(r => setBooks(r.data)),
      api.get('/admin/borrows').then(r => setBorrows(r.data)),
      api.get('/admin/fines').then(r => setFines(r.data)),
      api.get('/admin/policy').then(r => {
        setPolicy(r.data);
        setPolicyForm({ fine_per_day: r.data.fine_per_day, borrow_days: r.data.borrow_days });
      }),
    ]).catch(() => setLoadError('Failed to load data. Is the server running?'));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Add book ──────────────────────────────────────────────────
  const addBook = async (e) => {
    e.preventDefault();
    setBookError('');
    try {
      await api.post('/books', { ...bookForm, total_copies: Number(bookForm.total_copies) });
      setShowAdd(false);
      setBookForm(EMPTY_BOOK_FORM);
      load();
    } catch (err) {
      setBookError(err.response?.data?.error || 'Failed to add book');
    }
  };

  const deleteBook = async (id) => {
    try {
      await api.delete(`/books/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete');
    }
  };

  // ── Edit book ─────────────────────────────────────────────────
  const openEdit = (book) => {
    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre || '',
      total_copies: book.total_copies,
      discard_reason: '',
    });
    setEditError('');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      await api.put(`/books/${editingBook.id}`, {
        ...editForm,
        total_copies: Number(editForm.total_copies),
      });
      setEditingBook(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update book');
    }
  };

  // ── Book logs ─────────────────────────────────────────────────
  const openLogs = async (book) => {
    setLogsBook(book);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await api.get(`/books/${book.id}/logs`);
      setLogs(res.data);
    } finally {
      setLogsLoading(false);
    }
  };

  // ── Fine policy ───────────────────────────────────────────────
  const savePolicy = async (e) => {
    e.preventDefault();
    setPolicyError('');
    setPolicySaved(false);
    try {
      const res = await api.put('/admin/policy', policyForm);
      setPolicy(res.data);
      setPolicySaved(true);
    } catch (err) {
      const errs = err.response?.data?.errors;
      setPolicyError(errs ? Object.values(errs).join(', ') : 'Failed to save policy');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const filteredBooks = books.filter(b => {
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q)
      || b.author.toLowerCase().includes(q)
      || (b.genre || '').toLowerCase().includes(q);
  });

  const isDiscarding = editingBook && Number(editForm.total_copies) < editingBook.total_copies;
  const borrowed = editingBook ? editingBook.total_copies - editingBook.available_copies : 0;

  const bookField = (key) => ({
    value: bookForm[key],
    onChange: (e) => setBookForm({ ...bookForm, [key]: e.target.value }),
  });

  const editField = (key) => ({
    value: editForm[key] ?? '',
    onChange: (e) => setEditForm({ ...editForm, [key]: e.target.value }),
  });

  return (
    <div className="layout">
      <TopBar title="Library Admin" username={user.username} onLogout={logout} />
      <NavTabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); setPolicySaved(false); }} />
      <div className="content">
        {loadError && <div className="error">{loadError}</div>}

        {/* ── Books ── */}
        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>All Books</h3>
              <div className="section-header-actions">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by title, author or genre…" />
                <button className="btn btn-sm" onClick={() => setShowAdd(true)}>Add Book</button>
              </div>
            </div>
            {filteredBooks.length === 0 && (
              <div className="empty">{search ? 'No books match your search' : 'No books yet'}</div>
            )}
            {filteredBooks.length > 0 && (
              <table>
                <thead>
                  <tr><th>Title</th><th>Author</th><th>Genre</th><th>ISBN</th><th>Copies</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredBooks.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
                      <td>{b.isbn}</td>
                      <td>{b.available_copies} / {b.total_copies}</td>
                      <td>
                        <div className="btn-row">
                          <button className="btn btn-sm" onClick={() => openEdit(b)}>Edit</button>
                          <button className="btn btn-sm btn-outline" onClick={() => openLogs(b)}>Logs</button>
                          <button className="btn btn-sm btn-outline" onClick={() => deleteBook(b.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Borrowed Books ── */}
        {tab === 'borrows' && (
          <>
            <div className="section-header"><h3>Currently Borrowed</h3></div>
            {borrows.length === 0 ? (
              <div className="empty">No active borrows</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Book</th><th>Borrower</th><th>Borrow Date</th><th>Due Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {borrows.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{b.username}</td>
                      <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={b.is_overdue ? 'overdue' : 'active'}>
                          {b.is_overdue ? 'Overdue' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Fines ── */}
        {tab === 'fines' && (
          <>
            <div className="section-header"><h3>Pending Fines</h3></div>
            {fines.length === 0 ? (
              <div className="empty">No pending fines</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Book</th><th>User</th><th>Due Date</th><th>Fine</th></tr>
                </thead>
                <tbody>
                  {fines.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{b.username}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td className="fine-amount">${b.fine.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Fine Policy ── */}
        {tab === 'policy' && policy && (
          <>
            <div className="section-header"><h3>Fine Policy</h3></div>
            <form className="policy-form" onSubmit={savePolicy}>
              {policyError && <div className="error">{policyError}</div>}
              {policySaved && <div className="success">Policy saved successfully</div>}
              <div className="form-group">
                <label>Fine Per Day ($)</label>
                <input type="number" min="0" step="0.01"
                  value={policyForm.fine_per_day}
                  onChange={e => setPolicyForm({ ...policyForm, fine_per_day: e.target.value })}
                  required />
                <p className="field-hint">Charged per day a book is overdue</p>
              </div>
              <div className="form-group">
                <label>Borrow Duration (days)</label>
                <input type="number" min="1"
                  value={policyForm.borrow_days}
                  onChange={e => setPolicyForm({ ...policyForm, borrow_days: e.target.value })}
                  required />
                <p className="field-hint">Applies to new borrows only</p>
              </div>
              <button type="submit" className="btn btn-sm">Save Policy</button>
            </form>
          </>
        )}
      </div>

      {/* ── Add Book Modal ── */}
      {showAdd && (
        <Modal title="Add Book" onClose={() => { setShowAdd(false); setBookError(''); }}>
          <form onSubmit={addBook}>
            {bookError && <div className="error">{bookError}</div>}
            <div className="form-group">
              <label>Title</label>
              <input {...bookField('title')} required />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...bookField('author')} required />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input {...bookField('isbn')} required />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select {...bookField('genre')}>
                <option value="">— Select genre —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Copies</label>
              <input type="number" min="1" {...bookField('total_copies')} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setShowAdd(false); setBookError(''); }}>Cancel</button>
              <button type="submit" className="btn btn-sm">Add</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Book Modal ── */}
      {editingBook && (
        <Modal title={`Edit — ${editingBook.title}`} onClose={() => setEditingBook(null)}>
          <form onSubmit={saveEdit}>
            {editError && <div className="error">{editError}</div>}
            <div className="form-group">
              <label>Title</label>
              <input {...editField('title')} required />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...editField('author')} required />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input {...editField('isbn')} required />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select {...editField('genre')}>
                <option value="">— Select genre —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Total Copies</label>
              <input type="number" min="1" {...editField('total_copies')} required />
              {borrowed > 0 && (
                <p className="field-hint">{borrowed} currently borrowed — minimum is {borrowed}</p>
              )}
            </div>
            {isDiscarding && (
              <div className="form-group discard-reason">
                <label>
                  Reason for Discarding <span className="required">*</span>
                </label>
                <input
                  {...editField('discard_reason')}
                  placeholder="e.g. Damaged, lost, worn out…"
                  required
                />
                <p className="field-hint">
                  Discarding {editingBook.total_copies - Number(editForm.total_copies)} copy/copies —
                  this will be logged
                </p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => setEditingBook(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Book Logs Modal ── */}
      {logsBook && (
        <Modal title={`Inventory Logs — ${logsBook.title}`} onClose={() => setLogsBook(null)} wide>
          {logsLoading ? (
            <div className="empty">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="empty">No log entries for this book</div>
          ) : (
            <div className="modal-scroll">
              <table>
                <thead>
                  <tr><th>Action</th><th>Details</th><th>Admin</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td><span className="log-action">{l.action}</span></td>
                      <td className="log-details">{l.details}</td>
                      <td>{l.admin_username}</td>
                      <td className="log-date">{new Date(l.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default AdminDashboard;
