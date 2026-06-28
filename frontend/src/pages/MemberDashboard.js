import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/TopBar";
import NavTabs from "../components/NavTabs";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import { GENRES } from "../constants";

const TABS = [
  { id: "books", label: "Available Books" },
  { id: "profile", label: "My Profile" },
  { id: "community", label: "Community" },
];

const REACTIONS = [
  { key: 'like',  label: 'Like'  },
  { key: 'love',  label: 'Love'  },
  { key: 'haha',  label: 'Haha'  },
  { key: 'wow',   label: 'Wow'   },
  { key: 'sad',   label: 'Sad'   },
  { key: 'angry', label: 'Angry' },
];

const sl = 'round'; // strokeLinecap / strokeLinejoin shorthand value
function ReactionIcon({ type, size = 13 }) {
  const common = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: sl, strokeLinejoin: sl };
  if (type === 'like') return (
    <svg {...common}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>
  );
  if (type === 'love') return (
    <svg {...common}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
  if (type === 'haha') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 13s1.5 3 4 3 4-3 4-3"/>
      <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5"/>
      <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5"/>
    </svg>
  );
  if (type === 'wow') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none"/>
      <ellipse cx="12" cy="16" rx="2" ry="2.2"/>
    </svg>
  );
  if (type === 'sad') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M16 17s-1.5-2-4-2-4 2-4 2"/>
      <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5"/>
      <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5"/>
    </svg>
  );
  if (type === 'angry') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M16 17s-1.5-2-4-2-4 2-4 2"/>
      <path d="M7.5 7.5l3 2"/>
      <path d="M16.5 7.5l-3 2"/>
    </svg>
  );
  return null;
}

function patchReaction(comments, targetId, reactions) {
  return comments.map(c => {
    if (c.id === targetId) return { ...c, reactions };
    if (c.replies?.length) return { ...c, replies: patchReaction(c.replies, targetId, reactions) };
    return c;
  });
}

function CommentItem({ comment, onReact, onReply, replyingToId, replyContent, setReplyContent, onSubmitReply, depth = 0 }) {
  const isReplying = replyingToId === comment.id;
  const indentCapped = depth >= 4;
  return (
    <div className={`comment-item${depth > 0 ? ' comment-reply' : ''}`}>
      <div className="comment-header">
        <span className="comment-author">{comment.author_username}</span>
        <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
      </div>
      <div className="comment-content">{comment.content}</div>
      <div className="comment-actions">
        {REACTIONS.map(({ key, label }) => {
          const count = comment.reactions.counts[key] || 0;
          const active = comment.reactions.user_reaction === key;
          return (
            <button
              key={key}
              className={`reaction-btn reaction-btn-sm${active ? ' reaction-active' : ''}`}
              onClick={() => onReact(comment.id, key)}
              title={label}
            >
              <ReactionIcon type={key} size={12} />
              {count > 0 && <span className="reaction-count">{count}</span>}
            </button>
          );
        })}
        <button className="btn-link" onClick={() => onReply(isReplying ? null : comment.id)}>
          {isReplying ? 'Cancel' : 'Reply'}
        </button>
      </div>
      {isReplying && (
        <div className="reply-form">
          <textarea
            className="comment-input"
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            placeholder={`Reply to ${comment.author_username}…`}
            rows={2}
            autoFocus
          />
          <button
            className="btn btn-sm"
            onClick={() => onSubmitReply(comment.id)}
            disabled={!replyContent.trim()}
          >Reply</button>
        </div>
      )}
      {comment.replies?.length > 0 && (
        <div className={`replies-list${indentCapped ? ' replies-list-flat' : ''}`}>
          {comment.replies.map(reply => (
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

function StarPicker({ value, hover, onRate, onHover, onLeave }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star ${star <= (hover || value) ? "star-filled" : ""}`}
          onClick={() => onRate(value === star ? 0 : star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          title={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating }) {
  const rounded = Math.round(rating);
  return (
    <span className="star-display">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

const TIER_LABELS = { silver: 'Silver', gold: 'Gold', family: 'Family' };

function MembershipBadge({ tier }) {
  if (!tier) return null;
  return <span className={`membership-badge membership-badge-${tier}`}>{TIER_LABELS[tier]}</span>;
}

function MemberDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [collabRecs, setCollabRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [membershipInfo, setMembershipInfo] = useState(null);

  // Book detail modal
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [bookReviews, setBookReviews] = useState(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);

  // Return + review modal
  const [returnModal, setReturnModal] = useState(null); // { borrowId, bookTitle }
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);

  // Donation
  const EMPTY_DONATION = { title: "", author: "", isbn: "", genre: "", condition: "good", estimated_price: "" };
  const [donations, setDonations] = useState([]);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donationForm, setDonationForm] = useState(EMPTY_DONATION);
  const [donationError, setDonationError] = useState("");
  const [donationSuccess, setDonationSuccess] = useState(false);

  // Community
  const [communityView, setCommunityView] = useState('list'); // 'list' | 'community' | 'post'
  const [communities, setCommunities] = useState([]);
  const [myCommunities, setMyCommunities] = useState([]);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityForm, setCommunityForm] = useState({ name: '', description: '' });
  const [communityFormError, setCommunityFormError] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', content: '' });
  const [postFormError, setPostFormError] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [commentError, setCommentError] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [communityBadge, setCommunityBadge] = useState(0);

  const tier = membershipInfo?.membership?.tier || null;
  const isGold = tier === 'gold';

  const selectedBook = books.find((b) => b.id === selectedBookId) || null;

  const load = useCallback(() => {
    setError("");
    Promise.all([
      api.get("/books").then((r) => setBooks(r.data)),
      api.get("/my-borrows").then((r) => setBorrows(r.data)),
      api.get("/my-fines").then((r) => setFines(r.data)),
      api.get("/my-reservations").then((r) => setReservations(r.data)),
      api.get("/my-donations").then((r) => setDonations(r.data)).catch(() => {}),
      api.get("/membership").then((r) => setMembershipInfo(r.data)).catch(() => {}),
      api
        .get("/recommendations")
        .then((r) => setRecommendations(r.data))
        .catch(() => {}),
      api
        .get("/collaborative-recommendations")
        .then((r) => setCollabRecs(r.data))
        .catch(() => {}),
      api
        .get("/trending")
        .then((r) => setTrending(r.data))
        .catch(() => {}),
    ]).catch(() => setError("Failed to load data. Is the server running?"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch reviews whenever a book detail is opened
  useEffect(() => {
    if (!selectedBookId) {
      setBookReviews(null);
      return;
    }
    setBookReviews(null);
    api
      .get(`/books/${selectedBookId}/reviews`)
      .then((r) => setBookReviews(r.data))
      .catch(() =>
        setBookReviews({ avg_rating: null, rating_count: 0, reviews: [] })
      );
  }, [selectedBookId]);

  // Lazy-fetch enrichment for books that have never been scraped (description === null)
  useEffect(() => {
    if (!selectedBookId) return;
    const book = books.find((b) => b.id === selectedBookId);
    if (!book || book.description !== null) return; // already have data or already tried
    setEnrichmentLoading(true);
    api
      .get(`/books/${selectedBookId}/enrichment`)
      .then((r) => {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === selectedBookId
              ? {
                  ...b,
                  description: r.data.description,
                  author_bio: r.data.author_bio,
                  cover_url: r.data.cover_url || b.cover_url,
                }
              : b
          )
        );
      })
      .catch(() => {
        // Mark as attempted so we don't retry this session
        setBooks((prev) =>
          prev.map((b) =>
            b.id === selectedBookId ? { ...b, description: "" } : b
          )
        );
      })
      .finally(() => setEnrichmentLoading(false));
  }, [selectedBookId]); // eslint-disable-line

  // Poll for community activity badge when not on the community tab
  useEffect(() => {
    if (!isGold) return;
    if (tab === 'community') return;

    const doPoll = async () => {
      const lastSeen = localStorage.getItem('communityLastSeen') || new Date(0).toISOString();
      try {
        const r = await api.get(`/communities/activity-count?since=${encodeURIComponent(lastSeen)}`);
        setCommunityBadge(r.data.count || 0);
      } catch {}
    };

    doPoll();
    const id = setInterval(doPoll, 60000);
    return () => clearInterval(id);
  }, [isGold, tab]); // eslint-disable-line

  const openBook = (bookId) => {
    setSelectedBookId(bookId);
    setActionError("");
  };

  const closeBook = () => {
    setSelectedBookId(null);
    setActionError("");
    setEnrichmentLoading(false);
  };

  const borrow = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/borrow/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to borrow book");
    }
  };

  const openReturnModal = (borrowId, bookTitle) => {
    setReturnModal({ borrowId, bookTitle });
    setReviewRating(0);
    setReviewHover(0);
    setReviewText("");
    setReviewAnonymous(false);
  };

  const closeReturnModal = () => setReturnModal(null);

  const handleReturn = async () => {
    const payload =
      reviewRating > 0
        ? {
            rating: reviewRating,
            review_text: reviewText.trim(),
            is_anonymous: reviewAnonymous,
          }
        : {};
    try {
      await api.post(
        `/return/${returnModal.borrowId}`,
        Object.keys(payload).length ? payload : undefined
      );
      setReturnModal(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to return book");
      setReturnModal(null);
    }
  };

  const reserve = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/reserve/${bookId}`);
      load();
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to reserve book");
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      await api.delete(`/cancel-reservation/${reservationId}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to cancel reservation");
    }
  };

  // ── Community ────────────────────────────────────────────────────────────────
  const loadCommunities = useCallback(async () => {
    try {
      const [listRes, mineRes] = await Promise.all([
        api.get('/communities'),
        api.get('/my-communities'),
      ]);
      setCommunities(listRes.data);
      setMyCommunities(mineRes.data);
      setCommunitiesLoaded(true);
    } catch {
      setCommunitiesLoaded(true);
    }
  }, []);

  const openCommunity = async (community) => {
    setSelectedCommunity(community);
    setCommunityView('community');
    setCommunityPosts([]);
    setPostsLoading(true);
    try {
      const r = await api.get(`/communities/${community.id}/posts`);
      setCommunityPosts(r.data);
    } finally {
      setPostsLoading(false);
    }
  };

  const openPost = async (post) => {
    setCommunityView('post');
    setSelectedPost(null);
    setPostLoading(true);
    setCommentContent('');
    setCommentError('');
    setReplyingToId(null);
    setReplyContent('');
    try {
      const r = await api.get(`/communities/${selectedCommunity.id}/posts/${post.id}`);
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
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to join community');
    }
  };

  const leaveCommunity = async (cid) => {
    try {
      await api.delete(`/communities/${cid}/leave`);
      setCommunityView('list');
      loadCommunities();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to leave community');
    }
  };

  const submitCreateCommunity = async (e) => {
    e.preventDefault();
    setCommunityFormError('');
    try {
      await api.post('/communities', communityForm);
      setShowCreateCommunity(false);
      setCommunityForm({ name: '', description: '' });
      loadCommunities();
    } catch (err) {
      setCommunityFormError(err.response?.data?.error || 'Failed to create community');
    }
  };

  const submitCreatePost = async (e) => {
    e.preventDefault();
    setPostFormError('');
    try {
      await api.post(`/communities/${selectedCommunity.id}/posts`, postForm);
      setShowCreatePost(false);
      setPostForm({ title: '', content: '' });
      const r = await api.get(`/communities/${selectedCommunity.id}/posts`);
      setCommunityPosts(r.data);
    } catch (err) {
      setPostFormError(err.response?.data?.error || 'Failed to create post');
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    setCommentError('');
    try {
      await api.post(`/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments`, {
        content: commentContent,
      });
      setCommentContent('');
      const r = await api.get(`/communities/${selectedCommunity.id}/posts/${selectedPost.id}`);
      setSelectedPost(r.data);
    } catch (err) {
      setCommentError(err.response?.data?.error || 'Failed to post comment');
    }
  };

  const submitReply = async (parentId) => {
    if (!replyContent.trim()) return;
    try {
      await api.post(`/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments`, {
        content: replyContent,
        parent_id: parentId,
      });
      setReplyContent('');
      setReplyingToId(null);
      const r = await api.get(`/communities/${selectedCommunity.id}/posts/${selectedPost.id}`);
      setSelectedPost(r.data);
    } catch (err) {
      setCommentError(err.response?.data?.error || 'Failed to post reply');
    }
  };

  const reactPost = async (emoji) => {
    try {
      const r = await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/react`,
        { emoji }
      );
      setSelectedPost(prev => ({ ...prev, reactions: r.data }));
    } catch {}
  };

  const reactComment = async (commentId, emoji) => {
    try {
      const r = await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/comments/${commentId}/react`,
        { emoji }
      );
      setSelectedPost(prev => ({
        ...prev,
        comments: patchReaction(prev.comments, commentId, r.data),
      }));
    } catch {}
  };

  const openDonateModal = () => {
    setDonationForm(EMPTY_DONATION);
    setDonationError("");
    setDonationSuccess(false);
    setShowDonateModal(true);
  };

  const submitDonation = async (e) => {
    e.preventDefault();
    setDonationError("");
    try {
      await api.post("/donations", {
        ...donationForm,
        estimated_price: Number(donationForm.estimated_price),
      });
      setDonationSuccess(true);
      setDonationForm(EMPTY_DONATION);
      load();
    } catch (err) {
      setDonationError(err.response?.data?.error || "Failed to submit donation");
    }
  };

  const activeBorrows = borrows.filter((b) => !b.return_date);
  const borrowedBookIds = new Set(activeBorrows.map((b) => b.book_id));
  const reservedBooks = Object.fromEntries(
    reservations.map((r) => [r.book_id, r])
  );

  const genreCounts = useMemo(() => {
    const counts = {};
    books.forEach((b) => {
      const g = b.genre || "Other";
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [books]);

  const availableGenres = useMemo(
    () => Object.keys(genreCounts).sort(),
    [genreCounts]
  );

  const booksByGenre = useMemo(() => {
    const grouped = {};
    books.forEach((b) => {
      const g = b.genre || "Other";
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(b);
    });
    return grouped;
  }, [books]);

  const filteredBooks = useMemo(
    () =>
      books.filter((b) => {
        const q = search.toLowerCase();
        const matchSearch =
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.genre || "").toLowerCase().includes(q);
        const matchGenre =
          !selectedGenre || (b.genre || "Other") === selectedGenre;
        const matchAvail =
          availFilter === "all" ||
          (availFilter === "available" && b.available_copies > 0) ||
          (availFilter === "unavailable" && b.available_copies === 0);
        const matchRating =
          ratingFilter === 0 || (b.avg_rating || 0) >= ratingFilter;
        return matchSearch && matchGenre && matchAvail && matchRating;
      }),
    [books, search, selectedGenre, availFilter, ratingFilter]
  );

  const trendingIds = useMemo(
    () => new Set(trending.map((b) => b.id)),
    [trending]
  );

  const hasActiveFilters =
    search || selectedGenre || availFilter !== "all" || ratingFilter > 0;

  const clearFilters = () => {
    setSearch("");
    setSelectedGenre("");
    setAvailFilter("all");
    setRatingFilter(0);
  };

  function BookActionButton({ book }) {
    const res = reservedBooks[book.id];
    const isBorrowed = borrowedBookIds.has(book.id);

    if (isBorrowed) {
      return (
        <button className="btn btn-sm" disabled>
          Borrowed
        </button>
      );
    }
    if (book.available_copies > 0) {
      return (
        <button className="btn btn-sm" onClick={() => borrow(book.id)}>
          Borrow
        </button>
      );
    }
    if (res) {
      if (res.status === "ready") {
        return (
          <button className="btn btn-sm" onClick={() => borrow(book.id)}>
            Borrow (Ready)
          </button>
        );
      }
      return (
        <button className="btn btn-sm" disabled>
          Reserved #{res.queue_position}
        </button>
      );
    }
    return (
      <button
        className="btn btn-sm btn-outline"
        onClick={() => reserve(book.id)}
      >
        Reserve
      </button>
    );
  }

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'community') {
      localStorage.setItem('communityLastSeen', new Date().toISOString());
      setCommunityBadge(0);
      if (!communitiesLoaded && isGold) loadCommunities();
    }
  };

  return (
    <div className="layout">
      <TopBar
        title="Library"
        username={user.username}
        onLogout={logout}
        badge={<MembershipBadge tier={tier} />}
      />
      <NavTabs tabs={TABS} active={tab} onChange={handleTabChange} badges={{ community: communityBadge }} />
      <div className="content">
        {error && <div className="error">{error}</div>}

        {tab === "books" && (
          <>
            {/* Filters + count */}
            <div className="catalog-controls">
              <div className="filter-bar">
                <select
                  className="filter-select"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                >
                  <option value="">All genres</option>
                  {availableGenres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  value={availFilter}
                  onChange={(e) => setAvailFilter(e.target.value)}
                >
                  <option value="all">All copies</option>
                  <option value="available">Available now</option>
                  <option value="unavailable">Unavailable</option>
                </select>
                <select
                  className="filter-select"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(Number(e.target.value))}
                >
                  <option value={0}>Any rating</option>
                  <option value={4}>4+ stars</option>
                  <option value={3}>3+ stars</option>
                  <option value={2}>2+ stars</option>
                </select>
                {hasActiveFilters && (
                  <button className="btn btn-sm btn-outline" onClick={clearFilters}>Clear</button>
                )}
              </div>
              {books.length > 0 && (
                <span className="book-count-label">
                  {filteredBooks.length === books.length
                    ? `${books.length} books`
                    : `${filteredBooks.length} of ${books.length} books`}
                </span>
              )}
            </div>

            {/* Search */}
            <div className="search-top-bar">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by title, author, genre…"
                className="search-bar-wide"
              />
            </div>

            {/* Results — only shown when actively searching/filtering */}
            {hasActiveFilters && filteredBooks.length === 0 && (
              <div className="empty">No books match your filters</div>
            )}
            {hasActiveFilters && filteredBooks.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Genre</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((b) => (
                    <tr
                      key={b.id}
                      className="clickable-row"
                      onClick={() => openBook(b.id)}
                    >
                      <td>
                        <span className="title-cell">
                          {b.title}
                          {trendingIds.has(b.id) && (
                            <span className="trending-tag">Trending</span>
                          )}
                        </span>
                      </td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
                      <td>
                        {b.rating_count > 0 ? (
                          <span className="book-rating-cell">
                            <span className="star-display">
                              {"★".repeat(Math.round(b.avg_rating))}
                              {"☆".repeat(5 - Math.round(b.avg_rating))}
                            </span>
                            <span className="rating-count-small">
                              {b.avg_rating} ({b.rating_count})
                            </span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Discovery — rendered below the catalog */}
            {(() => {
              const contentIds = new Set(recommendations.map((r) => r.id));
              const dedupedCollab = collabRecs.filter(
                (r) => !contentIds.has(r.id)
              );
              const hasDiscovery =
                trending.length > 0 ||
                recommendations.length > 0 ||
                dedupedCollab.length > 0;
              if (!hasDiscovery) return null;
              return (
                <div className="discovery-section">
                  {trending.length > 0 && (
                    <div className="rec-section">
                      <div className="rec-heading trending-heading">
                        Trending This Week
                      </div>
                      <div className="rec-strip">
                        {trending.map((book) => {
                          const stars = book.avg_rating
                            ? Math.round(book.avg_rating)
                            : 0;
                          const n = book.borrow_count_week;
                          return (
                            <button
                              key={book.id}
                              className="rec-card rec-card-trending"
                              onClick={() => openBook(book.id)}
                            >
                              {book.cover_url && (
                                <img
                                  src={book.cover_url}
                                  alt=""
                                  className="rec-card-cover"
                                />
                              )}
                              <div className="rec-card-reason">
                                {n} borrow{n !== 1 ? "s" : ""} this week
                              </div>
                              <div className="rec-card-title">{book.title}</div>
                              <div className="rec-card-author">
                                {book.author}
                              </div>
                              <div className="rec-card-meta">
                                {book.genre && (
                                  <span className="rec-card-genre">
                                    {book.genre}
                                  </span>
                                )}
                                {book.avg_rating && (
                                  <span className="rec-card-rating">
                                    <span className="rec-stars">
                                      {"★".repeat(stars)}
                                      {"☆".repeat(5 - stars)}
                                    </span>
                                    <span className="rec-rating-val">
                                      {book.avg_rating}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div className="rec-card-avail">
                                {book.available_copies > 0 ? (
                                  `${book.available_copies} available`
                                ) : (
                                  <span className="muted">Unavailable</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div className="rec-section">
                      <div className="rec-heading">Recommended for you</div>
                      <div className="rec-strip">
                        {recommendations.map((book) => {
                          const stars = book.avg_rating
                            ? Math.round(book.avg_rating)
                            : 0;
                          return (
                            <button
                              key={book.id}
                              className="rec-card"
                              onClick={() => openBook(book.id)}
                            >
                              {book.cover_url && (
                                <img
                                  src={book.cover_url}
                                  alt=""
                                  className="rec-card-cover"
                                />
                              )}
                              <div className="rec-card-reason">
                                {book.reason}
                              </div>
                              <div className="rec-card-title">{book.title}</div>
                              <div className="rec-card-author">
                                {book.author}
                              </div>
                              <div className="rec-card-meta">
                                {book.genre && (
                                  <span className="rec-card-genre">
                                    {book.genre}
                                  </span>
                                )}
                                {book.avg_rating && (
                                  <span className="rec-card-rating">
                                    <span className="rec-stars">
                                      {"★".repeat(stars)}
                                      {"☆".repeat(5 - stars)}
                                    </span>
                                    <span className="rec-rating-val">
                                      {book.avg_rating}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div className="rec-card-avail">
                                {book.available_copies > 0 ? (
                                  `${book.available_copies} available`
                                ) : (
                                  <span className="muted">Unavailable</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dedupedCollab.length > 0 && (
                    <div className="rec-section">
                      <div className="rec-heading">
                        Readers like you also enjoyed
                      </div>
                      <div className="rec-strip">
                        {dedupedCollab.map((book) => {
                          const stars = book.avg_rating
                            ? Math.round(book.avg_rating)
                            : 0;
                          return (
                            <button
                              key={book.id}
                              className="rec-card rec-card-collab"
                              onClick={() => openBook(book.id)}
                            >
                              {book.cover_url && (
                                <img
                                  src={book.cover_url}
                                  alt=""
                                  className="rec-card-cover"
                                />
                              )}
                              <div className="rec-card-reason">
                                {book.reason}
                              </div>
                              <div className="rec-card-title">{book.title}</div>
                              <div className="rec-card-author">
                                {book.author}
                              </div>
                              <div className="rec-card-meta">
                                {book.genre && (
                                  <span className="rec-card-genre">
                                    {book.genre}
                                  </span>
                                )}
                                {book.avg_rating && (
                                  <span className="rec-card-rating">
                                    <span className="rec-stars">
                                      {"★".repeat(stars)}
                                      {"☆".repeat(5 - stars)}
                                    </span>
                                    <span className="rec-rating-val">
                                      {book.avg_rating}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div className="rec-card-avail">
                                {book.available_copies > 0 ? (
                                  `${book.available_copies} available`
                                ) : (
                                  <span className="muted">Unavailable</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* All books grouped by genre */}
            {availableGenres.length > 0 && (
              <div className="all-books-section">
                {availableGenres.map((genre) => (
                  <div key={genre} className="genre-section">
                    <div className="genre-section-heading">{genre}</div>
                    <div className="rec-strip">
                      {booksByGenre[genre].map((book) => {
                        const stars = book.avg_rating ? Math.round(book.avg_rating) : 0;
                        return (
                          <button key={book.id} className="rec-card" onClick={() => openBook(book.id)}>
                            {book.cover_url && <img src={book.cover_url} alt="" className="rec-card-cover" />}
                            <div className="rec-card-title">
                              {book.title}
                              {trendingIds.has(book.id) && <span className="trending-tag" style={{ marginLeft: 6 }}>Trending</span>}
                            </div>
                            <div className="rec-card-author">{book.author}</div>
                            {book.rating_count > 0 && (
                              <div className="rec-card-meta">
                                <span className="rec-card-rating">
                                  <span className="rec-stars">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
                                  <span className="rec-rating-val">{book.avg_rating}</span>
                                </span>
                              </div>
                            )}
                            <div className="rec-card-avail">
                              {book.available_copies > 0 ? `${book.available_copies} available` : <span className="muted">Unavailable</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "profile" && (
          <>
            {membershipInfo && (
              <div className="membership-card">
                <div className="membership-card-tier">
                  <MembershipBadge tier={membershipInfo.membership?.tier} />
                  {!membershipInfo.membership && <span className="muted" style={{ fontSize: '0.85rem' }}>No membership</span>}
                </div>
                <div className="membership-card-stats">
                  {membershipInfo.membership && (
                    <>
                      <div className="membership-stat">
                        <span className="membership-stat-label">Borrow limit</span>
                        <span className="membership-stat-value">
                          {membershipInfo.membership.borrow_limit} book{membershipInfo.membership.borrow_limit > 1 ? 's' : ''} at a time
                        </span>
                      </div>
                      <div className="membership-stat">
                        <span className="membership-stat-label">Monthly rate</span>
                        <span className="membership-stat-value">
                          ${membershipInfo.membership.tier === 'silver'
                            ? membershipInfo.pricing.silver_rate.toFixed(2)
                            : membershipInfo.membership.tier === 'gold'
                              ? membershipInfo.pricing.gold_rate.toFixed(2)
                              : membershipInfo.pricing.family_rate.toFixed(2)}
                        </span>
                      </div>
                      {membershipInfo.membership.tier === 'family' && membershipInfo.family_members.length > 0 && (
                        <div className="membership-stat">
                          <span className="membership-stat-label">Family group</span>
                          <span className="membership-stat-value" style={{ fontSize: '0.85rem' }}>
                            {membershipInfo.family_members.join(', ')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="section-header">
              <h3>My Borrowed Books</h3>
            </div>
            {activeBorrows.length === 0 ? (
              <div className="empty">No active borrows</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeBorrows.map((b) => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={b.is_overdue ? "overdue" : "active"}>
                          {b.is_overdue ? "Overdue" : "Active"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => openReturnModal(b.id, b.book_title)}
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="section-header" style={{ marginTop: 32 }}>
              <h3>My Reservations</h3>
            </div>
            {reservations.length === 0 ? (
              <div className="empty">No reservations</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.book_title}</td>
                      <td>{r.book_author}</td>
                      <td>
                        {r.status === "ready" ? (
                          <Badge variant="active">Ready — go borrow!</Badge>
                        ) : (
                          <Badge variant="overdue">
                            Queue #{r.queue_position}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => cancelReservation(r.id)}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="section-header" style={{ marginTop: 32 }}>
              <h3>My Fines</h3>
            </div>
            {fines.length === 0 ? (
              <div className="empty">No fines</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Due Date</th>
                    <th>Fine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((b) => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td className="fine-amount">${b.fine.toFixed(2)}</td>
                      <td>
                        <Badge variant={b.fine_paid ? "returned" : "overdue"}>
                          {b.fine_paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Donate a Book */}
            <div className="section-header" style={{ marginTop: 32 }}>
              <h3>Donate a Book</h3>
              <button className="btn btn-sm" onClick={openDonateModal}>Donate</button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
              Donate a book you own to the library. Once approved by an admin, the book is added to the catalogue and you earn <strong>1/4 of its estimated value</strong> as library credit.
            </p>
            {donations.length === 0 ? (
              <div className="empty">No donations yet</div>
            ) : (
              <>
                {(() => {
                  const totalCredit = donations
                    .filter((d) => d.status === "approved")
                    .reduce((sum, d) => sum + (d.credit_amount || 0), 0);
                  return totalCredit > 0 ? (
                    <div className="membership-card" style={{ marginBottom: 16 }}>
                      <div className="membership-card-stats">
                        <div className="membership-stat">
                          <span className="membership-stat-label">Total credits earned</span>
                          <span className="membership-stat-value">${totalCredit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Estimated Value</th>
                      <th>Credit Earned</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id}>
                        <td>{d.title}</td>
                        <td>{d.author}</td>
                        <td>${d.estimated_price.toFixed(2)}</td>
                        <td>
                          {d.status === "approved"
                            ? <span style={{ color: "#2e7d32", fontWeight: 600 }}>${(d.credit_amount || 0).toFixed(2)}</span>
                            : <span className="muted">—</span>}
                        </td>
                        <td>
                          <Badge
                            variant={
                              d.status === "approved"
                                ? "active"
                                : d.status === "rejected"
                                ? "overdue"
                                : "returned"
                            }
                          >
                            {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                          </Badge>
                        </td>
                        <td>{new Date(d.submitted_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {/* ── Community Tab ── */}
        {tab === 'community' && (
          <>
            {!isGold ? (
              <div className="community-locked">
                <div className="community-locked-icon">🔒</div>
                <h3>Gold Members Only</h3>
                <p>The Community section is exclusively for Gold members.</p>
                <p>Upgrade your membership to Gold to create and join communities, make posts, and connect with other readers.</p>
              </div>
            ) : communityView === 'list' ? (
              <>
                <div className="section-header">
                  <h3>Communities</h3>
                  <button className="btn btn-sm" onClick={() => { setCommunityForm({ name: '', description: '' }); setCommunityFormError(''); setShowCreateCommunity(true); }}>
                    + Create Community
                  </button>
                </div>

                {/* Pending / rejected requests */}
                {myCommunities.filter(c => c.status !== 'approved').length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div className="community-section-label">Your pending requests</div>
                    {myCommunities.filter(c => c.status !== 'approved').map(c => (
                      <div key={c.id} className="community-card">
                        <div className="community-card-header">
                          <div>
                            <div className="community-card-name">{c.name}</div>
                            {c.description && <div className="community-card-desc">{c.description}</div>}
                          </div>
                          <Badge variant={c.status === 'rejected' ? 'overdue' : 'returned'}>
                            {c.status === 'rejected' ? 'Rejected' : 'Pending approval'}
                          </Badge>
                        </div>
                        {c.admin_notes && (
                          <div className="community-admin-note">Admin note: {c.admin_notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!communitiesLoaded ? (
                  <div className="empty">Loading communities…</div>
                ) : communities.length === 0 ? (
                  <div className="empty">No communities yet — be the first to create one!</div>
                ) : (
                  communities.map(c => (
                    <div key={c.id} className="community-card">
                      <div className="community-card-header">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="community-card-name">{c.name}</div>
                          {c.description && <div className="community-card-desc">{c.description}</div>}
                          <div className="community-card-meta">
                            {c.member_count} member{c.member_count !== 1 ? 's' : ''} · {c.post_count} post{c.post_count !== 1 ? 's' : ''}
                            {c.user_role === 'moderator' && <span className="community-mod-tag">Moderator</span>}
                          </div>
                        </div>
                        <div className="btn-row" style={{ flexShrink: 0 }}>
                          {c.is_member ? (
                            <>
                              <button className="btn btn-sm" onClick={() => openCommunity(c)}>View</button>
                              <button className="btn btn-sm btn-outline" onClick={() => leaveCommunity(c.id)}>Leave</button>
                            </>
                          ) : (
                            <button className="btn btn-sm" onClick={() => joinCommunity(c)}>Join</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : communityView === 'community' ? (
              <>
                <div className="community-nav">
                  <button className="btn btn-sm btn-outline" onClick={() => { setCommunityView('list'); loadCommunities(); }}>← Back</button>
                  <div>
                    <div className="community-nav-title">{selectedCommunity?.name}</div>
                    <div className="community-nav-meta">
                      {selectedCommunity?.member_count} member{selectedCommunity?.member_count !== 1 ? 's' : ''}
                      {selectedCommunity?.user_role === 'moderator' && <span className="community-mod-tag" style={{ marginLeft: 8 }}>Moderator</span>}
                    </div>
                  </div>
                  <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setPostForm({ title: '', content: '' }); setPostFormError(''); setShowCreatePost(true); }}>
                    + New Post
                  </button>
                </div>

                {postsLoading ? (
                  <div className="empty">Loading posts…</div>
                ) : communityPosts.length === 0 ? (
                  <div className="empty">No posts yet — start the conversation!</div>
                ) : (
                  communityPosts.map(post => (
                    <div key={post.id} className="post-card" onClick={() => openPost(post)}>
                      <div className="post-card-title">{post.title}</div>
                      <div className="post-card-meta">
                        <span>{post.author_username}</span>
                        <span className="muted">·</span>
                        <span className="muted">{new Date(post.created_at).toLocaleDateString()}</span>
                        <span className="muted">·</span>
                        <span className="muted">{post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}</span>
                      </div>
                      {Object.keys(post.reactions.counts).length > 0 && (
                        <div className="post-reactions-preview">
                          {REACTIONS.filter(({ key }) => post.reactions.counts[key] > 0).map(({ key, label }) => (
                            <span key={key} className="reaction-mini" title={label}>
                              <ReactionIcon type={key} size={11} />
                              <span className="reaction-count">{post.reactions.counts[key]}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : communityView === 'post' ? (
              <>
                <div className="community-nav" style={{ marginBottom: 24 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => { setCommunityView('community'); }}>
                    ← {selectedCommunity?.name}
                  </button>
                </div>

                {postLoading || !selectedPost ? (
                  <div className="empty">Loading…</div>
                ) : (
                  <>
                    <div className="post-detail">
                      <h2 className="post-detail-title">{selectedPost.title}</h2>
                      <div className="post-detail-meta">
                        <span>{selectedPost.author_username}</span>
                        <span className="muted">·</span>
                        <span className="muted">{new Date(selectedPost.created_at).toLocaleString()}</span>
                      </div>
                      <div className="post-detail-content">{selectedPost.content}</div>
                      <div className="reaction-bar">
                        {REACTIONS.map(({ key, label }) => {
                          const count = selectedPost.reactions.counts[key] || 0;
                          const active = selectedPost.reactions.user_reaction === key;
                          return (
                            <button
                              key={key}
                              className={`reaction-btn${active ? ' reaction-active' : ''}`}
                              onClick={() => reactPost(key)}
                              title={label}
                            >
                              <ReactionIcon type={key} size={15} />
                              {count > 0 && <span className="reaction-count">{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="comments-section">
                      <div className="comments-header">
                        {selectedPost.comment_count} Comment{selectedPost.comment_count !== 1 ? 's' : ''}
                      </div>

                      <form className="comment-form" onSubmit={submitComment}>
                        {commentError && <div className="error" style={{ marginBottom: 8 }}>{commentError}</div>}
                        <textarea
                          className="comment-input"
                          value={commentContent}
                          onChange={e => setCommentContent(e.target.value)}
                          placeholder="Write a comment…"
                          rows={2}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                          <button type="submit" className="btn btn-sm" disabled={!commentContent.trim()}>Comment</button>
                        </div>
                      </form>

                      {selectedPost.comments?.map(comment => (
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
                    </div>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Book detail modal */}
      {selectedBook && (
        <Modal title={selectedBook.title} onClose={closeBook} wide>
          <div className="book-detail-header">
            {selectedBook.cover_url ? (
              <img
                src={selectedBook.cover_url}
                alt={`Cover of ${selectedBook.title}`}
                className="book-cover-img"
              />
            ) : (
              <div className="book-cover-placeholder">📖</div>
            )}
            <div className="book-detail book-detail-meta">
              <div className="book-detail-row">
                <span className="book-detail-label">Author</span>
                <span>{selectedBook.author}</span>
              </div>
              <div className="book-detail-row">
                <span className="book-detail-label">Genre</span>
                <span>
                  {selectedBook.genre || <span className="muted">—</span>}
                </span>
              </div>
              <div className="book-detail-row">
                <span className="book-detail-label">Available</span>
                <span>
                  {selectedBook.available_copies} / {selectedBook.total_copies}
                  {selectedBook.available_copies === 0 &&
                    selectedBook.reservation_count > 0 && (
                      <span
                        className="muted"
                        style={{ marginLeft: 6, fontSize: "0.8em" }}
                      >
                        ({selectedBook.reservation_count} waiting)
                      </span>
                    )}
                </span>
              </div>
              <div className="book-detail-row">
                <span className="book-detail-label">Rating</span>
                <span>
                  {bookReviews && bookReviews.rating_count > 0 ? (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <StarDisplay rating={bookReviews.avg_rating} />
                      <span style={{ fontSize: "0.85rem", color: "#555" }}>
                        {bookReviews.avg_rating} / 5
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "#aaa" }}>
                        · {bookReviews.rating_count}{" "}
                        {bookReviews.rating_count === 1 ? "rating" : "ratings"}
                      </span>
                    </span>
                  ) : (
                    <span className="muted">No ratings yet</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Description + author bio (lazy-loaded on first view) */}
          {enrichmentLoading ? (
            <div className="enrichment-section">
              <div className="enrichment-loading">Fetching book details…</div>
            </div>
          ) : (
            <>
              {selectedBook.description && (
                <div className="enrichment-section">
                  <div className="enrichment-label">About this book</div>
                  <p className="enrichment-text">{selectedBook.description}</p>
                </div>
              )}
              {selectedBook.author_bio && (
                <div className="enrichment-section">
                  <div className="enrichment-label">About the author</div>
                  <p className="enrichment-text">{selectedBook.author_bio}</p>
                </div>
              )}
            </>
          )}

          {actionError && (
            <div className="error" style={{ marginTop: 16 }}>
              {actionError}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-sm btn-outline" onClick={closeBook}>
              Close
            </button>
            <BookActionButton book={selectedBook} />
          </div>

          {/* Reviews list */}
          {bookReviews && bookReviews.reviews.length > 0 && (
            <div className="reviews-section">
              <div className="reviews-header">Reviews</div>
              {bookReviews.reviews.map((r) => (
                <div key={r.id} className="review-item">
                  <div className="review-meta">
                    <span className="review-author">{r.reviewer}</span>
                    <span className="review-stars">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                    <span className="review-date">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.review_text && (
                    <p className="review-text">{r.review_text}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {bookReviews && bookReviews.reviews.length === 0 && (
            <div className="reviews-section">
              <div className="reviews-header">Reviews</div>
              <div className="empty" style={{ padding: "20px 0" }}>
                No reviews yet. Be the first to review after borrowing!
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Donate a Book modal */}
      {showDonateModal && (
        <Modal title="Donate a Book" onClose={() => setShowDonateModal(false)}>
          {donationSuccess ? (
            <>
              <p style={{ color: "#2e7d32", marginBottom: 20 }}>
                Your donation has been submitted! The admin will review it and add the book to the catalogue. You'll earn <strong>1/4 of the estimated value</strong> as credit once approved.
              </p>
              <div className="modal-actions">
                <button className="btn btn-sm" onClick={() => { setShowDonateModal(false); setDonationSuccess(false); }}>Close</button>
                <button className="btn btn-sm btn-outline" onClick={() => setDonationSuccess(false)}>Donate another</button>
              </div>
            </>
          ) : (
            <form onSubmit={submitDonation}>
              {donationError && <div className="error">{donationError}</div>}
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={donationForm.title}
                  onChange={(e) => setDonationForm({ ...donationForm, title: e.target.value })}
                  placeholder="Book title"
                  required
                />
              </div>
              <div className="form-group">
                <label>Author *</label>
                <input
                  value={donationForm.author}
                  onChange={(e) => setDonationForm({ ...donationForm, author: e.target.value })}
                  placeholder="Author name"
                  required
                />
              </div>
              <div className="form-group">
                <label>ISBN <span className="muted" style={{ textTransform: "none", fontSize: "0.75rem" }}>(optional — helps us find cover &amp; description)</span></label>
                <input
                  value={donationForm.isbn}
                  onChange={(e) => setDonationForm({ ...donationForm, isbn: e.target.value })}
                  placeholder="e.g. 978-0747532743"
                />
              </div>
              <div className="form-group">
                <label>Genre <span className="muted" style={{ textTransform: "none", fontSize: "0.75rem" }}>(optional)</span></label>
                <select
                  value={donationForm.genre}
                  onChange={(e) => setDonationForm({ ...donationForm, genre: e.target.value })}
                >
                  <option value="">— Select genre —</option>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Condition *</label>
                <select
                  value={donationForm.condition}
                  onChange={(e) => setDonationForm({ ...donationForm, condition: e.target.value })}
                  required
                >
                  <option value="new">New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estimated Value ($) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={donationForm.estimated_price}
                  onChange={(e) => setDonationForm({ ...donationForm, estimated_price: e.target.value })}
                  placeholder="e.g. 20.00"
                  required
                />
                {donationForm.estimated_price > 0 && (
                  <p className="field-hint">
                    You will earn <strong>${(Number(donationForm.estimated_price) / 4).toFixed(2)}</strong> in library credit upon approval.
                  </p>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowDonateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-sm">Submit Donation</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <Modal title="Create a Community" onClose={() => setShowCreateCommunity(false)}>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
            Communities require admin approval before members can join. You'll be notified once reviewed.
          </p>
          <form onSubmit={submitCreateCommunity}>
            {communityFormError && <div className="error">{communityFormError}</div>}
            <div className="form-group">
              <label>Name *</label>
              <input
                value={communityForm.name}
                onChange={e => setCommunityForm({ ...communityForm, name: e.target.value })}
                placeholder="e.g. Sci-Fi Readers, Book Club…"
                required
              />
            </div>
            <div className="form-group">
              <label>Description <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
              <textarea
                className="comment-input"
                value={communityForm.description}
                onChange={e => setCommunityForm({ ...communityForm, description: e.target.value })}
                placeholder="What is this community about?"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowCreateCommunity(false)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Submit for Approval</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <Modal title="New Post" onClose={() => setShowCreatePost(false)} wide>
          <form onSubmit={submitCreatePost}>
            {postFormError && <div className="error">{postFormError}</div>}
            <div className="form-group">
              <label>Title *</label>
              <input
                value={postForm.title}
                onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                placeholder="Post title…"
                required
              />
            </div>
            <div className="form-group">
              <label>Content *</label>
              <textarea
                className="comment-input"
                value={postForm.content}
                onChange={e => setPostForm({ ...postForm, content: e.target.value })}
                placeholder="What's on your mind?"
                rows={6}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowCreatePost(false)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Post</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return + optional review modal */}
      {returnModal && (
        <Modal title="Return Book" onClose={closeReturnModal}>
          <p style={{ marginBottom: 20, fontSize: "0.9rem", color: "#555" }}>
            Returning <strong>{returnModal.bookTitle}</strong>
          </p>

          <div style={{ marginBottom: 16 }}>
            <div className="book-detail-label" style={{ marginBottom: 10 }}>
              Rate this book{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </div>
            <StarPicker
              value={reviewRating}
              hover={reviewHover}
              onRate={setReviewRating}
              onHover={setReviewHover}
              onLeave={() => setReviewHover(0)}
            />
            {reviewRating > 0 && (
              <span
                style={{ marginLeft: 8, fontSize: "0.85rem", color: "#888" }}
              >
                {reviewRating} / 5
              </span>
            )}
          </div>

          {reviewRating > 0 && (
            <>
              <div className="form-group">
                <label>
                  Write a review{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your thoughts about this book…"
                  className="review-textarea"
                />
              </div>
              <div className="anonymous-row">
                <input
                  type="checkbox"
                  id="anon-check"
                  checked={reviewAnonymous}
                  onChange={(e) => setReviewAnonymous(e.target.checked)}
                />
                <label htmlFor="anon-check">Post as Anonymous</label>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-sm btn-outline"
              onClick={closeReturnModal}
            >
              Cancel
            </button>
            <button className="btn btn-sm" onClick={handleReturn}>
              {reviewRating > 0 ? "Submit & Return" : "Return"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberDashboard;
