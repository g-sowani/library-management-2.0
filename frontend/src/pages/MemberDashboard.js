import React, { useState, useEffect, useCallback } from "react";
import api from "../api";

function MemberDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [fines, setFines] = useState([]);

  const load = useCallback(() => {
    api.get("/books").then((r) => setBooks(r.data));
    api.get("/my-borrows").then((r) => setBorrows(r.data));
    api.get("/my-fines").then((r) => setFines(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const borrow = async (bookId) => {
    await api.post(`/borrow/${bookId}`);
    load();
  };

  const returnBook = async (borrowId) => {
    await api.post(`/return/${borrowId}`);
    load();
  };

  const activeBorrows = borrows.filter((b) => !b.return_date);

  return (
    <div className="layout">
      <div className="topbar">
        <h2>Library</h2>
        <div className="topbar-right">
          <span>{user.username}</span>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>
      <div className="nav-tabs">
        {["books", "borrowed", "fines"].map((t) => (
          <button
            key={t}
            className={`nav-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "books"
              ? "Available Books"
              : t === "borrowed"
              ? "My Books"
              : "Fines"}
          </button>
        ))}
      </div>
      <div className="content">
        {tab === "books" && (
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
                  {books.map((b) => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>
                        {b.available_copies} / {b.total_copies}
                      </td>
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
                        <span
                          className={`badge ${
                            b.is_overdue ? "badge-overdue" : "badge-active"
                          }`}
                        >
                          {b.is_overdue ? "Overdue" : "Active"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => returnBook(b.id)}
                        >
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
                        <span
                          className={`badge ${
                            b.fine_paid ? "badge-returned" : "badge-overdue"
                          }`}
                        >
                          {b.fine_paid ? "Paid" : "Unpaid"}
                        </span>
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
