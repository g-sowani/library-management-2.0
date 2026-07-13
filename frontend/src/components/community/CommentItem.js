import React from "react";
import ReactionIcon, { REACTIONS } from "./ReactionIcon";

function CommentItem({
  comment,
  onReact,
  onReply,
  replyingToId,
  replyContent,
  setReplyContent,
  onSubmitReply,
  depth = 0,
}) {
  const isReplying = replyingToId === comment.id;
  const indentCapped = depth >= 4;
  return (
    <div className={`comment-item${depth > 0 ? " comment-reply" : ""}`}>
      <div className="comment-header">
        <span className="comment-author">{comment.author_username}</span>
        <span className="comment-date">
          {new Date(comment.created_at).toLocaleString()}
        </span>
      </div>
      <div className="comment-content">{comment.content}</div>
      <div className="comment-actions">
        {REACTIONS.map(({ key, label }) => {
          const count = comment.reactions.counts[key] || 0;
          const active = comment.reactions.user_reaction === key;
          return (
            <button
              key={key}
              className={`reaction-btn reaction-btn-sm${
                active ? " reaction-active" : ""
              }`}
              onClick={() => onReact(comment.id, key)}
              title={label}
            >
              <ReactionIcon type={key} size={12} />
              {count > 0 && <span className="reaction-count">{count}</span>}
            </button>
          );
        })}
        <button
          className="btn-link"
          onClick={() => onReply(isReplying ? null : comment.id)}
        >
          {isReplying ? "Cancel" : "Reply"}
        </button>
      </div>
      {isReplying && (
        <div className="reply-form">
          <textarea
            className="comment-input"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={`Reply to ${comment.author_username}…`}
            rows={2}
            autoFocus
          />
          <button
            className="btn btn-sm"
            onClick={() => onSubmitReply(comment.id)}
            disabled={!replyContent.trim()}
          >
            Reply
          </button>
        </div>
      )}
      {comment.replies?.length > 0 && (
        <div
          className={`replies-list${indentCapped ? " replies-list-flat" : ""}`}
        >
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReact={onReact}
              onReply={onReply}
              replyingToId={replyingToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              onSubmitReply={onSubmitReply}
              depth={indentCapped ? depth : depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentItem;
