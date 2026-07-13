import React, { useEffect, useMemo, useState } from "react";
import api from "../../../api";
import SearchBar from "../../../components/SearchBar";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/currency";

function FinesTab({ toast }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  const [fines, setFines] = useState([]);
  const [fineHistory, setFineHistory] = useState([]);
  const [fineSearch, setFineSearch] = useState("");
  const [fineHistorySearch, setFineHistorySearch] = useState("");
  const [markingPaidId, setMarkingPaidId] = useState(null);

  useEffect(() => {
    api.get("/admin/fines").then((r) => setFines(r.data));
    api.get("/admin/fines/history").then((r) => setFineHistory(r.data));
  }, []);

  const markFinePaid = async (borrowId) => {
    setMarkingPaidId(borrowId);
    try {
      const res = await api.put(`/admin/fines/${borrowId}/mark-paid`);
      setFines((prev) => prev.filter((f) => f.id !== borrowId));
      setFineHistory((prev) => [res.data, ...prev]);
      toast("Fine marked as paid");
    } catch {
      toast("Failed to mark fine as paid", "error");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const filteredFines = useMemo(() => {
    const q = fineSearch.trim().toLowerCase();
    if (!q) return fines;
    return fines.filter(
      (f) =>
        f.book_title?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [fines, fineSearch]);

  const filteredFineHistory = useMemo(() => {
    const q = fineHistorySearch.trim().toLowerCase();
    if (!q) return fineHistory;
    return fineHistory.filter(
      (f) =>
        f.book_title?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [fineHistory, fineHistorySearch]);

  return (
    <>
      <div className="section-header" data-tour="admin-fines">
        <h3>Pending Fines</h3>
        {fines.length > 0 && (
          <span
            className="fine-amount"
            style={{ fontSize: "0.9rem", fontWeight: 600 }}
          >
            {fines.length} unpaid ·{" "}
            {formatCurrency(fines.reduce((s, f) => s + f.fine, 0), currency)}{" "}
            total
          </span>
        )}
      </div>
      {fines.length > 0 && (
        <div className="search-top-bar" style={{ marginBottom: 20 }}>
          <SearchBar
            value={fineSearch}
            onChange={setFineSearch}
            placeholder="Search by book or user…"
            className="search-bar-wide"
          />
        </div>
      )}
      {fines.length === 0 ? (
        <div className="empty">No pending fines</div>
      ) : filteredFines.length === 0 ? (
        <div className="empty">No fines match your search</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>User</th>
              <th>Due Date</th>
              <th>Fine</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredFines.map((b) => (
              <tr key={b.id}>
                <td>{b.book_title}</td>
                <td>{b.username}</td>
                <td>{new Date(b.due_date).toLocaleDateString()}</td>
                <td className="fine-amount">{formatCurrency(b.fine, currency)}</td>
                <td>
                  {b.return_date ? (
                    <span className="status-tag status-tag-returned">
                      Returned Late
                    </span>
                  ) : (
                    <span className="status-tag status-tag-overdue">
                      Overdue
                    </span>
                  )}
                </td>
                <td>
                  <label className="mark-paid-checkbox">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={markingPaidId === b.id}
                      onChange={() => markFinePaid(b.id)}
                    />
                    {markingPaidId === b.id ? "Saving…" : "Mark Paid"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-header" style={{ marginTop: 40 }}>
        <h3>Fine History</h3>
        {fineHistory.length > 0 && (
          <span
            className="fine-amount"
            style={{ fontSize: "0.9rem", fontWeight: 600 }}
          >
            {fineHistory.length} paid ·{" "}
            {formatCurrency(
              fineHistory.reduce((s, f) => s + f.fine, 0),
              currency
            )}{" "}
            total
          </span>
        )}
      </div>
      {fineHistory.length > 0 && (
        <div className="search-top-bar" style={{ marginBottom: 20 }}>
          <SearchBar
            value={fineHistorySearch}
            onChange={setFineHistorySearch}
            placeholder="Search by book or user…"
            className="search-bar-wide"
          />
        </div>
      )}
      {fineHistory.length === 0 ? (
        <div className="empty">No fines paid yet</div>
      ) : filteredFineHistory.length === 0 ? (
        <div className="empty">No fines match your search</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>User</th>
              <th>Due Date</th>
              <th>Fine</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredFineHistory.map((b) => (
              <tr key={b.id}>
                <td>{b.book_title}</td>
                <td>{b.username}</td>
                <td>{new Date(b.due_date).toLocaleDateString()}</td>
                <td className="fine-amount">{formatCurrency(b.fine, currency)}</td>
                <td>
                  <span className="status-tag status-tag-returned">
                    Paid
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default FinesTab;
