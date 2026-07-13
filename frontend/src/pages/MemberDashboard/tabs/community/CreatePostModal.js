import React from "react";
import Modal from "../../../../components/Modal";

function CreatePostModal({ postForm, setPostForm, postFormError, onClose, onSubmit }) {
  return (
    <Modal title="New Post" onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        {postFormError && <div className="error">{postFormError}</div>}
        <div className="form-group">
          <label>Title *</label>
          <input
            value={postForm.title}
            onChange={(e) =>
              setPostForm({ ...postForm, title: e.target.value })
            }
            placeholder="Post title…"
            required
          />
        </div>
        <div className="form-group">
          <label>Content *</label>
          <textarea
            className="comment-input"
            value={postForm.content}
            onChange={(e) =>
              setPostForm({ ...postForm, content: e.target.value })
            }
            placeholder="What's on your mind?"
            rows={6}
            required
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
            Post
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CreatePostModal;
