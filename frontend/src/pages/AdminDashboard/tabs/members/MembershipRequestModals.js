import React from "react";
import Modal from "../../../../components/Modal";

function MembershipRequestModals({
  approvingMembershipRequest,
  setApprovingMembershipRequest,
  approveMembershipNotes,
  setApproveMembershipNotes,
  approveMembershipError,
  onSubmitApprove,
  rejectingMembershipRequest,
  setRejectingMembershipRequest,
  rejectMembershipNotes,
  setRejectMembershipNotes,
  rejectMembershipError,
  onSubmitReject,
}) {
  return (
    <>
      {approvingMembershipRequest && (
        <Modal
          title="Approve Membership Request"
          onClose={() => setApprovingMembershipRequest(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Approving{" "}
            <strong>
              {approvingMembershipRequest.requested_tier
                .charAt(0)
                .toUpperCase() +
                approvingMembershipRequest.requested_tier.slice(1)}
            </strong>{" "}
            membership for{" "}
            <strong>{approvingMembershipRequest.username}</strong>. Their tier
            will activate immediately.
          </p>
          <form onSubmit={onSubmitApprove}>
            {approveMembershipError && (
              <div className="error">{approveMembershipError}</div>
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
                value={approveMembershipNotes}
                onChange={(e) => setApproveMembershipNotes(e.target.value)}
                placeholder="Any notes for the member…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setApprovingMembershipRequest(null)}
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

      {rejectingMembershipRequest && (
        <Modal
          title="Reject Membership Request"
          onClose={() => setRejectingMembershipRequest(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Rejecting the membership request from{" "}
            <strong>{rejectingMembershipRequest.username}</strong>.
          </p>
          <form onSubmit={onSubmitReject}>
            {rejectMembershipError && (
              <div className="error">{rejectMembershipError}</div>
            )}
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
                value={rejectMembershipNotes}
                onChange={(e) => setRejectMembershipNotes(e.target.value)}
                placeholder="e.g. Payment not received yet…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setRejectingMembershipRequest(null)}
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

export default MembershipRequestModals;
