import React from "react";

function RefreshLogPanel({
  refreshModalTitle,
  onClose,
  refreshProgress,
  refreshLog,
  refreshingAll,
  refreshingBookId,
  refreshBookId,
  onManualEdit,
  onOpenCoverUpload,
}) {
  return (
    <div className="refresh-panel">
      <div className="refresh-panel-header">
        <span className="refresh-panel-title">{refreshModalTitle}</span>
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="refresh-panel-body">
        {refreshProgress && (
          <div className="refresh-progress">
            <div className="refresh-progress-bar">
              <div
                style={{
                  width: `${
                    (refreshProgress.done / refreshProgress.total) * 100
                  }%`,
                }}
              />
            </div>
            <span className="refresh-progress-label">
              {refreshProgress.done} / {refreshProgress.total}
            </span>
          </div>
        )}
        <div className="refresh-log">
          {refreshLog.map((entry, i) => (
            <div
              key={i}
              className={`refresh-log-entry ${
                entry.ok ? "refresh-log-ok" : "refresh-log-error"
              }`}
            >
              <span className="refresh-log-icon">
                {entry.ok ? "✓" : "✗"}
              </span>
              <span className="refresh-log-title">{entry.title}</span>
              <span className="refresh-log-details">
                {entry.ok
                  ? entry.loaded.length > 0
                    ? entry.loaded.join(", ")
                    : "no data found"
                  : "failed"}
              </span>
            </div>
          ))}
          {(refreshingAll || refreshingBookId) &&
            refreshLog.length === 0 && (
              <div className="refresh-log-entry refresh-log-pending">
                <span className="refresh-log-icon">⋯</span>
                <span className="refresh-log-title">Working…</span>
              </div>
            )}
        </div>
        {!refreshingAll &&
          !refreshingBookId &&
          refreshBookId &&
          refreshLog.length > 0 &&
          (() => {
            const loaded = refreshLog[0]?.loaded || [];
            const missingDesc = !loaded.includes("description");
            const missingBio = !loaded.includes("author bio");
            const missingCover = !loaded.includes("cover");
            if (!missingDesc && !missingBio && !missingCover) return null;
            return (
              <div className="refresh-fill-section">
                <div className="refresh-fill-label">Fill missing</div>
                <div className="refresh-fill-actions">
                  {missingDesc && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        onManualEdit(refreshBookId, "description")
                      }
                    >
                      Description
                    </button>
                  )}
                  {missingBio && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        onManualEdit(refreshBookId, "author_bio")
                      }
                    >
                      Author bio
                    </button>
                  )}
                  {missingCover && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => onOpenCoverUpload(refreshBookId)}
                    >
                      Upload cover
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

export default RefreshLogPanel;
