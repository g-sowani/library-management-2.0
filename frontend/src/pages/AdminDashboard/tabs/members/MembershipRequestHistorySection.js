import React from "react";
import Badge from "../../../../components/Badge";
import ColumnFilterArrow from "../../../../components/icons/ColumnFilterArrow";

function MembershipRequestHistorySection({
  membershipRequestHistoryOpen,
  setMembershipRequestHistoryOpen,
  membershipRequestHistoryFilter,
  setMembershipRequestHistoryFilter,
  historyMembershipRequests,
}) {
  return (
    <>
      <div className="section-header" style={{ marginTop: 40 }}>
        <button
          type="button"
          className="history-toggle"
          onClick={() => setMembershipRequestHistoryOpen((o) => !o)}
          aria-expanded={membershipRequestHistoryOpen}
        >
          <span
            className={`history-toggle-chevron${
              membershipRequestHistoryOpen
                ? " history-toggle-chevron-open"
                : ""
            }`}
          >
            <ColumnFilterArrow />
          </span>
          Membership Request History
        </button>
      </div>
      {membershipRequestHistoryOpen && (
        <>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            {["", "approved", "rejected"].map((s) => (
              <button
                key={s || "all"}
                className={`btn btn-sm${
                  membershipRequestHistoryFilter === s
                    ? ""
                    : " btn-outline"
                }`}
                onClick={() => setMembershipRequestHistoryFilter(s)}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </button>
            ))}
          </div>
          {historyMembershipRequests.length === 0 ? (
            <div className="empty">
              No past membership requests
              {membershipRequestHistoryFilter
                ? ` with status "${membershipRequestHistoryFilter}"`
                : ""}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Requested Tier</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {historyMembershipRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.username}</td>
                    <td>
                      <span
                        className={`membership-badge membership-badge-${r.requested_tier}`}
                      >
                        {r.requested_tier.charAt(0).toUpperCase() +
                          r.requested_tier.slice(1)}
                      </span>
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

export default MembershipRequestHistorySection;
