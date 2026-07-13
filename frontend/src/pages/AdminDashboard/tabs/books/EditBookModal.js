import React from "react";
import Modal from "../../../../components/Modal";
import Select from "../../../../components/Select";

function EditBookModal({
  editingBook,
  editForm,
  editField,
  allGenres,
  editError,
  isDiscarding,
  borrowed,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      title={`Editing "${editingBook.title}"`}
      subtitle="Update this title's details, genre, and copy count."
      wide
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="modal-form-grid">
        {editError && <div className="error">{editError}</div>}
        <div className="form-group form-group-full">
          <label>Title</label>
          <input {...editField("title")} required autoFocus />
        </div>
        <div className="form-group">
          <label>Author</label>
          <input {...editField("author")} required />
        </div>
        <div className="form-group">
          <label>ISBN-13</label>
          <input {...editField("isbn")} required />
        </div>
        <div className="form-group">
          <label>Genre</label>
          <Select {...editField("genre")}>
            <option value="">Select genre</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <div className="form-group">
          <label>Total Copies</label>
          <input
            type="number"
            min="1"
            {...editField("total_copies")}
            required
          />
          {borrowed > 0 && (
            <p className="field-hint">
              {borrowed} currently borrowed — minimum is {borrowed}
            </p>
          )}
        </div>
        {isDiscarding && (
          <div className="form-group discard-reason form-group-full">
            <label>
              Reason for Discarding <span className="required">*</span>
            </label>
            <input
              {...editField("discard_reason")}
              placeholder="e.g. Damaged, lost, worn out…"
              required
            />
            <p className="field-hint">
              Discarding{" "}
              {editingBook.total_copies - Number(editForm.total_copies)}{" "}
              copy/copies — this will be logged
            </p>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn">
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditBookModal;
