import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserAvatar from "../components/UserAvatar";
import TopBar from "../components/TopBar";
import NavTabs from "../components/NavTabs";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Select from "../components/Select";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { GENRES } from "../constants";

const TABS = [
  { id: "home", label: "Home" },
  { id: "books", label: "Available Books" },
  { id: "community", label: "Community" },
  { id: "profile", label: "My Profile" },
];

const SERVICES = [
  {
    title: "Borrow Books",
    desc: "Take home books up to your plan's limit and keep them for the full loan period.",
    image: "/service_borrow.jpg",
    color: "rgba(26,35,126,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    title: "Reserve a Copy",
    desc: "When all copies are out, join the queue and get first dibs when one is returned.",
    image: "/service_reserve.jpg",
    color: "rgba(191,54,12,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: "AI Search",
    desc: "Describe what you feel like reading in plain English and let AI find the right match.",
    image: "/service_ai_search.jpg",
    color: "rgba(74,20,140,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: "Personalised Picks",
    desc: "Get recommendations based on your reading history and readers who share your taste.",
    image: "/service_picks.jpg",
    color: "rgba(136,14,79,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    title: "Reading Communities",
    desc: "Gold members can create and join communities to discuss books and share reviews.",
    image: "/service_community.jpg",
    color: "rgba(27,94,32,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Donate & Earn",
    desc: "Donate books you no longer need and earn library credit in return.",
    image: "/service_donate.jpg",
    color: "rgba(62,39,35,0.62)",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
      </svg>
    ),
  },
];

function wcagTextColor(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
}

const REACTIONS = [
  { key: "like", label: "Like" },
  { key: "love", label: "Love" },
  { key: "haha", label: "Haha" },
  { key: "wow", label: "Wow" },
  { key: "sad", label: "Sad" },
  { key: "angry", label: "Angry" },
];

const sl = "round"; // strokeLinecap / strokeLinejoin shorthand value
function ReactionIcon({ type, size = 13 }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: sl,
    strokeLinejoin: sl,
  };
  if (type === "like")
    return (
      <svg {...common}>
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    );
  if (type === "love")
    return (
      <svg {...common}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  if (type === "haha")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 13s1.5 3 4 3 4-3 4-3" />
        <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
        <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      </svg>
    );
  if (type === "wow")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="16" rx="2" ry="2.2" />
      </svg>
    );
  if (type === "sad")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 17s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
        <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      </svg>
    );
  if (type === "angry")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 17s-1.5-2-4-2-4 2-4 2" />
        <path d="M7.5 7.5l3 2" />
        <path d="M16.5 7.5l-3 2" />
      </svg>
    );
  return null;
}

function patchReaction(comments, targetId, reactions) {
  return comments.map((c) => {
    if (c.id === targetId) return { ...c, reactions };
    if (c.replies?.length)
      return { ...c, replies: patchReaction(c.replies, targetId, reactions) };
    return c;
  });
}

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

const TIER_LABELS = { silver: "Silver", gold: "Gold", family: "Family" };

function MembershipBadge({ tier }) {
  if (!tier) return null;
  return (
    <span className={`membership-badge membership-badge-${tier}`}>
      {TIER_LABELS[tier]}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BookLoader() {
  return (
    <div className="book-loader">
      <div className="book-loader-scene">
        <div className="bl-book">
          <div className="bl-half bl-left">
            <div className="bl-line" style={{ width: "72%" }} />
            <div className="bl-line" style={{ width: "55%" }} />
            <div className="bl-line" style={{ width: "80%" }} />
            <div className="bl-line" style={{ width: "60%" }} />
            <div className="bl-line" style={{ width: "68%" }} />
          </div>
          <div className="bl-spine" />
          <div className="bl-half bl-right">
            <div className="bl-line" style={{ width: "75%" }} />
            <div className="bl-line" style={{ width: "58%" }} />
            <div className="bl-line" style={{ width: "82%" }} />
            <div className="bl-line" style={{ width: "63%" }} />
            <div className="bl-line" style={{ width: "70%" }} />
          </div>
          <div className="bl-page" />
        </div>
      </div>
      <p className="book-loader-label">Loading your library…</p>
    </div>
  );
}

function BookStrip({ children }) {
  const ref = useRef(null);
  const timerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const scroll = (dir) => {
    ref.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), 2000);
  };

  return (
    <div
      className={`book-strip-wrapper${
        active && overflows ? " arrows-active" : ""
      }`}
      onMouseEnter={() => {
        if (overflows) {
          clearTimeout(timerRef.current);
          setActive(true);
        }
      }}
      onMouseLeave={() => {
        clearTimeout(timerRef.current);
        setActive(false);
      }}
    >
      {overflows && (
        <button
          className="strip-arrow strip-arrow-left"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          <ChevronLeft />
        </button>
      )}
      <div className="rec-strip" ref={ref}>
        {children}
      </div>
      {overflows && (
        <button
          className="strip-arrow strip-arrow-right"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

function resizeImageToBase64(file, maxPx = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
    };
    reader.readAsDataURL(file);
  });
}

function MemberDashboard() {
  const { user, logout, updateUser } = useAuth();
  const { toasts, toast } = useToast();
  const [tab, setTab] = useState("home");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [collabRecs, setCollabRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [membershipInfo, setMembershipInfo] = useState(null);

  // AI search
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Book detail modal
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [bookReviews, setBookReviews] = useState(null);

  // Return + review modal
  const [returnModal, setReturnModal] = useState(null); // { borrowId, bookTitle }
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);

  // Avatar
  const avatarInputRef = useRef(null);
  const servicesRef = useRef(null);
  const servicesTimerRef = useRef(null);
  const [servicesActive, setServicesActive] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Donation
  const EMPTY_DONATION = {
    title: "",
    author: "",
    isbn: "",
    genre: "",
    condition: "good",
    estimated_price: "",
  };
  const [donations, setDonations] = useState([]);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donationForm, setDonationForm] = useState(EMPTY_DONATION);
  const [donationError, setDonationError] = useState("");
  const [donationSuccess, setDonationSuccess] = useState(false);

  // Community
  const [communityView, setCommunityView] = useState("list"); // 'list' | 'community' | 'post'
  const [communities, setCommunities] = useState([]);
  const [myCommunities, setMyCommunities] = useState([]);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityForm, setCommunityForm] = useState({
    name: "",
    description: "",
  });
  const [communityFormError, setCommunityFormError] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", content: "" });
  const [postFormError, setPostFormError] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [communityBadge, setCommunityBadge] = useState(0);

  const tier = membershipInfo?.membership?.tier || null;
  const isGold = tier === "gold";

  const selectedBook = books.find((b) => b.id === selectedBookId) || null;

  const load = useCallback(() => {
    setError("");
    Promise.all([
      api.get("/books").then((r) => setBooks(r.data)),
      api.get("/my-borrows").then((r) => setBorrows(r.data)),
      api.get("/my-fines").then((r) => setFines(r.data)),
      api.get("/my-reservations").then((r) => setReservations(r.data)),
      api
        .get("/my-donations")
        .then((r) => setDonations(r.data))
        .catch(() => {}),
      api
        .get("/membership")
        .then((r) => setMembershipInfo(r.data))
        .catch(() => {}),
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
    ])
      .catch(() => setError("Failed to load data. Is the server running?"))
      .finally(() => setLoading(false));
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

  // Poll for community activity badge when not on the community tab
  useEffect(() => {
    if (!isGold) return;
    if (tab === "community") return;

    const doPoll = async () => {
      const lastSeen =
        localStorage.getItem("communityLastSeen") || new Date(0).toISOString();
      try {
        const r = await api.get(
          `/communities/activity-count?since=${encodeURIComponent(lastSeen)}`
        );
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
  };

  const borrow = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/borrow/${bookId}`);
      load();
      toast("Book borrowed!");
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
      toast(
        reviewRating > 0 ? "Returned & review submitted!" : "Book returned!"
      );
    } catch (e) {
      setReturnModal(null);
      toast(e.response?.data?.error || "Failed to return book", "error");
    }
  };

  const reserve = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/reserve/${bookId}`);
      load();
      toast("Book reserved!");
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to reserve book");
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      await api.delete(`/cancel-reservation/${reservationId}`);
      load();
      toast("Reservation cancelled");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to cancel reservation", "error");
    }
  };

  // ── Community ────────────────────────────────────────────────────────────────
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

  const openCommunity = async (community) => {
    setSelectedCommunity(community);
    setCommunityView("community");
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
    setCommunityView("post");
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

  const submitCreateCommunity = async (e) => {
    e.preventDefault();
    setCommunityFormError("");
    try {
      await api.post("/communities", communityForm);
      setShowCreateCommunity(false);
      setCommunityForm({ name: "", description: "" });
      loadCommunities();
      toast("Community submitted for review");
    } catch (err) {
      setCommunityFormError(
        err.response?.data?.error || "Failed to create community"
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
    } catch (err) {
      setCommentError(err.response?.data?.error || "Failed to post reply");
    }
  };

  const reactPost = async (emoji) => {
    try {
      const r = await api.post(
        `/communities/${selectedCommunity.id}/posts/${selectedPost.id}/react`,
        { emoji }
      );
      setSelectedPost((prev) => ({ ...prev, reactions: r.data }));
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

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5 MB");
      return;
    }
    setAvatarError("");
    try {
      const base64 = await resizeImageToBase64(file);
      const res = await api.put("/auth/avatar", { avatar: base64 });
      updateUser(res.data);
      toast("Photo updated");
    } catch {
      setAvatarError("Failed to update profile image");
    }
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
      toast("Donation submitted!");
    } catch (err) {
      setDonationError(
        err.response?.data?.error || "Failed to submit donation"
      );
    }
  };

  const activeBorrows = borrows.filter((b) => !b.return_date);
  const borrowedBookIds = new Set(activeBorrows.map((b) => b.book_id));

  // Tint the UI with the cover colour of the most recently borrowed book
  const accentColor = useMemo(() => {
    if (!borrows.length || !books.length) return null;
    const sorted = [...borrows].sort(
      (a, b) => new Date(b.borrow_date) - new Date(a.borrow_date)
    );
    const recent = sorted.find((b) => !b.return_date) || sorted[0];
    const book = books.find((b) => b.id === recent?.book_id);
    return book?.cover_color || null;
  }, [borrows, books]);

  // WCAG-safe text colour to render ON TOP of the accent background
  const accentText = useMemo(() => {
    if (!accentColor) return null;
    const r = parseInt(accentColor.slice(1, 3), 16);
    const g = parseInt(accentColor.slice(3, 5), 16);
    const b = parseInt(accentColor.slice(5, 7), 16);
    return wcagTextColor(r, g, b);
  }, [accentColor]);
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
    aiMode ||
    search ||
    selectedGenre ||
    availFilter !== "all" ||
    ratingFilter > 0;

  const clearFilters = () => {
    setSearch("");
    setSelectedGenre("");
    setAvailFilter("all");
    setRatingFilter(0);
    setAiMode(false);
    setAiResults(null);
    setAiQuery("");
    setAiError("");
  };

  const toggleAiMode = () => {
    if (!aiMode) {
      setSearch("");
      setSelectedGenre("");
      setAvailFilter("all");
      setRatingFilter(0);
    }
    setAiMode((m) => !m);
    setAiResults(null);
    setAiQuery("");
    setAiError("");
  };

  const runAiSearch = async () => {
    if (!aiQuery.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiResults(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const r = await api.post(
        "/books/ai-search",
        { query: aiQuery.trim() },
        { signal: controller.signal }
      );
      setAiResults(r.data);
    } catch (e) {
      const timedOut = e.name === "CanceledError" || e.code === "ERR_CANCELED";
      setAiError(timedOut ? null : (e.response?.data?.error || null));
      setAiResults([]);
    } finally {
      clearTimeout(timer);
      setAiLoading(false);
    }
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
    if (t === "community") {
      localStorage.setItem("communityLastSeen", new Date().toISOString());
      setCommunityBadge(0);
      if (!communitiesLoaded && isGold) loadCommunities();
    }
  };

  // Derive palette instantly from server-stored cover_color (no async canvas needed)
  const coverPalette = useMemo(() => {
    const hex = selectedBook?.cover_color;
    if (!hex) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { bg: `rgb(${r}, ${g}, ${b})`, text: wcagTextColor(r, g, b) };
  }, [selectedBook]); // eslint-disable-line

  // Inline styles that adapt to the cover's dominant color for WCAG compliance
  const heroIsLight = coverPalette?.text === "#ffffff";
  const heroLabelStyle = coverPalette
    ? { color: heroIsLight ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)" }
    : {};
  const heroRowStyle = coverPalette
    ? {
        borderBottomColor: heroIsLight
          ? "rgba(255,255,255,0.18)"
          : "rgba(0,0,0,0.1)",
      }
    : {};
  const heroSubtleStyle = coverPalette
    ? { color: heroIsLight ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.65)" }
    : {};
  const heroFaintStyle = coverPalette
    ? { color: heroIsLight ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.38)" }
    : {};

  if (loading) return <BookLoader />;

  return (
    <div
      className="layout"
      style={
        accentColor
          ? { "--accent": accentColor, "--accent-text": accentText }
          : {}
      }
    >
      <TopBar
        title="Library"
        username={user.username}
        avatar={user.avatar}
        tier={tier}
        onLogout={logout}
      />
      <NavTabs
        tabs={TABS}
        active={tab}
        onChange={handleTabChange}
        badges={{ community: communityBadge }}
      />
      <div className="content">
        {error && <div className="error">{error}</div>}

        {tab === "home" && (
          <div className="home-tab">
            {/* Hero */}
            <div className="home-hero">
              <div className="home-hero-title">
                {(() => {
                  const h = new Date().getHours();
                  if (h >= 5 && h < 12) return "Good morning";
                  if (h >= 12 && h < 17) return "Good afternoon";
                  if (h >= 17 && h < 21) return "Good evening";
                  return "Hello, night owl";
                })()}
              </div>
              <h2 className="home-hero-eyebrow">{user.username}</h2>
              <p className="home-hero-sub">
                Browse the catalogue, borrow books, and connect with fellow
                readers.
              </p>
            </div>

            {/* Services */}
            <div className="home-section">
              <div className="home-section-heading">What we offer</div>
              <div
                className={`home-services-strip-wrapper${
                  servicesActive ? " arrows-active" : ""
                }`}
                onMouseEnter={() => {
                  clearTimeout(servicesTimerRef.current);
                  setServicesActive(true);
                }}
                onMouseLeave={() => {
                  clearTimeout(servicesTimerRef.current);
                  setServicesActive(false);
                }}
              >
                <button
                  className="services-arrow services-arrow-left"
                  onClick={() => {
                    servicesRef.current?.scrollBy({
                      left: -380,
                      behavior: "smooth",
                    });
                    clearTimeout(servicesTimerRef.current);
                    servicesTimerRef.current = setTimeout(
                      () => setServicesActive(false),
                      2000
                    );
                  }}
                  aria-label="Scroll left"
                >
                  <ChevronLeft />
                </button>
                <div className="home-services-strip" ref={servicesRef}>
                  {SERVICES.map((s) => (
                    <div
                      className="home-service-card"
                      key={s.title}
                      style={{
                        backgroundImage: `url(${s.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {/* <div className="home-service-icon">{s.icon}</div> */}
                      <div className="home-service-title">{s.title}</div>
                      <div className="home-service-desc">{s.desc}</div>
                    </div>
                  ))}
                </div>
                <button
                  className="services-arrow services-arrow-right"
                  onClick={() => {
                    servicesRef.current?.scrollBy({
                      left: 380,
                      behavior: "smooth",
                    });
                    clearTimeout(servicesTimerRef.current);
                    servicesTimerRef.current = setTimeout(
                      () => setServicesActive(false),
                      2000
                    );
                  }}
                  aria-label="Scroll right"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            {/* Book preview */}
            {books.length > 0 && (
              <div className="home-section">
                <div className="home-section-header">
                  <div className="home-section-heading">
                    From the collection
                  </div>
                  <button
                    className="home-view-all"
                    onClick={() => handleTabChange("books")}
                  >
                    View all →
                  </button>
                </div>
                <div className="home-books-grid">
                  {books.slice(0, 6).map((book) => {
                    const stars = book.avg_rating
                      ? Math.round(book.avg_rating)
                      : 0;
                    return (
                      <button
                        key={book.id}
                        className="home-book-card"
                        onClick={() => openBook(book.id)}
                      >
                        <div className="home-book-cover-wrap">
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt=""
                              className="home-book-cover"
                            />
                          ) : (
                            <div className="home-book-cover-placeholder" />
                          )}
                        </div>
                        <div className="home-book-info">
                          <div className="home-book-title">{book.title}</div>
                          <div className="home-book-author">{book.author}</div>
                          <div className="home-book-meta">
                            {book.genre && (
                              <span className="rec-card-genre">
                                {book.genre}
                              </span>
                            )}
                            {book.avg_rating > 0 && (
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
                          <div className="home-book-avail">
                            {book.available_copies > 0 ? (
                              `${book.available_copies} available`
                            ) : (
                              <span className="muted">Unavailable</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "books" && (
          <>
            {/* Search trigger row */}
            <div className="search-trigger-row">
              <button
                className={`search-icon-btn${
                  hasActiveFilters ? " has-filters" : ""
                }`}
                onClick={() => setSearchOpen((o) => !o)}
                aria-label={searchOpen ? "Close search" : "Open search"}
              >
                {searchOpen ? <XIcon /> : <SearchIcon />}
                {hasActiveFilters && !searchOpen && (
                  <span className="search-active-dot" />
                )}
              </button>
              {books.length > 0 && (
                <span className="book-count-label">
                  {aiMode && aiResults !== null
                    ? `${aiResults.length} AI match${
                        aiResults.length !== 1 ? "es" : ""
                      }`
                    : filteredBooks.length === books.length
                    ? `${books.length} books`
                    : `${filteredBooks.length} of ${books.length} books`}
                </span>
              )}
            </div>

            {/* Expandable search + filter panel */}
            {searchOpen && (
              <div className="search-panel">
                <div className="search-panel-top">
                  {aiMode ? (
                    <div className="ai-search-row">
                      <input
                        className="ai-search-input"
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="Describe what you're looking for… (press Enter)"
                        onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
                        autoFocus
                        disabled={aiLoading}
                      />
                    </div>
                  ) : (
                    <SearchBar
                      value={search}
                      onChange={setSearch}
                      placeholder="Search by title, author, genre…"
                      className="search-bar-wide"
                      autoFocus
                    />
                  )}
                  <button
                    className={`ai-toggle-btn${
                      aiMode ? " ai-toggle-active" : ""
                    }`}
                    onClick={toggleAiMode}
                    title={
                      aiMode
                        ? "Switch to keyword search"
                        : "Switch to AI search"
                    }
                  >
                    AI
                  </button>
                </div>
                {!aiMode && (
                  <div className="search-panel-filters">
                    {/* <Select
                      className="filter-select"
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                    >
                      <option value="">All genres</option>
                      {availableGenres.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </Select> */}
                    <Select
                      className="filter-select"
                      value={availFilter}
                      onChange={(e) => setAvailFilter(e.target.value)}
                    >
                      <option value="all">All copies</option>
                      <option value="available">Available now</option>
                      <option value="unavailable">Unavailable</option>
                    </Select>
                    <Select
                      className="filter-select"
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(Number(e.target.value))}
                    >
                      <option value={0}>Any rating</option>
                      <option value={4}>4+ stars</option>
                      <option value={3}>3+ stars</option>
                      <option value={2}>2+ stars</option>
                    </Select>
                    {hasActiveFilters && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={clearFilters}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                {aiMode && (aiResults !== null || aiError) && (
                  <div className="search-panel-filters">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Genre pills */}
            {!aiMode && availableGenres.length > 0 && (
              <div className="genre-strip" style={{ marginTop: 20 }}>
                <button
                  className={`genre-card${
                    selectedGenre === "" ? " active" : ""
                  }`}
                  onClick={() => setSelectedGenre("")}
                >
                  <span className="genre-card-name">All</span>
                  {/* <span className="genre-card-count">{books.length}</span> */}
                </button>
                {availableGenres.map((g) => (
                  <button
                    key={g}
                    className={`genre-card${
                      selectedGenre === g ? " active" : ""
                    }`}
                    onClick={() =>
                      setSelectedGenre(selectedGenre === g ? "" : g)
                    }
                  >
                    <span className="genre-card-name">{g}</span>
                    {/* <span className="genre-card-count">{genreCounts[g]}</span> */}
                  </button>
                ))}
              </div>
            )}

            {/* AI search results */}
            {aiMode && aiLoading && (
              <div className="empty ai-searching-msg">Searching with AI…</div>
            )}
            {aiMode && !aiLoading && aiResults !== null && aiResults.length === 0 && (
              <div className="empty search-no-results">
                No results found for this search.{" "}
                <button className="btn-link" onClick={clearFilters}>Try again</button>
              </div>
            )}
            {aiMode &&
              !aiLoading &&
              aiResults !== null &&
              aiResults.length > 0 && (
                <div className="books-grid">
                  {aiResults.map((b) => {
                    const stars = b.avg_rating ? Math.round(b.avg_rating) : 0;
                    return (
                      <button
                        key={b.id}
                        className="rec-card"
                        onClick={() => openBook(b.id)}
                      >
                        {b.cover_url && (
                          <img
                            src={b.cover_url}
                            alt=""
                            className="rec-card-cover"
                          />
                        )}
                        <div className="rec-card-reason ai-reason">
                          {b.reason}
                        </div>
                        <div className="rec-card-title">
                          {b.title}
                          {trendingIds.has(b.id) && (
                            <span
                              className="trending-tag"
                              style={{ marginLeft: 6 }}
                            >
                              Trending
                            </span>
                          )}
                        </div>
                        <div className="rec-card-author">{b.author}</div>
                        <div className="rec-card-meta">
                          {b.genre && (
                            <span className="rec-card-genre">{b.genre}</span>
                          )}
                          {b.rating_count > 0 && (
                            <span className="rec-card-rating">
                              <span className="rec-stars">
                                {"★".repeat(stars)}
                                {"☆".repeat(5 - stars)}
                              </span>
                              <span className="rec-rating-val">
                                {b.avg_rating}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="rec-card-avail">
                          {b.available_copies > 0 ? (
                            `${b.available_copies} available`
                          ) : (
                            <span className="muted">Unavailable</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* Normal keyword search results */}
            {!aiMode && hasActiveFilters && filteredBooks.length === 0 && (
              <div className="empty search-no-results">
                No results found for this search.{" "}
                <button className="btn-link" onClick={clearFilters}>Try again</button>
              </div>
            )}
            {!aiMode && hasActiveFilters && filteredBooks.length > 0 && (
              <div className="books-grid">
                {filteredBooks.map((b) => {
                  const stars = b.avg_rating ? Math.round(b.avg_rating) : 0;
                  return (
                    <button
                      key={b.id}
                      className="rec-card"
                      onClick={() => openBook(b.id)}
                    >
                      {b.cover_url && (
                        <img
                          src={b.cover_url}
                          alt=""
                          className="rec-card-cover"
                        />
                      )}
                      <div className="rec-card-title">
                        {b.title}
                        {trendingIds.has(b.id) && (
                          <span
                            className="trending-tag"
                            style={{ marginLeft: 6 }}
                          >
                            Trending
                          </span>
                        )}
                      </div>
                      <div className="rec-card-author">{b.author}</div>
                      <div className="rec-card-meta">
                        {b.genre && (
                          <span className="rec-card-genre">{b.genre}</span>
                        )}
                        {b.rating_count > 0 && (
                          <span className="rec-card-rating">
                            <span className="rec-stars">
                              {"★".repeat(stars)}
                              {"☆".repeat(5 - stars)}
                            </span>
                            <span className="rec-rating-val">
                              {b.avg_rating}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="rec-card-avail">
                        {b.available_copies > 0 ? (
                          `${b.available_copies} available`
                        ) : (
                          <span className="muted">Unavailable</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                      <BookStrip>
                        {trending.map((book) => {
                          const stars = book.avg_rating
                            ? Math.round(book.avg_rating)
                            : 0;
                          const n = book.borrow_count_week;
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
                      </BookStrip>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div className="rec-section">
                      <div className="rec-heading">Recommended for you</div>
                      <BookStrip>
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
                      </BookStrip>
                    </div>
                  )}

                  {dedupedCollab.length > 0 && (
                    <div className="rec-section">
                      <div className="rec-heading">
                        Readers like you also enjoyed
                      </div>
                      <BookStrip>
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
                      </BookStrip>
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
                    <BookStrip>
                      {booksByGenre[genre].map((book) => {
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
                            <div className="rec-card-title">
                              {book.title}
                              {trendingIds.has(book.id) && (
                                <span
                                  className="trending-tag"
                                  style={{ marginLeft: 6 }}
                                >
                                  Trending
                                </span>
                              )}
                            </div>
                            <div className="rec-card-author">{book.author}</div>
                            {book.rating_count > 0 && (
                              <div className="rec-card-meta">
                                <span className="rec-card-rating">
                                  <span className="rec-stars">
                                    {"★".repeat(stars)}
                                    {"☆".repeat(5 - stars)}
                                  </span>
                                  <span className="rec-rating-val">
                                    {book.avg_rating}
                                  </span>
                                </span>
                              </div>
                            )}
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
                    </BookStrip>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "profile" && (
          <>
            {/* Avatar editor */}
            <div className="profile-avatar-section">
              <div
                className="profile-avatar-wrap"
                onClick={() => avatarInputRef.current?.click()}
                title="Change profile photo"
              >
                <UserAvatar
                  avatar={user.avatar}
                  username={user.username}
                  size={80}
                />
                <div className="profile-avatar-overlay">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>
              <div className="profile-avatar-info">
                <div className="profile-username">{user.username}</div>
                <div className="profile-avatar-hint">Click to change photo</div>
                {avatarError && (
                  <div
                    className="error"
                    style={{ marginTop: 4, marginBottom: 0 }}
                  >
                    {avatarError}
                  </div>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>

            {membershipInfo && (
              <div className="membership-card">
                <div className="membership-card-tier">
                  <MembershipBadge tier={membershipInfo.membership?.tier} />
                  {!membershipInfo.membership && (
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      No membership
                    </span>
                  )}
                </div>
                <div className="membership-card-stats">
                  {membershipInfo.membership && (
                    <>
                      <div className="membership-stat">
                        <span className="membership-stat-label">
                          Borrow limit
                        </span>
                        <span className="membership-stat-value">
                          {membershipInfo.membership.borrow_limit} book
                          {membershipInfo.membership.borrow_limit > 1
                            ? "s"
                            : ""}{" "}
                          at a time
                        </span>
                      </div>
                      <div className="membership-stat">
                        <span className="membership-stat-label">
                          Monthly rate
                        </span>
                        <span className="membership-stat-value">
                          $
                          {membershipInfo.membership.tier === "silver"
                            ? membershipInfo.pricing.silver_rate.toFixed(2)
                            : membershipInfo.membership.tier === "gold"
                            ? membershipInfo.pricing.gold_rate.toFixed(2)
                            : membershipInfo.pricing.family_rate.toFixed(2)}
                        </span>
                      </div>
                      {membershipInfo.membership.tier === "family" &&
                        membershipInfo.family_members.length > 0 && (
                          <div className="membership-stat">
                            <span className="membership-stat-label">
                              Family group
                            </span>
                            <span
                              className="membership-stat-value"
                              style={{ fontSize: "0.85rem" }}
                            >
                              {membershipInfo.family_members.join(", ")}
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
              <table className="profile-table">
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
              <table className="profile-table">
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
                          <Badge variant="queue">
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
              <table className="profile-table">
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
              <button className="btn btn-sm" onClick={openDonateModal}>
                Donate
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
              Donate a book you own to the library. Once approved by an admin,
              the book is added to the catalogue and you earn{" "}
              <strong>1/4 of its estimated value</strong> as library credit.
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
                    <div
                      className="membership-card"
                      style={{ marginBottom: 16 }}
                    >
                      <div className="membership-card-stats">
                        <div className="membership-stat">
                          <span className="membership-stat-label">
                            Total credits earned
                          </span>
                          <span className="membership-stat-value">
                            ${totalCredit.toFixed(2)}
                          </span>
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
                          {d.status === "approved" ? (
                            <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                              ${(d.credit_amount || 0).toFixed(2)}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
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
                            {d.status.charAt(0).toUpperCase() +
                              d.status.slice(1)}
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
        {tab === "community" && (
          <>
            {!isGold ? (
              <div className="community-locked">
                <div className="community-locked-icon">🔒</div>
                <h3>Gold Members Only</h3>
                <p>The Community section is exclusively for Gold members.</p>
                <p>
                  Upgrade your membership to Gold to create and join
                  communities, make posts, and connect with other readers.
                </p>
              </div>
            ) : communityView === "list" ? (
              <>
                <div className="section-header">
                  <h3>Communities</h3>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setCommunityForm({ name: "", description: "" });
                      setCommunityFormError("");
                      setShowCreateCommunity(true);
                    }}
                  >
                    + Create Community
                  </button>
                </div>

                {/* Pending / rejected requests */}
                {myCommunities.filter((c) => c.status !== "approved").length >
                  0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div className="community-section-label">
                      Your pending requests
                    </div>
                    {myCommunities
                      .filter((c) => c.status !== "approved")
                      .map((c) => (
                        <div key={c.id} className="community-card">
                          <div className="community-card-header">
                            <div>
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
                                c.status === "rejected" ? "overdue" : "returned"
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
                      ))}
                  </div>
                )}

                {!communitiesLoaded ? (
                  <div className="empty">Loading communities…</div>
                ) : communities.length === 0 ? (
                  <div className="empty">
                    No communities yet — be the first to create one!
                  </div>
                ) : (
                  communities.map((c) => (
                    <div key={c.id} className="community-card">
                      <div className="community-card-header">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="community-card-name">{c.name}</div>
                          {c.description && (
                            <div className="community-card-desc">
                              {c.description}
                            </div>
                          )}
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
                        </div>
                        <div className="btn-row" style={{ flexShrink: 0 }}>
                          {c.is_member ? (
                            <>
                              <button
                                className="btn btn-sm"
                                onClick={() => openCommunity(c)}
                              >
                                View
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => leaveCommunity(c.id)}
                              >
                                Leave
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm"
                              onClick={() => joinCommunity(c)}
                            >
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : communityView === "community" ? (
              <>
                <div className="community-nav">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setCommunityView("list");
                      loadCommunities();
                    }}
                  >
                    ← Back
                  </button>
                  <div>
                    <div className="community-nav-title">
                      {selectedCommunity?.name}
                    </div>
                    <div className="community-nav-meta">
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
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      setPostForm({ title: "", content: "" });
                      setPostFormError("");
                      setShowCreatePost(true);
                    }}
                  >
                    + New Post
                  </button>
                </div>

                {postsLoading ? (
                  <div className="empty">Loading posts…</div>
                ) : communityPosts.length === 0 ? (
                  <div className="empty">
                    No posts yet — start the conversation!
                  </div>
                ) : (
                  communityPosts.map((post) => (
                    <div
                      key={post.id}
                      className="post-card"
                      onClick={() => openPost(post)}
                    >
                      <div className="post-card-title">{post.title}</div>
                      <div className="post-card-meta">
                        <span>{post.author_username}</span>
                        <span className="muted">·</span>
                        <span className="muted">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        <span className="muted">·</span>
                        <span className="muted">
                          {post.comment_count} comment
                          {post.comment_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {Object.keys(post.reactions.counts).length > 0 && (
                        <div className="post-reactions-preview">
                          {REACTIONS.filter(
                            ({ key }) => post.reactions.counts[key] > 0
                          ).map(({ key, label }) => (
                            <span
                              key={key}
                              className="reaction-mini"
                              title={label}
                            >
                              <ReactionIcon type={key} size={11} />
                              <span className="reaction-count">
                                {post.reactions.counts[key]}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : communityView === "post" ? (
              <>
                <div className="community-nav" style={{ marginBottom: 24 }}>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setCommunityView("community");
                    }}
                  >
                    ← {selectedCommunity?.name}
                  </button>
                </div>

                {postLoading || !selectedPost ? (
                  <div className="empty">Loading…</div>
                ) : (
                  <>
                    <div className="post-detail">
                      <h2 className="post-detail-title">
                        {selectedPost.title}
                      </h2>
                      <div className="post-detail-meta">
                        <span>{selectedPost.author_username}</span>
                        <span className="muted">·</span>
                        <span className="muted">
                          {new Date(selectedPost.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="post-detail-content">
                        {selectedPost.content}
                      </div>
                      <div className="reaction-bar">
                        {REACTIONS.map(({ key, label }) => {
                          const count = selectedPost.reactions.counts[key] || 0;
                          const active =
                            selectedPost.reactions.user_reaction === key;
                          return (
                            <button
                              key={key}
                              className={`reaction-btn${
                                active ? " reaction-active" : ""
                              }`}
                              onClick={() => reactPost(key)}
                              title={label}
                            >
                              <ReactionIcon type={key} size={15} />
                              {count > 0 && (
                                <span className="reaction-count">{count}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="comments-section">
                      <div className="comments-header">
                        {selectedPost.comment_count} Comment
                        {selectedPost.comment_count !== 1 ? "s" : ""}
                      </div>

                      <form className="comment-form" onSubmit={submitComment}>
                        {commentError && (
                          <div className="error" style={{ marginBottom: 8 }}>
                            {commentError}
                          </div>
                        )}
                        <textarea
                          className="comment-input"
                          value={commentContent}
                          onChange={(e) => setCommentContent(e.target.value)}
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
        <Modal
          title={selectedBook.title}
          onClose={closeBook}
          wide
          heroBg={coverPalette?.bg}
          heroTextColor={coverPalette?.text}
          heroContent={
            <>
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
                  <div className="book-detail-row" style={heroRowStyle}>
                    <span className="book-detail-label" style={heroLabelStyle}>
                      Author
                    </span>
                    <span>{selectedBook.author}</span>
                  </div>
                  <div className="book-detail-row" style={heroRowStyle}>
                    <span className="book-detail-label" style={heroLabelStyle}>
                      Genre
                    </span>
                    <span>
                      {selectedBook.genre || (
                        <span style={heroFaintStyle}>—</span>
                      )}
                    </span>
                  </div>
                  <div className="book-detail-row" style={heroRowStyle}>
                    <span className="book-detail-label" style={heroLabelStyle}>
                      Available
                    </span>
                    <span>
                      {selectedBook.available_copies} /{" "}
                      {selectedBook.total_copies}
                      {selectedBook.available_copies === 0 &&
                        selectedBook.reservation_count > 0 && (
                          <span
                            style={{
                              ...heroFaintStyle,
                              marginLeft: 6,
                              fontSize: "0.8em",
                            }}
                          >
                            ({selectedBook.reservation_count} waiting)
                          </span>
                        )}
                    </span>
                  </div>
                  <div
                    className="book-detail-row"
                    style={{ ...heroRowStyle, borderBottom: "none" }}
                  >
                    <span className="book-detail-label" style={heroLabelStyle}>
                      Rating
                    </span>
                    <span>
                      {bookReviews && bookReviews.rating_count > 0 ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <StarDisplay rating={bookReviews.avg_rating} />
                          <span
                            style={{ fontSize: "0.85rem", ...heroSubtleStyle }}
                          >
                            {bookReviews.avg_rating} / 5
                          </span>
                          <span
                            style={{ fontSize: "0.8rem", ...heroFaintStyle }}
                          >
                            · {bookReviews.rating_count}{" "}
                            {bookReviews.rating_count === 1
                              ? "rating"
                              : "ratings"}
                          </span>
                        </span>
                      ) : (
                        <span style={heroFaintStyle}>No ratings yet</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="error" style={{ marginTop: 16 }}>
                  {actionError}
                </div>
              )}
              <div className="book-detail-action">
                <BookActionButton book={selectedBook} />
              </div>
            </>
          }
        >
          {/* Description + author bio below the colored hero zone */}
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
                Your donation has been submitted! The admin will review it and
                add the book to the catalogue. You'll earn{" "}
                <strong>1/4 of the estimated value</strong> as credit once
                approved.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setShowDonateModal(false);
                    setDonationSuccess(false);
                  }}
                >
                  Close
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setDonationSuccess(false)}
                >
                  Donate another
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submitDonation}>
              {donationError && <div className="error">{donationError}</div>}
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={donationForm.title}
                  onChange={(e) =>
                    setDonationForm({ ...donationForm, title: e.target.value })
                  }
                  placeholder="Book title"
                  required
                />
              </div>
              <div className="form-group">
                <label>Author *</label>
                <input
                  value={donationForm.author}
                  onChange={(e) =>
                    setDonationForm({ ...donationForm, author: e.target.value })
                  }
                  placeholder="Author name"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  ISBN{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional — helps us find cover &amp; description)
                  </span>
                </label>
                <input
                  value={donationForm.isbn}
                  onChange={(e) =>
                    setDonationForm({ ...donationForm, isbn: e.target.value })
                  }
                  placeholder="e.g. 978-0747532743"
                />
              </div>
              <div className="form-group">
                <label>
                  Genre{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <Select
                  value={donationForm.genre}
                  onChange={(e) =>
                    setDonationForm({ ...donationForm, genre: e.target.value })
                  }
                >
                  <option value="">— Select genre —</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>Condition *</label>
                <Select
                  value={donationForm.condition}
                  onChange={(e) =>
                    setDonationForm({
                      ...donationForm,
                      condition: e.target.value,
                    })
                  }
                >
                  <option value="new">New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </Select>
              </div>
              <div className="form-group">
                <label>Estimated Value ($) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={donationForm.estimated_price}
                  onChange={(e) =>
                    setDonationForm({
                      ...donationForm,
                      estimated_price: e.target.value,
                    })
                  }
                  placeholder="e.g. 20.00"
                  required
                />
                {donationForm.estimated_price > 0 && (
                  <p className="field-hint">
                    You will earn{" "}
                    <strong>
                      ${(Number(donationForm.estimated_price) / 4).toFixed(2)}
                    </strong>{" "}
                    in library credit upon approval.
                  </p>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowDonateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  Submit Donation
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <Modal
          title="Create a Community"
          onClose={() => setShowCreateCommunity(false)}
        >
          <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
            Communities require admin approval before members can join. You'll
            be notified once reviewed.
          </p>
          <form onSubmit={submitCreateCommunity}>
            {communityFormError && (
              <div className="error">{communityFormError}</div>
            )}
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
                onClick={() => setShowCreateCommunity(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm">
                Submit for Approval
              </button>
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
                onClick={() => setShowCreatePost(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm">
                Post
              </button>
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
      <Toast toasts={toasts} />
    </div>
  );
}

export default MemberDashboard;
