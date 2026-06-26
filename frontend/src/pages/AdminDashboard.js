import React, { useState, useEffect, useCallback } from "react";
import api from "../api";

function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [fines, setFines] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    author: "",
    isbn: "",
    total_copies: 1,
  });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get("/books").then((r) => setBooks(r.data));
    api.get("/admin/borrows").then((r) => setBorrows(r.data));
    api.get("/admin/fines").then((r) => setFines(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addBook = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/books", {
        ...form,
        total_copies: Number(form.total_copies),
      });
      setShowAdd(false);
      setForm({ title: "", author: "", isbn: "", total_copies: 1 });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add book");
    }
  };

  const deleteBook = async (id) => {
    try {
      await api.delete(`/books/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Cannot delete");
    }
  };

  return (
    <div className="layout">
      <div className="topbar">
        <h2>Library Admin</h2>
        <div className="topbar-right">
          <span>{user.username}</span>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>
      <div className="nav-tabs">
        {["books", "borrows", "fines"].map((t) => (
          <button
            key={t}
            className={`nav-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "books"
              ? "Books"
              : t === "borrows"
              ? "Borrowed Books"
              : "Pending Fines"}
          </button>
        ))}
      </div>
      <div className="content">
        {tab === "books" && (
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
                {books.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.isbn}</td>
                    <td>
                      {b.available_copies} / {b.total_copies}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => deleteBook(b.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === "borrows" && (
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
                  {borrows.map((b) => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{b.username}</td>
                      <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
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
                  {fines.map((b) => (
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
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={addBook}
          >
            <h3>Add Book</h3>
            {error && <div className="error">{error}</div>}
            <div className="form-group">
              <label>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Copies</label>
              <input
                type="number"
                min="1"
                value={form.total_copies}
                onChange={(e) =>
                  setForm({ ...form, total_copies: e.target.value })
                }
                required
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm">
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
