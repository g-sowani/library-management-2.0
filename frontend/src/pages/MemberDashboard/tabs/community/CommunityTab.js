import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api";
import Badge from "../../../../components/Badge";
import SearchBar from "../../../../components/SearchBar";
import LockIcon from "../../../../components/icons/LockIcon";
import ChevronLeft from "../../../../components/icons/ChevronLeft";
import CommentItem from "../../../../components/community/CommentItem";
import ReactionIcon, { REACTIONS } from "../../../../components/community/ReactionIcon";
import { patchReaction } from "../../../../components/community/patchReaction";
import { resizeImageToBase64 } from "../../../../utils/resizeImageToBase64";
import CreateCommunityModal from "./CreateCommunityModal";
import CreatePostModal from "./CreatePostModal";

const EMPTY_COMMUNITY_FORM = {
  id: null,
  name: "",
  description: "",
  icon_url: "",
  banner_url: "",
};

function CommunityTab({ isGold, user, toast }) {
  const [communityView, setCommunityView] = useState("list"); // 'list' | 'community' | 'post'
  const [communities, setCommunities] = useState([]);
  const [myCommunities, setMyCommunities] = useState([]);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityForm, setCommunityForm] = useState(EMPTY_COMMUNITY_FORM);
  const [communityFormError, setCommunityFormError] = useState("");
  const communityIconInputRef = useRef(null);
  const communityBannerInputRef = useRef(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", content: "" });
  const [postFormError, setPostFormError] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState("");

  const loadCommunities = useCallback(async () => {
    try {
      const [listRes, mineRes] = await Promise.all([
        api.get("/communities"),
        api.get("/my-communities"),
      ]);
      setCommunities(listRes.data);
      setMyCommunities(mineRes.data);
      setCommunitiesLoaded(true);
    } catch {
      setCommunitiesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isGold) loadCommunities();
  }, [isGold, loadCommunities]);

  const openCommunity = async (community) => {
    setSelectedCommunity(community);
    setCommunityView("community");
    setCommunityPosts([]);
    setSelectedPost(null);
    setExpandedPostId(null);
    setPostsLoading(true);
    try {
      const r = await api.get(`/communities/${community.id}/posts`);
      setCommunityPosts(r.data);
    } finally {
      setPostsLoading(false);
    }
  };

  const togglePostComments = async (post) => {
    if (expandedPostId === post.id) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(post.id);
    setSelectedPost(null);
    setPostLoading(true);
    setCommentContent("");
    setCommentError("");
    setReplyingToId(null);
    setReplyContent("");
    try {
      const r = await api.get(
        `/communities/${selectedCommunity.id}/posts/${post.id}`
      );
      setSelectedPost(r.data);
    } finally {
      setPostLoading(false);
    }
  };

  const joinCommunity = async (community) => {
    try {
      const r = await api.post(`/communities/${community.id}/join`);
      await loadCommunities();
      openCommunity(r.data);
      toast("Joined community!");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to join community", "error");
    }
  };

  const leaveCommunity = async (cid) => {
    try {
      await api.delete(`/communities/${cid}/leave`);
      setCommunityView("list");
      loadCommunities();
      toast("Left community");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to leave community", "error");
    }
  };

  const openEditCommunity = (c) => {
    setCommunityForm({
      id: c.id,
      name: c.name,
      description: c.description || "",
      icon_url: c.icon_url || "",
      banner_url: c.banner_url || "",
    });
    setCommunityFormError("");
    setShowCreateCommunity(true);
  };

  const handleCommunityIconChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCommunityFormError("Icon image must be under 5 MB");
      return;
    }
    try {
      const base64 = await resizeImageToBase64(file, 200);
      setCommunityForm((f) => ({ ...f, icon_url: base64 }));
    } catch {
      setCommunityFormError("Failed to process icon image");
    }
  };

  const handleCommunityBannerChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCommunityFormError("Banner image must be under 5 MB");
      return;
    }
    try {
      const base64 = await resizeImageToBase64(file, 1000);
      setCommunityForm((f) => ({ ...f, banner_url: base64 }));
    } catch {
      setCommunityFormError("Failed to process banner image");
    }
  };

  const submitCommunityForm = async (e) => {
    e.preventDefault();
    setCommunityFormError("");
    const payload = {
      name: communityForm.name,
      description: communityForm.description,
      icon_url: communityForm.icon_url,
      banner_url: communityForm.banner_url,
    };
    try {
      if (communityForm.id) {
        await api.put(`/communities/${communityForm.id}`, payload);
        toast("Community updated");
      } else {
        await api.post("/communities", payload);
        toast("Community submitted for review");
      }
      setShowCreateCommunity(false);
      setCommunityForm(EMPTY_COMMUNITY_FORM);
      loadCommunities();
    } catch (err) {
      setCommunityFormError(
        err.response?.data?.error ||
          (communityForm.id
            ? "Failed to update community"
            : "Failed to create community")
      );
    }
  };

  const submitCreatePost = async (e) => {
    e.preventDefault();
    setPostFormError("");
    try {
      await api.post(`/communities/${selectedCommunity.id}/posts`, postForm);
      setShowCreatePost(false);
      setPostForm({ title: "", content: "" });
      const r = await api.get(`/communities/${selectedCommunity.id}/posts`);
      setCommunityPosts(r.data);
      toast("Post published!");
    } catch (err) {
      setPostFormError(err.response?.data?.error || "Failed to create post");
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    setCommentError("");
    try {
      await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments`,
        {
          content: commentContent,
        }
      );
      setCommentContent("");
      const r = await api.get(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}`
      );
      setSelectedPost(r.data);
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === r.data.id ? { ...p, comment_count: r.data.comment_count } : p
        )
      );
    } catch (err) {
      setCommentError(err.response?.data?.error || "Failed to post comment");
    }
  };

  const submitReply = async (parentId) => {
    if (!replyContent.trim()) return;
    try {
      await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments`,
        {
          content: replyContent,
          parent_id: parentId,
        }
      );
      setReplyContent("");
      setReplyingToId(null);
      const r = await api.get(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}`
      );
      setSelectedPost(r.data);
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === r.data.id ? { ...p, comment_count: r.data.comment_count } : p
        )
      );
    } catch (err) {
      setCommentError(err.response?.data?.error || "Failed to post reply");
    }
  };

  const reactPost = async (post, emoji) => {
    try {
      const r = await api.post(
        `/communities/${selectedCommunity.id}/posts/${post.id}/react`,
        { emoji }
      );
      setCommunityPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, reactions: r.data } : p))
      );
      setSelectedPost((prev) =>
        prev && prev.id === post.id ? { ...prev, reactions: r.data } : prev
      );
    } catch {}
  };

  const reactComment = async (commentId, emoji) => {
    try {
      const r = await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments/${commentId}/react`,
        { emoji }
      );
      setSelectedPost((prev) => ({
        ...prev,
        comments: patchReaction(prev.comments, commentId, r.data),
      }));
    } catch {}
  };

  const filteredCommunities = useMemo(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [communities, communitySearch]);

  if (!isGold) {
    return (
      <div className="community-locked">
        <div className="community-locked-icon">
          <LockIcon />
        </div>
        <h3>Gold Members Only</h3>
        <p>The Community section is exclusively for Gold members.</p>
        <p>
          Upgrade your membership to Gold to create and join
          communities, make posts, and connect with other readers.
        </p>
      </div>
    );
  }

  return (
    <>
      {communityView === "list" ? (
        <>
          <div className="section-header">
            <h3>Communities</h3>
            <button
              className="btn btn-sm"
              onClick={() => {
                setCommunityForm(EMPTY_COMMUNITY_FORM);
                setCommunityFormError("");
                setShowCreateCommunity(true);
              }}
            >
              + Create Community
            </button>
          </div>

          <div className="search-trigger-row">
            <SearchBar
              value={communitySearch}
              onChange={setCommunitySearch}
              placeholder="Search communities…"
              className="search-bar-wide"
            />
          </div>

          {/* Pending / rejected requests */}
          {myCommunities.filter((c) => c.status !== "approved").length >
            0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="community-section-label">
                Your pending requests
              </div>
              <div className="communities-grid">
                {myCommunities
                  .filter((c) => c.status !== "approved")
                  .map((c) => (
                    <div key={c.id} className="community-card">
                      <div
                        className="community-card-banner"
                        style={
                          c.banner_url
                            ? {
                                backgroundImage: `url(${c.banner_url})`,
                              }
                            : undefined
                        }
                      >
                        <div className="community-card-icon-wrap">
                          {c.icon_url ? (
                            <img
                              src={c.icon_url}
                              alt=""
                              className="community-card-icon"
                            />
                          ) : (
                            <div className="community-card-icon-placeholder">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="community-card-body">
                        <div className="community-card-header">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="community-card-name">
                              {c.name}
                            </div>
                            {c.description && (
                              <div className="community-card-desc">
                                {c.description}
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={
                              c.status === "rejected"
                                ? "overdue"
                                : "returned"
                            }
                          >
                            {c.status === "rejected"
                              ? "Rejected"
                              : "Pending approval"}
                          </Badge>
                        </div>
                        {c.admin_notes && (
                          <div className="community-admin-note">
                            Admin note: {c.admin_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!communitiesLoaded ? (
            <div className="empty">Loading communities…</div>
          ) : communities.length === 0 ? (
            <div className="empty">
              No communities yet — be the first to create one!
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="empty">
              No communities match "{communitySearch}"
            </div>
          ) : (
            <div className="communities-grid">
              {filteredCommunities.map((c) => (
                <div
                  key={c.id}
                  className={`community-card${
                    c.is_member ? " community-card-clickable" : ""
                  }`}
                  onClick={c.is_member ? () => openCommunity(c) : undefined}
                >
                  <div
                    className="community-card-banner"
                    style={
                      c.banner_url
                        ? { backgroundImage: `url(${c.banner_url})` }
                        : undefined
                    }
                  >
                    <div className="community-card-icon-wrap">
                      {c.icon_url ? (
                        <img
                          src={c.icon_url}
                          alt=""
                          className="community-card-icon"
                        />
                      ) : (
                        <div className="community-card-icon-placeholder">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="community-card-body">
                    <div className="community-card-header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="community-card-name">
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="community-card-desc">
                            {c.description}
                          </div>
                        )}
                      </div>
                      {c.user_role === "moderator" && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCommunity(c);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="community-card-meta">
                      {c.member_count} member
                      {c.member_count !== 1 ? "s" : ""} · {c.post_count}{" "}
                      post{c.post_count !== 1 ? "s" : ""}
                      {c.user_role === "moderator" && (
                        <span className="community-mod-tag">
                          Moderator
                        </span>
                      )}
                    </div>
                    <div className="btn-row">
                      {c.is_member ? (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveCommunity(c.id);
                          }}
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            joinCommunity(c);
                          }}
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : communityView === "community" ? (
        <>
          <button
            className="back-nav-link community-page-back"
            onClick={() => {
              setCommunityView("list");
              loadCommunities();
            }}
          >
            <ChevronLeft /> Back to communities
          </button>

          <div className="community-page-header">
            <div
              className="community-page-banner"
              style={
                selectedCommunity?.banner_url
                  ? {
                      backgroundImage: `url(${selectedCommunity.banner_url})`,
                    }
                  : undefined
              }
            >
              <div className="community-page-icon-wrap">
                {selectedCommunity?.icon_url ? (
                  <img
                    src={selectedCommunity.icon_url}
                    alt=""
                    className="community-page-icon"
                  />
                ) : (
                  <div className="community-page-icon-placeholder">
                    {selectedCommunity?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="community-page-info">
              <div className="community-page-title-row">
                <div>
                  <div className="community-page-title">
                    {selectedCommunity?.name}
                  </div>
                  {selectedCommunity?.description && (
                    <div className="community-page-desc">
                      {selectedCommunity.description}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setPostForm({ title: "", content: "" });
                    setPostFormError("");
                    setShowCreatePost(true);
                  }}
                >
                  + New Post
                </button>
              </div>
              <div className="community-page-meta">
                {selectedCommunity?.member_count} member
                {selectedCommunity?.member_count !== 1 ? "s" : ""}
                {selectedCommunity?.user_role === "moderator" && (
                  <span
                    className="community-mod-tag"
                    style={{ marginLeft: 8 }}
                  >
                    Moderator
                  </span>
                )}
              </div>
            </div>
          </div>

          {postsLoading ? (
            <div className="empty">Loading posts…</div>
          ) : communityPosts.length === 0 ? (
            <div className="empty">
              No posts yet — start the conversation!
            </div>
          ) : (
            communityPosts.map((post) => {
              const isExpanded = expandedPostId === post.id;
              return (
                <div key={post.id} className="post-card">
                  <div className="post-card-title">{post.title}</div>
                  <div className="post-card-meta">
                    <span>{post.author_username}</span>
                    <span className="muted">·</span>
                    <span className="muted">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="post-card-content">
                    {post.content}
                  </div>

                  <div className="reaction-bar">
                    {REACTIONS.map(({ key, label }) => {
                      const count = post.reactions.counts[key] || 0;
                      const active =
                        post.reactions.user_reaction === key;
                      return (
                        <button
                          key={key}
                          className={`reaction-btn${
                            active ? " reaction-active" : ""
                          }`}
                          onClick={() => reactPost(post, key)}
                          title={label}
                        >
                          <ReactionIcon type={key} size={15} />
                          {count > 0 && (
                            <span className="reaction-count">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      className="post-comments-toggle"
                      onClick={() => togglePostComments(post)}
                    >
                      {post.comment_count} comment
                      {post.comment_count !== 1 ? "s" : ""}
                      {isExpanded ? " ▲" : " ▼"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="comments-section">
                      {postLoading ||
                      !selectedPost ||
                      selectedPost.id !== post.id ? (
                        <div className="empty">
                          Loading comments…
                        </div>
                      ) : (
                        <>
                          <form
                            className="comment-form"
                            onSubmit={submitComment}
                          >
                            {commentError && (
                              <div
                                className="error"
                                style={{ marginBottom: 8 }}
                              >
                                {commentError}
                              </div>
                            )}
                            <textarea
                              className="comment-input"
                              value={commentContent}
                              onChange={(e) =>
                                setCommentContent(e.target.value)
                              }
                              placeholder="Write a comment…"
                              rows={2}
                            />
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginTop: 6,
                              }}
                            >
                              <button
                                type="submit"
                                className="btn btn-sm"
                                disabled={!commentContent.trim()}
                              >
                                Comment
                              </button>
                            </div>
                          </form>

                          {selectedPost.comments?.map((comment) => (
                            <CommentItem
                              key={comment.id}
                              comment={comment}
                              currentUserId={user.id}
                              onReact={reactComment}
                              onReply={setReplyingToId}
                              replyingToId={replyingToId}
                              replyContent={replyContent}
                              setReplyContent={setReplyContent}
                              onSubmitReply={submitReply}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      ) : null}

      {showCreateCommunity && (
        <CreateCommunityModal
          communityForm={communityForm}
          setCommunityForm={setCommunityForm}
          communityFormError={communityFormError}
          communityIconInputRef={communityIconInputRef}
          communityBannerInputRef={communityBannerInputRef}
          onClose={() => setShowCreateCommunity(false)}
          onSubmit={submitCommunityForm}
          onIconChange={handleCommunityIconChange}
          onBannerChange={handleCommunityBannerChange}
        />
      )}

      {showCreatePost && (
        <CreatePostModal
          postForm={postForm}
          setPostForm={setPostForm}
          postFormError={postFormError}
          onClose={() => setShowCreatePost(false)}
          onSubmit={submitCreatePost}
        />
      )}
    </>
  );
}

export default CommunityTab;
