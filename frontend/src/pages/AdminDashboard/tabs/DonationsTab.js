import React, { useState } from "react";
import api from "../../../api";
import Modal from "../../../components/Modal";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currency";

function DonationsTab({ donations, donationsLoaded, onReload, toast }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  const [approvingDonation, setApprovingDonation] = useState(null);
  const [approveCredit, setApproveCredit] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approveError, setApproveError] = useState("");
  const [rejectingDonation, setRejectingDonation] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectError, setRejectError] = useState("");

  const openApprove = (donation) => {
    setApprovingDonation(donation);
    setApproveCredit((donation.estimated_price / 4).toFixed(2));
    setApproveNotes("");
    setApproveError("");
  };

  const submitApprove = async (e) => {
    e.preventDefault();
    setApproveError("");
    try {
      await api.put(`/admin/donations/${approvingDonation.id}/approve`, {
        credit_amount: Number(approveCredit),
        admin_notes: approveNotes,
      });
      setApprovingDonation(null);
      onReload();
      toast("Donation approved");
    } catch (err) {
      setApproveError(
        err.response?.data?.error || "Failed to approve donation"
      );
    }
  };

  const openReject = (donation) => {
    setRejectingDonation(donation);
    setRejectNotes("");
    setRejectError("");
  };

  const submitReject = async (e) => {
    e.preventDefault();
    setRejectError("");
    try {
      await api.put(`/admin/donations/${rejectingDonation.id}/reject`, {
        admin_notes: rejectNotes,
      });
      setRejectingDonation(null);
      onReload();
      toast("Donation rejected");
    } catch (err) {
      setRejectError(err.response?.data?.error || "Failed to reject donation");
    }
  };

  return (
    <>
      <div className="section-header" data-tour="admin-donations">
        <h3>Book Donations</h3>
      </div>
      {!donationsLoaded ? (
        <div className="empty">Loading…</div>
      ) : donations.length === 0 ? (
        <div className="empty">No donations yet</div>
      ) : (
        <div className="kanban-board">
          {["pending", "approved", "rejected"].map((status) => {
            const columnDonations = donations.filter(
              (d) => d.status === status
            );
            return (
              <div className="kanban-column" key={status}>
                <div className="kanban-column-header">
                  <span
                    className={`kanban-column-dot kanban-column-dot-${status}`}
                  />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="kanban-column-count">
                    {columnDonations.length}
                  </span>
                </div>
                <div className="kanban-column-body">
                  {columnDonations.length === 0 ? (
                    <div className="kanban-empty">Nothing here</div>
                  ) : (
                    columnDonations.map((d) => (
                      <div className="kanban-card" key={d.id}>
                        <div className="kanban-card-title">
                          {d.title}
                        </div>
                        <div className="kanban-card-desc">
                          {d.author}
                          {d.genre ? ` · ${d.genre}` : ""}
                          {d.isbn ? ` · ISBN-13: ${d.isbn}` : ""}
                        </div>
                        <div className="kanban-card-meta">
                          <span>{d.username}</span>
                          <span style={{ textTransform: "capitalize" }}>
                            {d.condition}
                          </span>
                          <span>
                            {formatCurrency(d.estimated_price, currency)} est.
                          </span>
                          {d.credit_amount != null && (
                            <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                              {formatCurrency(d.credit_amount, currency)} credit
                            </span>
                          )}
                        </div>
                        <div className="kanban-card-date">
                          {new Date(
                            d.submitted_at
                          ).toLocaleDateString()}
                        </div>
                        {d.status === "pending" && (
                          <div className="btn-row kanban-card-actions">
                            <button
                              className="btn btn-sm"
                              onClick={() => openApprove(d)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => openReject(d)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {d.admin_notes && (
                          <div
                            className="kanban-card-note"
                            title={d.admin_notes}
                          >
                            Note:{" "}
                            {d.admin_notes.length > 40
                              ? d.admin_notes.slice(0, 40) + "…"
                              : d.admin_notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {approvingDonation && (
        <Modal
          title="Approve Donation"
          onClose={() => setApprovingDonation(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Approving <strong>{approvingDonation.title}</strong> by{" "}
            {approvingDonation.author} donated by{" "}
            <strong>{approvingDonation.username}</strong>. The book will be
            added to the catalogue with 1 copy.
          </p>
          <form onSubmit={submitApprove}>
            {approveError && <div className="error">{approveError}</div>}
            <div className="form-group">
              <label>Credit to award ({getCurrencySymbol(currency)})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={approveCredit}
                onChange={(e) => setApproveCredit(e.target.value)}
                required
              />
              <p className="field-hint">
                Default is 1/4 of estimated value (
                {formatCurrency(approvingDonation.estimated_price / 4, currency)}
                ). You can adjust this.
              </p>
            </div>
            <div className="form-group">
              <label>
                Admin notes{" "}
                <span
                  className="muted"
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  (optional)
                </span>
              </label>
              <input
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Any notes for the member…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setApprovingDonation(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm">
                Confirm Approval
              </button>
            </div>
          </form>
        </Modal>
      )}

      {rejectingDonation && (
        <Modal
          title="Reject Donation"
          onClose={() => setRejectingDonation(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Rejecting <strong>{rejectingDonation.title}</strong> donated by{" "}
            <strong>{rejectingDonation.username}</strong>.
          </p>
          <form onSubmit={submitReject}>
            {rejectError && <div className="error">{rejectError}</div>}
            <div className="form-group">
              <label>
                Reason{" "}
                <span
                  className="muted"
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  (optional — shown to member)
                </span>
              </label>
              <input
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Duplicate, poor condition, not in our catalogue…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setRejectingDonation(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-outline">
                Confirm Rejection
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default DonationsTab;
