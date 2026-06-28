import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  { id: 'members', label: 'Members' },
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
  const [selectedGenre, setSelectedGenre] = useState('');
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

  // Members
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberBorrows, setMemberBorrows] = useState([]);
  const [memberBorrowsLoading, setMemberBorrowsLoading] = useState(false);

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

  const loadMembers = useCallback(() => {
    api.get('/admin/members').then(r => { setMembers(r.data); setMembersLoaded(true); });
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    setPolicySaved(false);
    if (t === 'members' && !membersLoaded) loadMembers();
  };

  const openMember = async (member) => {
    setSelectedMember(member);
    setMemberBorrows([]);
    setMemberBorrowsLoading(true);
    try {
      const res = await api.get(`/admin/members/${member.id}/borrows`);
      setMemberBorrows(res.data);
    } finally {
      setMemberBorrowsLoading(false);
    }
  };

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

  const refreshMeta = async (id) => {
    try {
      await api.post(`/books/${id}/scrape`);
    } catch (err) {
      alert('Failed to start metadata refresh');
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
  const genreCounts = useMemo(() => {
    const counts = {};
    books.forEach(b => {
      const g = b.genre || 'Other';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [books]);

  const availableGenres = useMemo(() => Object.keys(genreCounts).sort(), [genreCounts]);

  const filteredBooks = useMemo(() => books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = b.title.toLowerCase().includes(q)
      || b.author.toLowerCase().includes(q)
      || (b.genre || '').toLowerCase().includes(q);
    const matchGenre = !selectedGenre || (b.genre || 'Other') === selectedGenre;
    return matchSearch && matchGenre;
  }), [books, search, selectedGenre]);

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
      <NavTabs tabs={TABS} active={tab} onChange={handleTabChange} />
      <div className="content">
        {loadError && <div className="error">{loadError}</div>}

        {/* ── Books ── */}
        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>All Books</h3>
              <button className="btn btn-sm" onClick={() => setShowAdd(true)}>Add Book</button>
            </div>

            <div className="search-top-bar">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by title, author or genre…" className="search-bar-wide" />
            </div>

            {availableGenres.length > 0 && (
              <div className="genre-strip">
                <button
                  className={`genre-card${!selectedGenre ? ' active' : ''}`}
                  onClick={() => setSelectedGenre('')}
                >
                  <span className="genre-card-name">All</span>
                  <span className="genre-card-count">{books.length}</span>
                </button>
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    className={`genre-card${selectedGenre === genre ? ' active' : ''}`}
                    onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                  >
                    <span className="genre-card-name">{genre}</span>
                    <span className="genre-card-count">{genreCounts[genre]}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredBooks.length === 0 && (
              <div className="empty">{search || selectedGenre ? 'No books match your filters' : 'No books yet'}</div>
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
                          <button className="btn btn-sm btn-outline" onClick={() => refreshMeta(b.id)} title="Re-fetch description, author bio, and cover from Open Library">Refresh</button>
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

        {/* ── Members ── */}
        {tab === 'members' && (
          <>
            <div className="section-header"><h3>All Members</h3></div>
            {!membersLoaded ? (
              <div className="empty">Loading…</div>
            ) : members.length === 0 ? (
              <div className="empty">No members registered</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Currently Borrowed</th>
                    <th>Total Borrows</th>
                    <th>Fines Pending</th>
                    <th>Fines Paid</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>{m.username}</td>
                      <td>{m.currently_borrowed}</td>
                      <td>{m.total_borrows}</td>
                      <td className={m.fines_pending > 0 ? 'fine-amount' : ''}>
                        {m.fines_pending > 0 ? `$${m.fines_pending.toFixed(2)}` : <span className="muted">—</span>}
                      </td>
                      <td>{m.fines_paid > 0 ? `$${m.fines_paid.toFixed(2)}` : <span className="muted">—</span>}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => openMember(m)}>View Records</button>
                      </td>
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

      {/* ── Member Records Modal ── */}
      {selectedMember && (
        <Modal title={`Records — ${selectedMember.username}`} onClose={() => setSelectedMember(null)} wide>
          <div className="member-stats">
            <div className="member-stat">
              <span className="member-stat-label">Currently Borrowed</span>
              <span className="member-stat-value">{selectedMember.currently_borrowed}</span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Total Borrows</span>
              <span className="member-stat-value">{selectedMember.total_borrows}</span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Fines Pending</span>
              <span className={`member-stat-value${selectedMember.fines_pending > 0 ? ' fine-amount' : ''}`}>
                {selectedMember.fines_pending > 0 ? `$${selectedMember.fines_pending.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Fines Paid</span>
              <span className="member-stat-value">
                {selectedMember.fines_paid > 0 ? `$${selectedMember.fines_paid.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
          {memberBorrowsLoading ? (
            <div className="empty">Loading…</div>
          ) : memberBorrows.length === 0 ? (
            <div className="empty">No borrow history</div>
          ) : (
            <div className="modal-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed</th>
                    <th>Due</th>
                    <th>Returned</th>
                    <th>Fine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberBorrows.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        {b.return_date
                          ? new Date(b.return_date).toLocaleDateString()
                          : <Badge variant={b.is_overdue ? 'overdue' : 'active'}>{b.is_overdue ? 'Overdue' : 'Active'}</Badge>}
                      </td>
                      <td className={b.fine > 0 ? 'fine-amount' : ''}>
                        {b.fine > 0 ? `$${b.fine.toFixed(2)}` : <span className="muted">—</span>}
                      </td>
                      <td>
                        {b.fine > 0
                          ? (b.fine_paid
                            ? <Badge variant="returned">Paid</Badge>
                            : <Badge variant="overdue">Unpaid</Badge>)
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
