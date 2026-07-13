import React from "react";
import Modal from "../../../../components/Modal";
import Badge from "../../../../components/Badge";
import { useAuth } from "../../../../context/AuthContext";
import { formatCurrency } from "../../../../utils/currency";

function BookLogsModal({ logsBook, onClose, logs, logsLoading, bookBorrows, bookBorrowsLoading }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <Modal
      title={`Inventory Logs for ${logsBook.title}`}
      onClose={onClose}
      wide
      className="modal-xwide"
    >
      <div className="reviews-header">Inventory Logs</div>
      {logsLoading ? (
        <div className="empty">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="empty">No log entries for this book</div>
      ) : (
        <div className="modal-scroll">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Details</th>
                <th>Admin</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="log-action">{l.action}</span>
                  </td>
                  <td className="log-details">{l.details}</td>
                  <td>{l.admin_username}</td>
                  <td className="log-date">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="reviews-header" style={{ marginTop: 24 }}>
        Borrow History
      </div>
      {bookBorrowsLoading ? (
        <div className="empty">Loading…</div>
      ) : bookBorrows.length === 0 ? (
        <div className="empty">No borrow records for this book</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Returned</th>
              <th>Fine</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookBorrows.map((b) => (
              <tr key={b.id}>
                <td>{b.username}</td>
                <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                <td>{new Date(b.due_date).toLocaleDateString()}</td>
                <td>
                  {b.return_date ? (
                    new Date(b.return_date).toLocaleDateString()
                  ) : (
                    <Badge
                      variant={b.is_overdue ? "overdue" : "active"}
                    >
                      {b.is_overdue ? "Overdue" : "Active"}
                    </Badge>
                  )}
                </td>
                <td className={b.fine > 0 ? "fine-amount" : ""}>
                  {b.fine > 0 ? (
                    formatCurrency(b.fine, currency)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {b.fine > 0 ? (
                    b.fine_paid ? (
                      <Badge variant="returned">Paid</Badge>
                    ) : (
                      <Badge variant="overdue">Unpaid</Badge>
                    )
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default BookLogsModal;
