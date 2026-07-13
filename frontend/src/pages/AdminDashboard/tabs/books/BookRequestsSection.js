import React from "react";
import Badge from "../../../../components/Badge";
import ColumnFilterArrow from "../../../../components/icons/ColumnFilterArrow";

function BookRequestsSection({
  bookRequestsLoaded,
  pendingBookRequests,
  onApprove,
  onReject,
  historyBookRequests,
  bookRequestHistoryOpen,
  setBookRequestHistoryOpen,
  bookRequestHistoryFilter,
  setBookRequestHistoryFilter,
}) {
  return (
    <>
      {bookRequestsLoaded && pendingBookRequests.length > 0 && (
        <>
          <div className="section-header">
            <h3>Book Requests</h3>
            <span
              className="fine-amount"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              {pendingBookRequests.length} pending
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Book</th>
                <th>Notes</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingBookRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>
                    {r.title}
                    <div
                      style={{ fontSize: "0.75rem", color: "#666" }}
                    >
                      {[r.author, r.genre]
                        .filter(Boolean)
                        .join(" · ") || (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </td>
                  <td>{r.notes || <span className="muted">—</span>}</td>
                  <td>
                    {new Date(r.submitted_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="btn-row">
                      <button
                        className="btn btn-sm"
                        onClick={() => onApprove(r)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => onReject(r)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="section-header" style={{ marginTop: 40 }}>
        <button
          type="button"
          className="history-toggle"
          onClick={() => setBookRequestHistoryOpen((o) => !o)}
          aria-expanded={bookRequestHistoryOpen}
        >
          <span
            className={`history-toggle-chevron${
              bookRequestHistoryOpen
                ? " history-toggle-chevron-open"
                : ""
            }`}
          >
            <ColumnFilterArrow />
          </span>
          Book Request History
        </button>
      </div>
      {bookRequestHistoryOpen && (
        <>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            {["", "approved", "rejected"].map((s) => (
              <button
                key={s || "all"}
                className={`btn btn-sm${
                  bookRequestHistoryFilter === s ? "" : " btn-outline"
                }`}
                onClick={() => setBookRequestHistoryFilter(s)}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </button>
            ))}
          </div>
          {historyBookRequests.length === 0 ? (
            <div className="empty">
              No past book requests
              {bookRequestHistoryFilter
                ? ` with status "${bookRequestHistoryFilter}"`
                : ""}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Book</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {historyBookRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.username}</td>
                    <td>
                      {r.title}
                      <div
                        style={{ fontSize: "0.75rem", color: "#666" }}
                      >
                        {[r.author, r.genre]
                          .filter(Boolean)
                          .join(" · ") || (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {r.notes || <span className="muted">—</span>}
                    </td>
                    <td>
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "active"
                            : "overdue"
                        }
                      >
                        {r.status.charAt(0).toUpperCase() +
                          r.status.slice(1)}
                      </Badge>
                      {r.admin_notes && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#666",
                            marginTop: 4,
                          }}
                          title={r.admin_notes}
                        >
                          Note:{" "}
                          {r.admin_notes.length > 40
                            ? r.admin_notes.slice(0, 40) + "…"
                            : r.admin_notes}
                        </div>
                      )}
                    </td>
                    <td>
                      {new Date(r.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}

export default BookRequestsSection;
