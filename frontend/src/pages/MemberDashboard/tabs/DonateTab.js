import React from "react";
import Badge from "../../../components/Badge";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/currency";

function DonateTab({ donations, onOpenDonateModal }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <>
      <div className="section-header" data-tour="member-donations">
        <h3>Donate a Book</h3>
        <button className="btn btn-sm" onClick={onOpenDonateModal}>
          Donate
        </button>
      </div>
      <p
        style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}
      >
        Donate a book you own to the library. Once approved by an admin,
        the book is added to the catalogue and you earn{" "}
        <strong>1/4 of its estimated value</strong> as library credit.
      </p>
      {donations.length === 0 ? (
        <div className="empty">No donations yet</div>
      ) : (
        <>
          {(() => {
            const totalCredit = donations
              .filter((d) => d.status === "approved")
              .reduce((sum, d) => sum + (d.credit_amount || 0), 0);
            return totalCredit > 0 ? (
              <div
                className="membership-card"
                style={{ marginBottom: 16 }}
              >
                <div className="membership-card-stats">
                  <div className="membership-stat">
                    <span className="membership-stat-label">
                      Total credits earned
                    </span>
                    <span className="membership-stat-value">
                      {formatCurrency(totalCredit, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null;
          })()}
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Estimated Value</th>
                <th>Credit Earned</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.author}</td>
                  <td>{formatCurrency(d.estimated_price, currency)}</td>
                  <td>
                    {d.status === "approved" ? (
                      <span
                        style={{ color: "#2e7d32", fontWeight: 600 }}
                      >
                        {formatCurrency(d.credit_amount || 0, currency)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge
                      variant={
                        d.status === "approved"
                          ? "active"
                          : d.status === "rejected"
                          ? "overdue"
                          : "returned"
                      }
                    >
                      {d.status.charAt(0).toUpperCase() +
                        d.status.slice(1)}
                    </Badge>
                  </td>
                  <td>
                    {new Date(d.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

export default DonateTab;
