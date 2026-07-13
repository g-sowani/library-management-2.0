import React from "react";
import Modal from "../../../components/Modal";
import StarPicker from "../../../components/StarPicker";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/currency";

function ReturnModal({
  returnModal,
  onClose,
  markComplete,
  setMarkComplete,
  returnHasUnpaidFine,
  payFineWithReturn,
  setPayFineWithReturn,
  reviewRating,
  setReviewRating,
  reviewHover,
  setReviewHover,
  reviewText,
  setReviewText,
  reviewAnonymous,
  setReviewAnonymous,
  onSubmit,
}) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <Modal title="Return Book" onClose={onClose}>
      <p style={{ marginBottom: 20, fontSize: "0.9rem", color: "#555" }}>
        Returning <strong>{returnModal.bookTitle}</strong>
      </p>

      <div className="anonymous-row" style={{ marginBottom: 20 }}>
        <input
          type="checkbox"
          id="mark-complete-check"
          checked={markComplete}
          onChange={(e) => setMarkComplete(e.target.checked)}
        />
        <label htmlFor="mark-complete-check">
          Mark as complete — count this toward my reading goals
        </label>
      </div>

      {returnHasUnpaidFine && (
        <div className="return-fine-notice">
          <div className="return-fine-amount">
            Fine due: <strong>{formatCurrency(returnModal.fine, currency)}</strong>
          </div>
          <div className="anonymous-row">
            <input
              type="checkbox"
              id="pay-fine-check"
              checked={payFineWithReturn}
              onChange={(e) => setPayFineWithReturn(e.target.checked)}
            />
            <label htmlFor="pay-fine-check">
              I'm paying this fine now — submit for admin verification
            </label>
          </div>
          {!payFineWithReturn && (
            <p className="return-fine-hint">
              This book has an unpaid fine. Check the box above to submit
              your fine payment along with the return for the library to
              verify.
            </p>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div className="book-detail-label" style={{ marginBottom: 10 }}>
          Rate this book{" "}
          <span
            className="muted"
            style={{ textTransform: "none", fontSize: "0.75rem" }}
          >
            (optional)
          </span>
        </div>
        <StarPicker
          value={reviewRating}
          hover={reviewHover}
          onRate={setReviewRating}
          onHover={setReviewHover}
          onLeave={() => setReviewHover(0)}
        />
        {reviewRating > 0 && (
          <span
            style={{ marginLeft: 8, fontSize: "0.85rem", color: "#888" }}
          >
            {reviewRating} / 5
          </span>
        )}
      </div>

      {reviewRating > 0 && (
        <>
          <div className="form-group">
            <label>
              Write a review{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your thoughts about this book…"
              className="review-textarea"
            />
          </div>
          <div className="anonymous-row">
            <input
              type="checkbox"
              id="anon-check"
              checked={reviewAnonymous}
              onChange={(e) => setReviewAnonymous(e.target.checked)}
            />
            <label htmlFor="anon-check">Post as Anonymous</label>
          </div>
        </>
      )}

      <div className="modal-actions">
        <button
          className="btn btn-sm btn-outline"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="btn btn-sm"
          onClick={onSubmit}
          disabled={returnHasUnpaidFine && !payFineWithReturn}
        >
          {returnHasUnpaidFine
            ? "Submit Return & Fine Payment"
            : reviewRating > 0
            ? "Submit & Return"
            : "Return"}
        </button>
      </div>
    </Modal>
  );
}

export default ReturnModal;
