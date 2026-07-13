import React from "react";
import Modal from "../../../../components/Modal";
import Badge from "../../../../components/Badge";
import { useAuth } from "../../../../context/AuthContext";
import { formatCurrency } from "../../../../utils/currency";

function MemberRecordsModal({ member, onClose, memberBorrows, memberBorrowsLoading }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <Modal
      title={`Records for ${member.username}`}
      onClose={onClose}
      wide
    >
      <div className="member-stats">
        <div className="member-stat">
          <span className="member-stat-label">Currently Borrowed</span>
          <span className="member-stat-value">
            {member.currently_borrowed}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">Total Borrows</span>
          <span className="member-stat-value">
            {member.total_borrows}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">Fines Pending</span>
          <span
            className={`member-stat-value${
              member.fines_pending > 0 ? " fine-amount" : ""
            }`}
          >
            {member.fines_pending > 0
              ? formatCurrency(member.fines_pending, currency)
              : "—"}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">Fines Paid</span>
          <span className="member-stat-value">
            {member.fines_paid > 0
              ? formatCurrency(member.fines_paid, currency)
              : "—"}
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
              {memberBorrows.map((b) => (
                <tr key={b.id}>
                  <td>{b.book_title}</td>
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
        </div>
      )}
    </Modal>
  );
}

export default MemberRecordsModal;
