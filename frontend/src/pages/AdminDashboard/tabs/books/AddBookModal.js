import React from "react";
import Modal from "../../../../components/Modal";
import Select from "../../../../components/Select";

function AddBookModal({ bookField, allGenres, bookError, onClose, onSubmit }) {
  return (
    <Modal
      title="Add Book"
      subtitle="Add a new title to the library catalogue."
      wide
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="modal-form-grid">
        {bookError && <div className="error">{bookError}</div>}
        <div className="form-group form-group-full">
          <label>Title</label>
          <input {...bookField("title")} required autoFocus />
        </div>
        <div className="form-group">
          <label>Author</label>
          <input {...bookField("author")} required />
        </div>
        <div className="form-group">
          <label>ISBN-13</label>
          <input {...bookField("isbn")} required />
        </div>
        <div className="form-group">
          <label>Genre</label>
          <Select {...bookField("genre")}>
            <option value="">Select genre</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <div className="form-group">
          <label>Copies</label>
          <input
            type="number"
            min="1"
            {...bookField("total_copies")}
            required
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn">
            Add Book
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddBookModal;
