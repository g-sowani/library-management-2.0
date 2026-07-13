import React from "react";
import Modal from "../../../../components/Modal";

function CoverUploadModal({
  coverUploadMode,
  setCoverUploadMode,
  coverUploadPreview,
  setCoverUploadPreview,
  coverUploadUrl,
  setCoverUploadUrl,
  coverUploadSaving,
  coverUploadError,
  onClose,
  onFileChange,
  onSave,
}) {
  return (
    <Modal
      title="Upload Cover"
      onClose={onClose}
    >
      <div className="cover-upload-tabs">
        <button
          className={`cover-upload-tab${
            coverUploadMode === "file" ? " active" : ""
          }`}
          onClick={() => {
            setCoverUploadMode("file");
            setCoverUploadPreview("");
          }}
        >
          Upload file
        </button>
        <button
          className={`cover-upload-tab${
            coverUploadMode === "url" ? " active" : ""
          }`}
          onClick={() => {
            setCoverUploadMode("url");
            setCoverUploadUrl("");
          }}
        >
          From URL
        </button>
      </div>
      {coverUploadError && (
        <div className="error" style={{ marginBottom: 12 }}>
          {coverUploadError}
        </div>
      )}
      {coverUploadMode === "file" && (
        <div className="cover-upload-file">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
          />
          {coverUploadPreview && (
            <img
              src={coverUploadPreview}
              alt="Cover preview"
              className="cover-upload-preview"
            />
          )}
        </div>
      )}
      {coverUploadMode === "url" && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Image URL</label>
          <input
            type="text"
            value={coverUploadUrl}
            onChange={(e) => setCoverUploadUrl(e.target.value)}
            placeholder="https://…"
          />
          {coverUploadUrl && (
            <img
              src={coverUploadUrl}
              alt="Cover preview"
              className="cover-upload-preview"
              onError={(e) => {
                e.target.style.display = "none";
              }}
              onLoad={(e) => {
                e.target.style.display = "block";
              }}
            />
          )}
        </div>
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
          onClick={onSave}
          disabled={
            coverUploadSaving ||
            (coverUploadMode === "file"
              ? !coverUploadPreview
              : !coverUploadUrl.trim())
          }
        >
          {coverUploadSaving ? "Saving…" : "Save Cover"}
        </button>
      </div>
    </Modal>
  );
}

export default CoverUploadModal;
