import React from "react";
import Modal from "../../../../components/Modal";

function CreateCommunityModal({
  communityForm,
  setCommunityForm,
  communityFormError,
  communityIconInputRef,
  communityBannerInputRef,
  onClose,
  onSubmit,
  onIconChange,
  onBannerChange,
}) {
  return (
    <Modal
      title={communityForm.id ? "Edit Community" : "Create a Community"}
      onClose={onClose}
    >
      {!communityForm.id && (
        <p
          style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}
        >
          Communities require admin approval before members can join.
          You'll be notified once reviewed.
        </p>
      )}
      <form onSubmit={onSubmit}>
        {communityFormError && (
          <div className="error">{communityFormError}</div>
        )}
        <div className="form-group">
          <label>
            Banner{" "}
            <span
              className="muted"
              style={{ textTransform: "none", fontSize: "0.75rem" }}
            >
              (optional)
            </span>
          </label>
          <div
            className="community-banner-picker"
            style={
              communityForm.banner_url
                ? { backgroundImage: `url(${communityForm.banner_url})` }
                : undefined
            }
            onClick={() => communityBannerInputRef.current?.click()}
          >
            {!communityForm.banner_url && (
              <span className="community-banner-picker-hint">
                Click to upload a banner image
              </span>
            )}
          </div>
          <input
            ref={communityBannerInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onBannerChange}
          />
        </div>
        <div className="form-group">
          <label>
            Icon{" "}
            <span
              className="muted"
              style={{ textTransform: "none", fontSize: "0.75rem" }}
            >
              (optional)
            </span>
          </label>
          <div className="community-icon-picker-row">
            <div
              className="community-icon-picker"
              onClick={() => communityIconInputRef.current?.click()}
            >
              {communityForm.icon_url ? (
                <img
                  src={communityForm.icon_url}
                  alt=""
                  className="community-icon-picker-img"
                />
              ) : (
                <span className="community-icon-picker-placeholder">
                  {(communityForm.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="community-icon-picker-hint">
              Click to upload an icon
            </span>
          </div>
          <input
            ref={communityIconInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onIconChange}
          />
        </div>
        <div className="form-group">
          <label>Name *</label>
          <input
            value={communityForm.name}
            onChange={(e) =>
              setCommunityForm({ ...communityForm, name: e.target.value })
            }
            placeholder="e.g. Sci-Fi Readers, Book Club…"
            required
          />
        </div>
        <div className="form-group">
          <label>
            Description{" "}
            <span
              className="muted"
              style={{ textTransform: "none", fontSize: "0.75rem" }}
            >
              (optional)
            </span>
          </label>
          <textarea
            className="comment-input"
            value={communityForm.description}
            onChange={(e) =>
              setCommunityForm({
                ...communityForm,
                description: e.target.value,
              })
            }
            placeholder="What is this community about?"
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
            {communityForm.id ? "Save Changes" : "Submit for Approval"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateCommunityModal;
