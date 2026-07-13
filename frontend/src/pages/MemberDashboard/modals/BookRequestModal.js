import React from "react";
import Modal from "../../../components/Modal";
import Select from "../../../components/Select";
import { GENRES } from "../../../constants";

function BookRequestModal({
  bookRequestForm,
  setBookRequestForm,
  bookRequestError,
  bookRequestSuccess,
  setBookRequestSuccess,
  onClose,
  onSubmit,
}) {
  return (
    <Modal title="Request a Book" onClose={onClose}>
      {bookRequestSuccess ? (
        <>
          <p style={{ color: "#2e7d32", marginBottom: 20 }}>
            Your request has been submitted! The admin will review it —
            you'll see the outcome on your Home tab once it's reviewed.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-sm"
              onClick={() => {
                onClose();
                setBookRequestSuccess(false);
              }}
            >
              Close
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          {bookRequestError && (
            <div className="error">{bookRequestError}</div>
          )}
          <div className="form-group">
            <label>Title *</label>
            <input
              value={bookRequestForm.title}
              onChange={(e) =>
                setBookRequestForm({
                  ...bookRequestForm,
                  title: e.target.value,
                })
              }
              placeholder="Book title"
              required
            />
          </div>
          <div className="form-group">
            <label>
              Author{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </label>
            <input
              value={bookRequestForm.author}
              onChange={(e) =>
                setBookRequestForm({
                  ...bookRequestForm,
                  author: e.target.value,
                })
              }
              placeholder="Author name"
            />
          </div>
          <div className="form-group">
            <label>
              ISBN{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </label>
            <input
              value={bookRequestForm.isbn}
              onChange={(e) =>
                setBookRequestForm({
                  ...bookRequestForm,
                  isbn: e.target.value,
                })
              }
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
              value={bookRequestForm.genre}
              onChange={(e) =>
                setBookRequestForm({
                  ...bookRequestForm,
                  genre: e.target.value,
                })
              }
            >
              <option value="">— Select genre —</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-group">
            <label>
              Notes{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional — anything that helps us find it)
              </span>
            </label>
            <textarea
              value={bookRequestForm.notes}
              onChange={(e) =>
                setBookRequestForm({
                  ...bookRequestForm,
                  notes: e.target.value,
                })
              }
              placeholder="e.g. edition, why you'd like it added…"
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm">
              Submit Request
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default BookRequestModal;
