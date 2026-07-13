import React from "react";
import Modal from "../../../components/Modal";

function ReAuthModal({
  reAuthPassword,
  setReAuthPassword,
  reAuthError,
  reAuthLoading,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title="Confirm Your Identity"
      onClose={onClose}
    >
      <p
        style={{
          marginBottom: 16,
          fontSize: "0.9rem",
          color: "var(--text-secondary, #555)",
        }}
      >
        This action requires you to re-enter your password to continue.
      </p>
      {reAuthError && (
        <div className="error" style={{ marginBottom: 12 }}>
          {reAuthError}
        </div>
      )}
      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={reAuthPassword}
          onChange={(e) => setReAuthPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          autoFocus
          placeholder="Enter your password"
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          className="btn btn-sm"
          onClick={onConfirm}
          disabled={reAuthLoading || !reAuthPassword}
        >
          {reAuthLoading ? "Verifying…" : "Confirm"}
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export default ReAuthModal;
