import React, { useState } from "react";
import api from "../../../api";
import Modal from "../../../components/Modal";

function CommunitiesTab({ adminCommunities, adminCommunitiesLoaded, onReload, toast }) {
  const [approvingCommunity, setApprovingCommunity] = useState(null);
  const [communityApproveNotes, setCommunityApproveNotes] = useState("");
  const [communityApproveError, setCommunityApproveError] = useState("");
  const [rejectingCommunity, setRejectingCommunity] = useState(null);
  const [communityRejectNotes, setCommunityRejectNotes] = useState("");
  const [communityRejectError, setCommunityRejectError] = useState("");

  const submitApproveCommunity = async (e) => {
    e.preventDefault();
    setCommunityApproveError("");
    try {
      await api.put(`/admin/communities/${approvingCommunity.id}/approve`, {
        admin_notes: communityApproveNotes,
      });
      setApprovingCommunity(null);
      onReload();
      toast("Community approved");
    } catch (err) {
      setCommunityApproveError(
        err.response?.data?.error || "Failed to approve"
      );
    }
  };

  const submitRejectCommunity = async (e) => {
    e.preventDefault();
    setCommunityRejectError("");
    try {
      await api.put(`/admin/communities/${rejectingCommunity.id}/reject`, {
        admin_notes: communityRejectNotes,
      });
      setRejectingCommunity(null);
      onReload();
      toast("Community rejected");
    } catch (err) {
      setCommunityRejectError(err.response?.data?.error || "Failed to reject");
    }
  };

  return (
    <>
      <div className="section-header" data-tour="admin-communities">
        <h3>Community Requests</h3>
      </div>
      {!adminCommunitiesLoaded ? (
        <div className="empty">Loading…</div>
      ) : adminCommunities.length === 0 ? (
        <div className="empty">No community requests yet</div>
      ) : (
        <div className="kanban-board">
          {["pending", "approved", "rejected"].map((status) => {
            const columnCommunities = adminCommunities.filter(
              (c) => c.status === status
            );
            return (
              <div className="kanban-column" key={status}>
                <div className="kanban-column-header">
                  <span
                    className={`kanban-column-dot kanban-column-dot-${status}`}
                  />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="kanban-column-count">
                    {columnCommunities.length}
                  </span>
                </div>
                <div className="kanban-column-body">
                  {columnCommunities.length === 0 ? (
                    <div className="kanban-empty">Nothing here</div>
                  ) : (
                    columnCommunities.map((c) => (
                      <div className="kanban-card" key={c.id}>
                        <div className="kanban-card-title">
                          {c.name}
                        </div>
                        <div className="kanban-card-desc">
                          {c.description || (
                            <span className="muted">
                              No description
                            </span>
                          )}
                        </div>
                        <div className="kanban-card-meta">
                          <span>{c.creator_username}</span>
                          <span>{c.member_count} members</span>
                          <span>{c.post_count} posts</span>
                        </div>
                        <div className="kanban-card-date">
                          {new Date(
                            c.created_at
                          ).toLocaleDateString()}
                        </div>
                        {status === "pending" && (
                          <div className="btn-row kanban-card-actions">
                            <button
                              className="btn btn-sm"
                              onClick={() => {
                                setApprovingCommunity(c);
                                setCommunityApproveNotes("");
                                setCommunityApproveError("");
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => {
                                setRejectingCommunity(c);
                                setCommunityRejectNotes("");
                                setCommunityRejectError("");
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {c.admin_notes && (
                          <div
                            className="kanban-card-note"
                            title={c.admin_notes}
                          >
                            Note:{" "}
                            {c.admin_notes.length > 40
                              ? c.admin_notes.slice(0, 40) + "…"
                              : c.admin_notes}
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

      {approvingCommunity && (
        <Modal
          title="Approve Community"
          onClose={() => setApprovingCommunity(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Approving <strong>{approvingCommunity.name}</strong> created by{" "}
            <strong>{approvingCommunity.creator_username}</strong>. The
            creator will automatically be added as a moderator.
          </p>
          <form onSubmit={submitApproveCommunity}>
            {communityApproveError && (
              <div className="error">{communityApproveError}</div>
            )}
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
                value={communityApproveNotes}
                onChange={(e) => setCommunityApproveNotes(e.target.value)}
                placeholder="Any notes for the community creator…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setApprovingCommunity(null)}
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

      {rejectingCommunity && (
        <Modal
          title="Reject Community"
          onClose={() => setRejectingCommunity(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Rejecting <strong>{rejectingCommunity.name}</strong> submitted by{" "}
            <strong>{rejectingCommunity.creator_username}</strong>.
          </p>
          <form onSubmit={submitRejectCommunity}>
            {communityRejectError && (
              <div className="error">{communityRejectError}</div>
            )}
            <div className="form-group">
              <label>
                Reason{" "}
                <span
                  className="muted"
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  (optional — shown to creator)
                </span>
              </label>
              <input
                value={communityRejectNotes}
                onChange={(e) => setCommunityRejectNotes(e.target.value)}
                placeholder="e.g. Duplicate community, inappropriate name…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setRejectingCommunity(null)}
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

export default CommunitiesTab;
