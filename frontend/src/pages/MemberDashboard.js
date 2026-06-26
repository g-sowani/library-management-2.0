import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import Badge from '../components/Badge';

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
  const [fines, setFines] = useState([]);

  const load = useCallback(() => {
    api.get('/books').then(r => setBooks(r.data));
    api.get('/my-borrows').then(r => setBorrows(r.data));
    api.get('/my-fines').then(r => setFines(r.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const borrow = async (bookId) => {
    await api.post(`/borrow/${bookId}`);
    load();
  };

  const returnBook = async (borrowId) => {
    await api.post(`/return/${borrowId}`);
    load();
  };

  const activeBorrows = borrows.filter(b => !b.return_date);

  return (
    <div className="layout">
      <TopBar title="Library" username={user.username} onLogout={logout} />
      <NavTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="content">
        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>Available Books</h3>
            </div>
            {books.length === 0 ? (
              <div className="empty">No books available</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Available</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {books.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.available_copies} / {b.total_copies}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => borrow(b.id)}
                          disabled={b.available_copies < 1}
                        >
                          Borrow
                        </button>
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
                        <button className="btn btn-sm btn-outline" onClick={() => returnBook(b.id)}>
                          Return
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
    </div>
  );
}

export default MemberDashboard;
