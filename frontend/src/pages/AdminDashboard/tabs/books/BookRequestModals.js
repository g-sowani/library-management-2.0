import React from "react";
import Modal from "../../../../components/Modal";
import Select from "../../../../components/Select";

function BookRequestModals({
  approvingBookRequest,
  setApprovingBookRequest,
  approveBookTitle,
  setApproveBookTitle,
  approveBookAuthor,
  setApproveBookAuthor,
  approveBookIsbn,
  setApproveBookIsbn,
  approveBookGenre,
  setApproveBookGenre,
  approveBookCopies,
  setApproveBookCopies,
  approveBookNotes,
  setApproveBookNotes,
  approveBookError,
  genres,
  onSubmitApprove,
  rejectingBookRequest,
  setRejectingBookRequest,
  rejectBookNotes,
  setRejectBookNotes,
  rejectBookError,
  onSubmitReject,
}) {
  return (
    <>
      {approvingBookRequest && (
        <Modal
          title="Approve Book Request"
          onClose={() => setApprovingBookRequest(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Approving <strong>{approvingBookRequest.username}</strong>'s
            request. Review the details below, then add it to the catalogue.
          </p>
          <form onSubmit={onSubmitApprove}>
            {approveBookError && (
              <div className="error">{approveBookError}</div>
            )}
            <div className="form-group">
              <label>Title *</label>
              <input
                value={approveBookTitle}
                onChange={(e) => setApproveBookTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Author *</label>
              <input
                value={approveBookAuthor}
                onChange={(e) => setApproveBookAuthor(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>
                ISBN-13{" "}
                <span
                  className="muted"
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  (optional)
                </span>
              </label>
              <input
                value={approveBookIsbn}
                onChange={(e) => setApproveBookIsbn(e.target.value)}
                placeholder="e.g. 978-0747532743"
              />
            </div>
            <div className="form-group">
              <label>
                Genre{" "}
                <span
                  className="muted"
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  (optional)
                </span>
              </label>
              <Select
                value={approveBookGenre}
                onChange={(e) => setApproveBookGenre(e.target.value)}
              >
                <option value="">Select genre</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <div className="form-group">
              <label>Copies to add</label>
              <input
                type="number"
                min="1"
                value={approveBookCopies}
                onChange={(e) => setApproveBookCopies(e.target.value)}
              />
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
                value={approveBookNotes}
                onChange={(e) => setApproveBookNotes(e.target.value)}
                placeholder="Any notes for the member…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setApprovingBookRequest(null)}
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

      {rejectingBookRequest && (
        <Modal
          title="Reject Book Request"
          onClose={() => setRejectingBookRequest(null)}
        >
          <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
            Rejecting the request for{" "}
            <strong>"{rejectingBookRequest.title}"</strong> from{" "}
            <strong>{rejectingBookRequest.username}</strong>.
          </p>
          <form onSubmit={onSubmitReject}>
            {rejectBookError && (
              <div className="error">{rejectBookError}</div>
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
                value={rejectBookNotes}
                onChange={(e) => setRejectBookNotes(e.target.value)}
                placeholder="e.g. Couldn't source this title…"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setRejectingBookRequest(null)}
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

export default BookRequestModals;
