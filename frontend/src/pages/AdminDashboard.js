import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const TABS = [
  { id: 'books', label: 'Books' },
  { id: 'borrows', label: 'Borrowed Books' },
  { id: 'fines', label: 'Pending Fines' },
];

const EMPTY_FORM = { title: '', author: '', isbn: '', total_copies: 1 };

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [fines, setFines] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/books').then(r => setBooks(r.data));
    api.get('/admin/borrows').then(r => setBorrows(r.data));
    api.get('/admin/fines').then(r => setFines(r.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addBook = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/books', { ...form, total_copies: Number(form.total_copies) });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add book');
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

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="layout">
      <TopBar title="Library Admin" username={user.username} onLogout={logout} />
      <NavTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="content">
        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>All Books</h3>
              <button className="btn btn-sm" onClick={() => setShowAdd(true)}>
                Add Book
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>ISBN</th>
                  <th>Copies</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.isbn}</td>
                    <td>{b.available_copies} / {b.total_copies}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => deleteBook(b.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === 'borrows' && (
          <>
            <div className="section-header">
              <h3>Currently Borrowed</h3>
            </div>
            {borrows.length === 0 ? (
              <div className="empty">No active borrows</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrower</th>
                    <th>Borrow Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
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
        {tab === 'fines' && (
          <>
            <div className="section-header">
              <h3>Pending Fines</h3>
            </div>
            {fines.length === 0 ? (
              <div className="empty">No pending fines</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>User</th>
                    <th>Due Date</th>
                    <th>Fine</th>
                  </tr>
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
      </div>

      {showAdd && (
        <Modal title="Add Book" onClose={() => { setShowAdd(false); setError(''); }}>
          <form onSubmit={addBook}>
            {error && <div className="error">{error}</div>}
            <div className="form-group">
              <label>Title</label>
              <input {...field('title')} required />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...field('author')} required />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input {...field('isbn')} required />
            </div>
            <div className="form-group">
              <label>Copies</label>
              <input type="number" min="1" {...field('total_copies')} required />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setShowAdd(false); setError(''); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default AdminDashboard;
