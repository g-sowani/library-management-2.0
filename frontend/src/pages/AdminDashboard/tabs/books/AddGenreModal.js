import React from "react";
import Modal from "../../../../components/Modal";

function AddGenreModal({ newGenreName, setNewGenreName, genreError, genreSaving, onClose, onSubmit }) {
  return (
    <Modal title="Add Genre" onClose={onClose}>
      <form onSubmit={onSubmit}>
        {genreError && <div className="error">{genreError}</div>}
        <div className="form-group">
          <label>Genre name</label>
          <input
            value={newGenreName}
            onChange={(e) => setNewGenreName(e.target.value)}
            placeholder="e.g. Fantasy"
            autoFocus
            required
          />
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-4)",
              marginTop: 4,
            }}
          >
            Letters only (a–z). First letter will be capitalised
            automatically.
          </div>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-sm"
            disabled={genreSaving}
          >
            {genreSaving ? "Saving…" : "Add Genre"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddGenreModal;
