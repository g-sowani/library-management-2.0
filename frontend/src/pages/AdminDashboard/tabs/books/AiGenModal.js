import React from "react";
import Modal from "../../../../components/Modal";

function AiGenModal({
  aiGenModal,
  aiGenContent,
  setAiGenContent,
  aiGenLoading,
  aiGenSlow,
  aiGenError,
  aiGenSaving,
  onClose,
  onWriteManually,
  onRegenerate,
  onSave,
}) {
  return (
    <Modal
      title={`${aiGenModal.mode === "edit" ? "Edit" : "Generate"} ${
        aiGenModal.field === "author_bio" ? "Author Bio" : "Description"
      } for ${aiGenModal.bookTitle}`}
      onClose={onClose}
      wide
    >
      {aiGenError && (
        <div className="error" style={{ marginBottom: 12 }}>
          {aiGenError}
        </div>
      )}
      {aiGenLoading ? (
        <div
          className="empty"
          style={{
            padding: "24px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>Generating…</span>
          {aiGenSlow && (
            <>
              <span style={{ fontSize: "0.8rem" }}>
                This is taking longer than expected.
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={onWriteManually}
              >
                Write it yourself instead
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="form-group">
          <label>
            {aiGenModal.mode === "edit" ? "Content" : "Generated content"}{" "}
            <span
              className="muted"
              style={{ textTransform: "none", fontSize: "0.75rem" }}
            >
              (editable)
            </span>
          </label>
          <textarea
            className="ai-gen-textarea"
            value={aiGenContent}
            onChange={(e) => setAiGenContent(e.target.value)}
            rows={6}
            placeholder={
              aiGenModal.mode === "edit"
                ? "Type the content here…"
                : "Generated content will appear here…"
            }
          />
        </div>
      )}
      <div className="modal-actions">
        <button
          className="btn btn-sm btn-outline"
          onClick={onClose}
          disabled={aiGenSaving}
        >
          Cancel
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={onRegenerate}
          disabled={aiGenLoading || aiGenSaving}
        >
          {aiGenModal.mode === "edit" ? "Generate with AI" : "Regenerate"}
        </button>
        <button
          className="btn btn-sm"
          onClick={onSave}
          disabled={aiGenLoading || aiGenSaving || !aiGenContent.trim()}
        >
          {aiGenSaving
            ? "Saving…"
            : aiGenModal.mode === "edit"
            ? "Save"
            : "Approve & Save"}
        </button>
      </div>
    </Modal>
  );
}

export default AiGenModal;
