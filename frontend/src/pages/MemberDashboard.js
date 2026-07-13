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
import Dock from "../components/Dock";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Select from "../components/Select";
import Toast from "../components/Toast";
import Onboarding from "../components/Onboarding";
import PreferenceQuiz from "../components/PreferenceQuiz";
import { useToast } from "../hooks/useToast";
import { useTheme } from "../context/ThemeContext";
import { GENRES } from "../constants";
import {
  wcagTextColor,
  minAlphaForContrast,
  relLuminance,
  contrastRatio,
  contrastTextFor,
} from "../utils/colorContrast";
import { resizeImageToBase64 } from "../utils/resizeImageToBase64";
import { formatCurrency, getCurrencySymbol } from "../utils/currency";
import NoCoverPlaceholder from "../components/NoCoverPlaceholder";
import FilterIcon from "../components/icons/FilterIcon";
import XIcon from "../components/icons/XIcon";
import ChevronLeft from "../components/icons/ChevronLeft";
import ChevronDown from "../components/icons/ChevronDown";
import AlertTriangleIcon from "../components/icons/AlertTriangleIcon";
import CheckIcon from "../components/icons/CheckIcon";
import PaletteIcon from "../components/icons/PaletteIcon";
import LockIcon from "../components/icons/LockIcon";
import BookLoader from "../components/BookLoader";
import BookStrip from "../components/BookStrip";
import StarPicker from "../components/StarPicker";
import StarDisplay from "../components/StarDisplay";
import MembershipBadge from "../components/MembershipBadge";
import CommentItem from "../components/community/CommentItem";
import { patchReaction } from "../components/community/patchReaction";
import { TIER_LABELS, TIER_OPTIONS } from "../constants/membership";
import {
  APPEARANCE_OPTIONS,
  READER_THEME_OPTIONS,
  ACCENT_PRESETS,
  ReaderBookIcon,
} from "../constants/appearance";
import {
  SCRAMBLE_WORDS,
  WORDLE_WORDS,
  WORDLE_VALID_WORDS,
} from "../components/games/wordBanks";
import { GAMES_LIST } from "../components/games/gamesList";
import {
  pickHangmanWord,
  shuffleWord,
  wordleFeedback,
} from "../components/games/gameLogic";
import HangmanFigure from "../components/games/HangmanFigure";

const TABS = [
  { id: "home", label: "My Stuff" },
  { id: "books", label: "Available Books" },
  { id: "donate", label: "Donate" },
  { id: "community", label: "Community" },
  { id: "games", label: "Games" },
  { id: "profile", label: "My Profile" },
];

// Preferred "danger" red shades, darkest-context first; falls back to pure
// black/white (always WCAG-safe against any background) if neither clears 4.5:1.
const HERO_ERROR_REDS = ["#8c1c1c", "#ffb4ab"];

// Default (non-hero) star-rating gold — reused as the hero star colour too,
// falling back to coverPalette.text (guaranteed 4.5:1) when it doesn't clear
// contrast against a given cover colour.
const HERO_STAR_GOLD = "#f5a623";

function MemberDashboard() {
  const { user, logout, updateUser } = useAuth();
  const currency = user?.library?.currency;
  const {
    navStyle,
    setNavStyle,
    appearance,
    setAppearance,
    readerTheme,
    setReaderTheme,
    accentOverride,
    setAccentOverride,
  } = useTheme();
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [collabRecs, setCollabRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [membershipInfo, setMembershipInfo] = useState(null);
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [requestedTier, setRequestedTier] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Home tab section accordion — only one of borrowed/reservations/wishlist/
  // collection is expanded at a time; the rest collapse to just their heading
  // bar and pile up (via the existing negative margin overlap) beneath it.
  const [openHomeSection, setOpenHomeSection] = useState("borrowed");
  const toggleHomeSection = (key) =>
    setOpenHomeSection((prev) => (prev === key ? null : key));

  // Book requests ("can't find this book?")
  const EMPTY_BOOK_REQUEST = {
    title: "",
    author: "",
    isbn: "",
    genre: "",
    notes: "",
  };
  const [bookRequests, setBookRequests] = useState([]);
  const [showBookRequestModal, setShowBookRequestModal] = useState(false);
  const [bookRequestForm, setBookRequestForm] = useState(EMPTY_BOOK_REQUEST);
  const [bookRequestError, setBookRequestError] = useState("");
  const [bookRequestSuccess, setBookRequestSuccess] = useState(false);

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
  const [returnModal, setReturnModal] = useState(null); // { borrowId, bookTitle, fine, finePaid }
  const [payFineWithReturn, setPayFineWithReturn] = useState(false);
  const [markComplete, setMarkComplete] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);

  // Reading goals
  const [readingGoal, setReadingGoal] = useState(null); // { period, target }
  const [readingProgress, setReadingProgress] = useState(0);
  const [booksReadThisYear, setBooksReadThisYear] = useState(0);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalPeriodDraft, setGoalPeriodDraft] = useState("yearly");
  const [goalTargetDraft, setGoalTargetDraft] = useState(12);
  const [savingGoal, setSavingGoal] = useState(false);

  // Avatar
  const avatarInputRef = useRef(null);
  const borrowedSectionRef = useRef(null);
  const [avatarError, setAvatarError] = useState("");

  // Accent colour custom picker
  const accentColorInputRef = useRef(null);
  const isPresetAccent =
    !accentOverride || ACCENT_PRESETS.some((p) => p.color === accentOverride);

  // Account details (username / email / password) — locked until re-authenticated
  const EMPTY_ACCOUNT_FORM = {
    username: "",
    email: "",
    new_password: "",
    confirm_password: "",
    current_password: "",
  };
  const [accountEditing, setAccountEditing] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountError, setAccountError] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

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

  // Wishlist
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Community
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
  const [communityForm, setCommunityForm] = useState({
    id: null,
    name: "",
    description: "",
    icon_url: "",
    banner_url: "",
  });
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
  const [communityBadge, setCommunityBadge] = useState(0);

  // Games (Gold perk) — client-side only, session score
  const [gameView, setGameView] = useState("menu"); // 'menu' | 'hangman' | 'scramble' | 'wordle'
  const [hangman, setHangman] = useState(null); // { answer, guessed:Set, wrong, status, xpEarned }
  const [hangmanRevealDismissed, setHangmanRevealDismissed] = useState(false);
  const [scramble, setScramble] = useState(null); // { answer, scrambled, guess, status, hintRevealed, xpEarned }
  const [scrambleHintCooldown, setScrambleHintCooldown] = useState(false);
  const scrambleHintTimeoutRef = useRef(null);
  const [wordle, setWordle] = useState(null); // { answer, guesses:[], current, status, error, xpEarned }

  const tier = membershipInfo?.membership?.tier || null;
  const isGold = tier === "gold";
  const pendingMembershipRequest =
    membershipRequests.find((r) => r.status === "pending") || null;
  const lastReviewedMembershipRequest =
    membershipRequests.find((r) => r.status !== "pending") || null;

  const unnotifiedBookRequests = bookRequests.filter(
    (r) => r.status !== "pending" && !r.notified
  );

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
        .get("/my-membership-requests")
        .then((r) => setMembershipRequests(r.data))
        .catch(() => {}),
      api
        .get("/my-book-requests")
        .then((r) => setBookRequests(r.data))
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
      api
        .get("/my-wishlist")
        .then((r) => {
          setWishlistItems(r.data);
          setWishlistIds(new Set(r.data.map((i) => i.book_id)));
        })
        .catch(() => {}),
      api
        .get("/reading-goal")
        .then((r) => {
          setReadingGoal(r.data.goal);
          setReadingProgress(r.data.progress);
          setBooksReadThisYear(r.data.books_read_this_year);
          if (r.data.goal) {
            setGoalPeriodDraft(r.data.goal.period);
            setGoalTargetDraft(r.data.goal.target);
          }
        })
        .catch(() => {}),
    ])
      .catch(() => setError("Failed to load data. Is the server running?"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maybeShowTour = useCallback(() => {
    if (!localStorage.getItem(`onboarding_seen_${user.username}`)) {
      setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (!user.onboarded) {
      setShowQuiz(true);
    } else {
      maybeShowTour();
    }
  }, [loading, user, maybeShowTour]);

  const closeOnboarding = () => {
    localStorage.setItem(`onboarding_seen_${user.username}`, "true");
    setShowOnboarding(false);
  };

  const closeQuiz = () => {
    updateUser({ onboarded: true });
    setShowQuiz(false);
    maybeShowTour();
  };

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
      toast("Book borrowed!", "success", {
        label: "View",
        onClick: () => {
          closeBook();
          setOpenHomeSection("borrowed");
          handleTabChange("home");
        },
      });
    } catch (e) {
      setActionError(e.response?.data?.error || "Failed to borrow book");
    }
  };

  const openReturnModal = (borrow) => {
    setReturnModal({
      borrowId: borrow.id,
      bookTitle: borrow.book_title,
      fine: borrow.fine || 0,
      finePaid: borrow.fine_paid,
    });
    setPayFineWithReturn(false);
    setMarkComplete(true);
    setReviewRating(0);
    setReviewHover(0);
    setReviewText("");
    setReviewAnonymous(false);
  };

  const closeReturnModal = () => setReturnModal(null);

  const goToOverdueBooks = () => {
    if (overdueBorrows.length === 1) {
      openReturnModal(overdueBorrows[0]);
      return;
    }
    setOpenHomeSection("borrowed");
    borrowedSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const returnHasUnpaidFine =
    returnModal && returnModal.fine > 0 && !returnModal.finePaid;

  const handleReturn = async () => {
    const payload = {};
    if (reviewRating > 0) {
      payload.rating = reviewRating;
      payload.review_text = reviewText.trim();
      payload.is_anonymous = reviewAnonymous;
    }
    if (returnHasUnpaidFine) {
      payload.pay_fine = payFineWithReturn;
    }
    if (markComplete) {
      payload.mark_complete = true;
    }
    try {
      await api.post(
        `/return/${returnModal.borrowId}`,
        Object.keys(payload).length ? payload : undefined
      );
      setReturnModal(null);
      load();
      toast(
        returnHasUnpaidFine
          ? "Return & fine payment submitted — awaiting admin approval!"
          : reviewRating > 0
          ? "Review submitted — return requested, awaiting admin approval!"
          : "Return requested — awaiting admin approval!"
      );
    } catch (e) {
      setReturnModal(null);
      toast(e.response?.data?.error || "Failed to return book", "error");
    }
  };

  const saveReadingGoal = async () => {
    setSavingGoal(true);
    try {
      const { data } = await api.post("/reading-goal", {
        period: goalPeriodDraft,
        target: Number(goalTargetDraft),
      });
      setReadingGoal(data.goal);
      setReadingProgress(data.progress);
      setBooksReadThisYear(data.books_read_this_year);
      setGoalEditOpen(false);
      toast("Reading goal updated!");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to save reading goal", "error");
    } finally {
      setSavingGoal(false);
    }
  };

  const reserve = async (bookId) => {
    setActionError("");
    try {
      await api.post(`/reserve/${bookId}`);
      load();
      toast("Book reserved!", "success", {
        label: "View",
        onClick: () => {
          closeBook();
          setOpenHomeSection("reservations");
          handleTabChange("home");
        },
      });
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
      setCommunityForm({
        id: null,
        name: "",
        description: "",
        icon_url: "",
        banner_url: "",
      });
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

  // ── Games (Gold perk) ────────────────────────────────────────────────────
  const HANGMAN_MAX_WRONG = 6;
  const WORDLE_XP_BY_GUESSES = [100, 80, 60, 45, 30, 15];

  // Fire-and-forget: awards XP server-side and syncs the new total into user state.
  const awardXp = (amount) => {
    api
      .post("/games/xp", { amount })
      .then((r) => updateUser({ xp: r.data.xp }))
      .catch(() => {});
  };

  const startHangman = () => {
    const { answer, book } = pickHangmanWord(books);
    setHangman({
      answer,
      book,
      guessed: new Set(),
      wrong: 0,
      status: "playing",
      xpEarned: null,
    });
    setHangmanRevealDismissed(false);
  };

  const guessHangmanLetter = (letter) => {
    setHangman((prev) => {
      if (!prev || prev.status !== "playing" || prev.guessed.has(letter))
        return prev;
      const guessed = new Set(prev.guessed);
      guessed.add(letter);
      const wrong = prev.answer.includes(letter) ? prev.wrong : prev.wrong + 1;
      const solved = prev.answer
        .split("")
        .every((ch) => !/[A-Z]/.test(ch) || guessed.has(ch));
      let status = prev.status;
      let xpEarned = prev.xpEarned;
      if (solved) {
        status = "won";
        xpEarned = Math.max(10, 60 - wrong * 10);
        awardXp(xpEarned);
      } else if (wrong >= HANGMAN_MAX_WRONG) {
        status = "lost";
      }
      return { ...prev, guessed, wrong, status, xpEarned };
    });
  };

  useEffect(() => {
    if (gameView !== "hangman") return;
    const handleKeydown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && hangman && hangman.status !== "playing") {
        e.preventDefault();
        startHangman();
        return;
      }
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        guessHangmanLetter(letter);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [gameView, hangman?.status]); // eslint-disable-line

  const startScramble = () => {
    const answer =
      SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
    setScramble({
      answer,
      scrambled: shuffleWord(answer),
      guess: "",
      status: "playing",
      hintRevealed: 0,
      xpEarned: null,
    });
    clearTimeout(scrambleHintTimeoutRef.current);
    setScrambleHintCooldown(false);
  };

  const reshuffleScramble = () => {
    setScramble((prev) =>
      prev ? { ...prev, scrambled: shuffleWord(prev.answer) } : prev
    );
  };

  const revealScrambleHint = () => {
    if (scrambleHintCooldown) return;
    setScramble((prev) =>
      prev && prev.status === "playing"
        ? {
            ...prev,
            hintRevealed: Math.min(
              prev.hintRevealed + 1,
              prev.answer.length - 1
            ),
          }
        : prev
    );
    setScrambleHintCooldown(true);
    clearTimeout(scrambleHintTimeoutRef.current);
    scrambleHintTimeoutRef.current = setTimeout(
      () => setScrambleHintCooldown(false),
      2000
    );
  };

  const submitScrambleGuess = (e) => {
    e.preventDefault();
    setScramble((prev) => {
      if (!prev || prev.status !== "playing") return prev;
      const correct = prev.guess.trim().toUpperCase() === prev.answer;
      let xpEarned = prev.xpEarned;
      if (correct) {
        xpEarned = Math.max(10, 50 - prev.hintRevealed * 15);
        awardXp(xpEarned);
      }
      return { ...prev, status: correct ? "won" : "wrong", xpEarned };
    });
  };

  const startWordle = () => {
    const answer =
      WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    setWordle({
      answer,
      guesses: [],
      current: "",
      status: "playing",
      error: "",
      xpEarned: null,
    });
  };

  const submitWordleGuess = (e) => {
    e.preventDefault();
    setWordle((prev) => {
      if (!prev || prev.status !== "playing" || prev.current.length !== 5)
        return prev;
      const guess = prev.current.toUpperCase();
      if (!WORDLE_VALID_WORDS.has(guess)) {
        return { ...prev, error: "Not a valid word" };
      }
      const guesses = [...prev.guesses, guess];
      let status = prev.status;
      let xpEarned = prev.xpEarned;
      if (guess === prev.answer) {
        status = "won";
        xpEarned = WORDLE_XP_BY_GUESSES[guesses.length - 1];
        awardXp(xpEarned);
      } else if (guesses.length >= 6) {
        status = "lost";
      }
      return { ...prev, guesses, current: "", status, error: "", xpEarned };
    });
  };

  const openGame = (id) => {
    setGameView(id);
    if (id === "hangman") startHangman();
    if (id === "scramble") startScramble();
    if (id === "wordle") startWordle();
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

  const startAccountEdit = () => {
    setAccountForm({
      ...EMPTY_ACCOUNT_FORM,
      username: user.username,
      email: user.email || "",
    });
    setAccountError("");
    setAccountEditing(true);
  };

  const cancelAccountEdit = () => {
    setAccountEditing(false);
    setAccountError("");
    setAccountForm(EMPTY_ACCOUNT_FORM);
  };

  const saveAccountDetails = async () => {
    setAccountError("");
    if (!accountForm.current_password) {
      setAccountError("Enter your current password to save changes");
      return;
    }
    if (
      accountForm.new_password &&
      accountForm.new_password !== accountForm.confirm_password
    ) {
      setAccountError("New passwords do not match");
      return;
    }
    setAccountSaving(true);
    try {
      const res = await api.put("/auth/profile", {
        current_password: accountForm.current_password,
        username: accountForm.username,
        email: accountForm.email,
        new_password: accountForm.new_password || undefined,
      });
      updateUser(res.data);
      setAccountEditing(false);
      setAccountForm(EMPTY_ACCOUNT_FORM);
      toast("Account details updated");
    } catch (err) {
      setAccountError(
        err.response?.data?.error || "Failed to update account details"
      );
    } finally {
      setAccountSaving(false);
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

  const openBookRequestModal = (prefillTitle = "") => {
    setBookRequestForm({ ...EMPTY_BOOK_REQUEST, title: prefillTitle });
    setBookRequestError("");
    setBookRequestSuccess(false);
    setShowBookRequestModal(true);
  };

  const submitBookRequest = async (e) => {
    e.preventDefault();
    setBookRequestError("");
    try {
      await api.post("/book-requests", bookRequestForm);
      setBookRequestSuccess(true);
      setBookRequestForm(EMPTY_BOOK_REQUEST);
      load();
      toast("Book request submitted!");
    } catch (err) {
      setBookRequestError(
        err.response?.data?.error || "Failed to submit request"
      );
    }
  };

  const dismissBookRequestNotification = async (id) => {
    setBookRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.put(`/book-requests/${id}/dismiss`);
    } catch {}
  };

  const submitTierRequest = async () => {
    if (!requestedTier) return;
    try {
      await api.post("/membership-requests", { tier: requestedTier });
      setRequestedTier(null);
      load();
      toast("Membership request submitted");
    } catch (err) {
      toast(err.response?.data?.error || "Failed to submit request", "error");
    }
  };

  const toggleWishlist = async (bookId) => {
    const inList = wishlistIds.has(bookId);
    setWishlistLoading(true);
    try {
      if (inList) {
        await api.delete(`/wishlist/${bookId}`);
        setWishlistItems((prev) => prev.filter((i) => i.book_id !== bookId));
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(bookId);
          return next;
        });
      } else {
        const { data } = await api.post(`/wishlist/${bookId}`);
        setWishlistItems((prev) => [data, ...prev]);
        setWishlistIds((prev) => new Set([...prev, bookId]));
        toast("Added to wishlist", "success", {
          label: "View",
          onClick: () => {
            closeBook();
            setOpenHomeSection("wishlist");
            handleTabChange("home");
          },
        });
      }
    } catch (err) {
      toast(err.response?.data?.error || "Wishlist update failed");
    } finally {
      setWishlistLoading(false);
    }
  };

  const activeBorrows = borrows.filter((b) => !b.return_date);
  const borrowedBookIds = new Set(activeBorrows.map((b) => b.book_id));

  const overdueBorrows = activeBorrows.filter((b) => b.is_overdue);
  const unpaidFines = fines.filter((f) => !f.fine_paid && f.fine > 0);
  const totalUnpaidFines = unpaidFines.reduce((sum, f) => sum + f.fine, 0);

  const pastBorrows = borrows
    .filter((b) => b.return_date)
    .sort((a, b) => new Date(b.return_date) - new Date(a.return_date));

  // Default tint: the cover colour of the most recently borrowed book
  const autoAccentColor = useMemo(() => {
    if (!borrows.length || !books.length) return null;
    const sorted = [...borrows].sort(
      (a, b) => new Date(b.borrow_date) - new Date(a.borrow_date)
    );
    const recent = sorted.find((b) => !b.return_date) || sorted[0];
    const book = books.find((b) => b.id === recent?.book_id);
    return book?.cover_color || null;
  }, [borrows, books]);

  // A user-picked accent colour wins over the borrowed-book default
  const accentColor = accentOverride || autoAccentColor;

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

  const filteredCommunities = useMemo(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [communities, communitySearch]);

  const hasActiveFilters =
    aiMode ||
    search ||
    selectedGenre ||
    availFilter !== "all" ||
    ratingFilter > 0;

  const hasExtraFilters = availFilter !== "all" || ratingFilter > 0;

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
      setAiError(timedOut ? null : e.response?.data?.error || null);
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
      const activeBorrow = activeBorrows.find((b) => b.book_id === book.id);
      if (activeBorrow?.return_requested_at) {
        return (
          <button className="btn btn-outline" disabled>
            Return Requested
          </button>
        );
      }
      return (
        <button
          className="btn btn-outline"
          onClick={() => {
            closeBook();
            openReturnModal(activeBorrow);
          }}
        >
          Return
        </button>
      );
    }
    if (book.available_copies > 0) {
      return (
        <button className="btn" onClick={() => borrow(book.id)}>
          Borrow
        </button>
      );
    }
    if (res) {
      if (res.status === "ready") {
        return (
          <button className="btn" onClick={() => borrow(book.id)}>
            Borrow (Ready)
          </button>
        );
      }
      return (
        <button className="btn" disabled>
          Reserved #{res.queue_position}
        </button>
      );
    }
    return (
      <button className="btn btn-outline" onClick={() => reserve(book.id)}>
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

  // Derive palette instantly from server-stored cover_color (no async canvas needed).
  // Each text tier's opacity is the max of the desired visual alpha and the minimum
  // alpha required to achieve WCAG AA (4.5:1) against this specific background.
  const coverPalette = useMemo(() => {
    const hex = selectedBook?.cover_color;
    if (!hex) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const text = wcagTextColor(r, g, b);
    const fgVal = text === "#ffffff" ? 255 : 0;
    const αMin = minAlphaForContrast(fgVal, r, g, b, 4.5);
    const isLight = fgVal === 255;
    const mk = (desired) => {
      const a = Math.max(desired, αMin).toFixed(2);
      return isLight ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    };
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      r,
      g,
      b,
      text,
      labelColor: mk(isLight ? 0.65 : 0.5),
      subtleColor: mk(isLight ? 0.78 : 0.65),
      faintColor: mk(isLight ? 0.5 : 0.38),
    };
  }, [selectedBook]); // eslint-disable-line

  // Danger-red text/border color guaranteed to hit 4.5:1 against the current hero
  // background — tries preferred red shades first, falls back to coverPalette.text
  // (pure black/white, which always clears WCAG against any background) otherwise.
  const heroErrorColor = useMemo(() => {
    if (!coverPalette) return null;
    const bgL = relLuminance(coverPalette.r, coverPalette.g, coverPalette.b);
    for (const hex of HERO_ERROR_REDS) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (contrastRatio(relLuminance(r, g, b), bgL) >= 4.5) return hex;
    }
    return coverPalette.text;
  }, [coverPalette]);

  // Star-rating gold, guaranteed 4.5:1 against the current hero background —
  // same guard as heroErrorColor, falling back to coverPalette.text otherwise.
  const heroStarColor = useMemo(() => {
    if (!coverPalette) return null;
    const bgL = relLuminance(coverPalette.r, coverPalette.g, coverPalette.b);
    const r = parseInt(HERO_STAR_GOLD.slice(1, 3), 16);
    const g = parseInt(HERO_STAR_GOLD.slice(3, 5), 16);
    const b = parseInt(HERO_STAR_GOLD.slice(5, 7), 16);
    return contrastRatio(relLuminance(r, g, b), bgL) >= 4.5
      ? HERO_STAR_GOLD
      : coverPalette.text;
  }, [coverPalette]);

  const heroIsLight = coverPalette?.text === "#ffffff";
  const heroLabelStyle = coverPalette ? { color: coverPalette.labelColor } : {};
  const heroSubtleStyle = coverPalette
    ? { color: coverPalette.subtleColor }
    : {};
  const heroFaintStyle = coverPalette ? { color: coverPalette.faintColor } : {};
  const heroRowStyle = coverPalette
    ? {
        borderBottomColor: heroIsLight
          ? "rgba(255,255,255,0.18)"
          : "rgba(0,0,0,0.1)",
      }
    : {};
  // CSS custom properties, scoped to the hero zone — .star-display/.btn-icon-ghost/
  // .btn-outline in App.css read these (with their normal theme value as fallback),
  // so every rating star and hero action button stays WCAG AA against any cover colour.
  const heroCssVars = coverPalette
    ? {
        "--hero-fg": coverPalette.text,
        "--hero-fg-soft": coverPalette.labelColor,
        "--hero-star-color": heroStarColor,
        "--hero-hover-bg": heroIsLight
          ? "rgba(255,255,255,0.18)"
          : "rgba(0,0,0,0.12)",
        "--hero-outline-bg": "transparent",
      }
    : {};

  if (loading) return <BookLoader />;

  return (
    <>
      {showQuiz && (
        <PreferenceQuiz
          username={user.username}
          onFinish={closeQuiz}
          onOpenBook={openBook}
        />
      )}
      {!showQuiz && showOnboarding && (
        <Onboarding
          role="member"
          username={user.username}
          onClose={closeOnboarding}
          onNavigate={handleTabChange}
        />
      )}
      <div
        className={`layout${navStyle === "dock" ? " layout-nav-dock" : ""}`}
        style={
          accentColor
            ? { "--accent": accentColor, "--accent-text": accentText }
            : {}
        }
      >
        <div className="dashboard-header">
          <TopBar
            title="The Anthaneum"
            username={user.username}
            avatar={user.avatar}
            tier={tier}
            xp={user.xp}
            library={user.library}
            onLogout={logout}
            onReplayTour={() => setShowOnboarding(true)}
          />
          {navStyle !== "dock" && (
            <NavTabs
              tabs={TABS}
              active={tab}
              onChange={handleTabChange}
              badges={{ community: communityBadge }}
            />
          )}
        </div>
        {navStyle === "dock" && (
          <Dock
            tabs={TABS}
            active={tab}
            onChange={handleTabChange}
            badges={{ community: communityBadge }}
          />
        )}
        <div className="content">
          {error && <div className="error">{error}</div>}

          {tab === "home" && (
            <div className="home-tab">
              {/* Hero */}
              <div className="home-hero">
                <div className="home-hero-eyebrow">{user.username}</div>
                <h2 className="home-hero-title">
                  {(() => {
                    const h = new Date().getHours();
                    if (h >= 5 && h < 12) return "Good morning";
                    if (h >= 12 && h < 17) return "Good afternoon";
                    if (h >= 17 && h < 21) return "Good evening";
                    return "Hello, night owl";
                  })()}
                </h2>
                <p className="home-hero-sub">
                  Browse the catalogue, borrow books, and connect with fellow
                  readers.
                </p>
              </div>

              {/* Overdue books / unpaid fines alert */}
              {(overdueBorrows.length > 0 || unpaidFines.length > 0) && (
                <div className="home-section">
                  <div className="overdue-alert">
                    <div className="overdue-alert-icon">
                      <AlertTriangleIcon />
                    </div>
                    <div className="overdue-alert-body">
                      <div className="overdue-alert-title">
                        {overdueBorrows.length > 0 && unpaidFines.length > 0
                          ? `You have ${overdueBorrows.length} overdue book${
                              overdueBorrows.length !== 1 ? "s" : ""
                            } and ${formatCurrency(
                              totalUnpaidFines,
                              currency
                            )} in unpaid fines`
                          : overdueBorrows.length > 0
                          ? `You have ${overdueBorrows.length} overdue book${
                              overdueBorrows.length !== 1 ? "s" : ""
                            }`
                          : `You have ${formatCurrency(
                              totalUnpaidFines,
                              currency
                            )} in unpaid fines`}
                      </div>
                      <div className="overdue-alert-desc">
                        {overdueBorrows.length > 0 &&
                          "Please return your overdue books as soon as possible. "}
                        {unpaidFines.length > 0 &&
                          "Outstanding fines must be paid to keep borrowing."}
                      </div>
                      {overdueBorrows.length > 0 && (
                        <button
                          className="overdue-alert-link"
                          onClick={goToOverdueBooks}
                        >
                          {overdueBorrows.length === 1
                            ? "Return this book →"
                            : "Return your books →"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Book request notifications */}
              {unnotifiedBookRequests.length > 0 && (
                <div className="home-section">
                  {unnotifiedBookRequests.map((r) => (
                    <div
                      key={r.id}
                      className={`book-request-banner${
                        r.status === "approved"
                          ? " book-request-banner-approved"
                          : " book-request-banner-rejected"
                      }`}
                    >
                      <div className="book-request-banner-body">
                        {r.status === "approved" ? (
                          <>
                            <strong>"{r.title}"</strong> — the book you
                            requested was approved and is now in the catalogue!
                          </>
                        ) : (
                          <>
                            Your request for <strong>"{r.title}"</strong> was
                            declined.
                            {r.admin_notes && (
                              <span className="book-request-banner-reason">
                                {" "}
                                {r.admin_notes}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="book-request-banner-actions">
                        {r.status === "approved" && r.book_id && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              openBook(r.book_id);
                              dismissBookRequestNotification(r.id);
                            }}
                          >
                            View book
                          </button>
                        )}
                        <button
                          className="book-request-banner-dismiss"
                          onClick={() => dismissBookRequestNotification(r.id)}
                          aria-label="Dismiss"
                          title="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reading Goals */}
              <div className="home-section home-card reading-goal-card">
                <div className="home-section-toggle">
                  <span className="home-card-heading">Reading Goals</span>
                </div>
                <div className="reading-goal-body">
                  {readingGoal ? (
                    <>
                      <div className="reading-goal-progress-row">
                        <div className="reading-goal-progress-text">
                          <strong>{readingProgress}</strong> /{" "}
                          {readingGoal.target} books this{" "}
                          {readingGoal.period === "weekly"
                            ? "week"
                            : readingGoal.period === "monthly"
                            ? "month"
                            : "year"}
                        </div>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setGoalEditOpen((o) => !o)}
                        >
                          {goalEditOpen ? "Cancel" : "Edit Goal"}
                        </button>
                      </div>
                      <div className="reading-goal-bar">
                        <div
                          className="reading-goal-bar-fill"
                          style={{
                            width: `${Math.min(
                              100,
                              (readingProgress / readingGoal.target) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      {readingProgress >= readingGoal.target && (
                        <div className="reading-goal-achieved">
                          Goal reached — nice work!
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="reading-goal-empty">
                      <span>You haven't set a reading goal yet.</span>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setGoalEditOpen(true)}
                      >
                        Set a Goal
                      </button>
                    </div>
                  )}
                  <div className="reading-goal-year-stat">
                    {booksReadThisYear} book
                    {booksReadThisYear !== 1 ? "s" : ""} read this year
                  </div>
                  {goalEditOpen && (
                    <div className="reading-goal-editor">
                      <Select
                        className="filter-select"
                        value={goalPeriodDraft}
                        onChange={(e) => setGoalPeriodDraft(e.target.value)}
                      >
                        <option value="weekly">Per week</option>
                        <option value="monthly">Per month</option>
                        <option value="yearly">Per year</option>
                      </Select>
                      <input
                        type="number"
                        min="1"
                        className="reading-goal-target-input"
                        value={goalTargetDraft}
                        onChange={(e) => setGoalTargetDraft(e.target.value)}
                        aria-label="Goal target (number of books)"
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={savingGoal || !goalTargetDraft}
                        onClick={saveReadingGoal}
                      >
                        {savingGoal ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* My Borrowed Books */}
              <div className="home-section home-card" ref={borrowedSectionRef}>
                <button
                  className="home-section-toggle"
                  onClick={() => toggleHomeSection("borrowed")}
                  aria-expanded={openHomeSection === "borrowed"}
                >
                  <span className="home-card-heading">My Borrowed Books</span>
                  <span
                    className={`home-section-chevron${
                      openHomeSection === "borrowed" ? " open" : ""
                    }`}
                  >
                    <ChevronDown />
                  </span>
                </button>
                {openHomeSection === "borrowed" &&
                  (activeBorrows.length === 0 ? (
                    <div className="empty">No active borrows</div>
                  ) : (
                    <div className="books-grid">
                      {activeBorrows.map((b) => {
                        const coverUrl = books.find(
                          (bk) => bk.id === b.book_id
                        )?.cover_url;
                        return (
                          <div
                            key={b.id}
                            className="rec-card"
                            onClick={() => setSelectedBookId(b.book_id)}
                            role="button"
                            tabIndex={0}
                          >
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                className="rec-card-cover"
                              />
                            ) : (
                              <NoCoverPlaceholder
                                title={b.book_title}
                                className="rec-card-cover"
                              />
                            )}
                            <div className="rec-card-title">{b.book_title}</div>
                            <div className="rec-card-author">
                              {b.book_author}
                            </div>
                            <div className="rec-card-avail">
                              <Badge
                                variant={b.is_overdue ? "overdue" : "active"}
                              >
                                {b.is_overdue ? "Overdue" : "Active"}
                              </Badge>{" "}
                              · Due {new Date(b.due_date).toLocaleDateString()}
                              {b.return_requested_at && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <Badge variant="queue">
                                    Return Requested
                                  </Badge>
                                </>
                              )}
                            </div>
                            <div
                              className="admin-card-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!b.return_requested_at && (
                                <button
                                  className="btn btn-sm btn-outline"
                                  onClick={() => openReturnModal(b)}
                                >
                                  Return
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {/* My Fines */}
              <div className="home-section home-card">
                <button
                  className="home-section-toggle"
                  onClick={() => toggleHomeSection("fines")}
                  aria-expanded={openHomeSection === "fines"}
                >
                  <span className="home-card-heading">My Fines</span>
                  <span
                    className={`home-section-chevron${
                      openHomeSection === "fines" ? " open" : ""
                    }`}
                  >
                    <ChevronDown />
                  </span>
                </button>
                {openHomeSection === "fines" &&
                  (fines.length === 0 ? (
                    <div className="empty">No fines</div>
                  ) : (
                    <div className="books-grid">
                      {fines.map((b) => {
                        const coverUrl = books.find(
                          (bk) => bk.id === b.book_id
                        )?.cover_url;
                        return (
                          <div
                            key={b.id}
                            className="rec-card"
                            onClick={() => setSelectedBookId(b.book_id)}
                            role="button"
                            tabIndex={0}
                          >
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                className="rec-card-cover"
                              />
                            ) : (
                              <NoCoverPlaceholder
                                title={b.book_title}
                                className="rec-card-cover"
                              />
                            )}
                            <div className="rec-card-title">{b.book_title}</div>
                            <div className="rec-card-author">
                              {b.book_author}
                            </div>
                            <div className="rec-card-avail">
                              <Badge
                                variant={b.fine_paid ? "returned" : "overdue"}
                              >
                                {b.fine_paid ? "Paid" : "Unpaid"}
                              </Badge>{" "}
                              · Due {new Date(b.due_date).toLocaleDateString()}
                              {" · "}
                              <span className="fine-amount">
                                {formatCurrency(b.fine, currency)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {/* Past Borrows */}
              <div className="home-section home-card">
                <button
                  className="home-section-toggle"
                  onClick={() => toggleHomeSection("history")}
                  aria-expanded={openHomeSection === "history"}
                >
                  <span className="home-card-heading">Past Borrows</span>
                  <span
                    className={`home-section-chevron${
                      openHomeSection === "history" ? " open" : ""
                    }`}
                  >
                    <ChevronDown />
                  </span>
                </button>
                {openHomeSection === "history" &&
                  (pastBorrows.length === 0 ? (
                    <div className="empty">No past borrows yet</div>
                  ) : (
                    <div className="books-grid">
                      {pastBorrows.map((b) => {
                        const coverUrl = books.find(
                          (bk) => bk.id === b.book_id
                        )?.cover_url;
                        return (
                          <div
                            key={b.id}
                            className="rec-card"
                            onClick={() => setSelectedBookId(b.book_id)}
                            role="button"
                            tabIndex={0}
                          >
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                className="rec-card-cover"
                              />
                            ) : (
                              <NoCoverPlaceholder
                                title={b.book_title}
                                className="rec-card-cover"
                              />
                            )}
                            <div className="rec-card-title">{b.book_title}</div>
                            <div className="rec-card-author">
                              {b.book_author}
                            </div>
                            <div className="rec-card-avail">
                              <Badge variant="returned">Returned</Badge> ·{" "}
                              {new Date(b.return_date).toLocaleDateString()}
                              {b.fine > 0 && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <Badge
                                    variant={
                                      b.fine_paid ? "returned" : "overdue"
                                    }
                                  >
                                    {b.fine_paid
                                      ? `Fine paid ${formatCurrency(b.fine, currency)}`
                                      : `Unpaid ${formatCurrency(b.fine, currency)}`}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {/* My Reservations */}
              <div className="home-section home-card">
                <button
                  className="home-section-toggle"
                  onClick={() => toggleHomeSection("reservations")}
                  aria-expanded={openHomeSection === "reservations"}
                >
                  <span className="home-card-heading">My Reservations</span>
                  <span
                    className={`home-section-chevron${
                      openHomeSection === "reservations" ? " open" : ""
                    }`}
                  >
                    <ChevronDown />
                  </span>
                </button>
                {openHomeSection === "reservations" &&
                  (reservations.length === 0 ? (
                    <div className="empty">No reservations</div>
                  ) : (
                    <div className="books-grid">
                      {reservations.map((r) => {
                        const coverUrl = books.find(
                          (bk) => bk.id === r.book_id
                        )?.cover_url;
                        return (
                          <div
                            key={r.id}
                            className="rec-card"
                            onClick={() => setSelectedBookId(r.book_id)}
                            role="button"
                            tabIndex={0}
                          >
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                className="rec-card-cover"
                              />
                            ) : (
                              <NoCoverPlaceholder
                                title={r.book_title}
                                className="rec-card-cover"
                              />
                            )}
                            <div className="rec-card-title">{r.book_title}</div>
                            <div className="rec-card-author">
                              {r.book_author}
                            </div>
                            <div className="rec-card-avail">
                              {r.status === "ready" ? (
                                <Badge variant="active">
                                  Ready — go borrow!
                                </Badge>
                              ) : (
                                <Badge variant="queue">
                                  Queue #{r.queue_position}
                                </Badge>
                              )}
                            </div>
                            <div
                              className="admin-card-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => cancelReservation(r.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {/* My Wishlist */}
              <div className="home-section home-card">
                <button
                  className="home-section-toggle"
                  onClick={() => toggleHomeSection("wishlist")}
                  aria-expanded={openHomeSection === "wishlist"}
                >
                  <span className="home-card-heading">My Wishlist</span>
                  <span
                    className={`home-section-chevron${
                      openHomeSection === "wishlist" ? " open" : ""
                    }`}
                  >
                    <ChevronDown />
                  </span>
                </button>
                {openHomeSection === "wishlist" &&
                  (wishlistItems.length === 0 ? (
                    <div className="empty">No books in your wishlist yet</div>
                  ) : (
                    <div className="books-grid">
                      {wishlistItems.map((item) => (
                        <div
                          key={item.id}
                          className="rec-card"
                          onClick={() => setSelectedBookId(item.book_id)}
                          role="button"
                          tabIndex={0}
                        >
                          {item.book_cover ? (
                            <img
                              src={item.book_cover}
                              alt=""
                              className="rec-card-cover"
                            />
                          ) : (
                            <NoCoverPlaceholder
                              title={item.book_title}
                              className="rec-card-cover"
                            />
                          )}
                          <div className="rec-card-title">
                            {item.book_title}
                          </div>
                          <div className="rec-card-author">
                            {item.book_author}
                          </div>
                          <div className="rec-card-avail">
                            {item.book_available ? (
                              "Available"
                            ) : (
                              <span className="muted">Unavailable</span>
                            )}
                          </div>
                          <div
                            className="admin-card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => toggleWishlist(item.book_id)}
                              disabled={wishlistLoading}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>

              {/* Book preview */}
              {books.length > 0 && (
                <div className="home-section home-card">
                  <div className="home-section-header">
                    <button
                      className="home-section-toggle"
                      onClick={() => toggleHomeSection("collection")}
                      aria-expanded={openHomeSection === "collection"}
                    >
                      <span className="home-card-heading">
                        From the collection
                      </span>
                      <span
                        className={`home-section-chevron${
                          openHomeSection === "collection" ? " open" : ""
                        }`}
                      >
                        <ChevronDown />
                      </span>
                    </button>
                    <button
                      className="home-view-all"
                      onClick={() => handleTabChange("books")}
                    >
                      View all →
                    </button>
                  </div>
                  {openHomeSection === "collection" && (
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
                                <NoCoverPlaceholder title={book.title} />
                              )}
                            </div>
                            <div className="home-book-info">
                              <div className="home-book-title">
                                {book.title}
                              </div>
                              <div className="home-book-author">
                                {book.author}
                              </div>
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
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "books" && (
            <>
              {/* Search trigger row — search bar always visible */}
              <div className="search-trigger-row" data-tour="member-search">
                {aiMode ? (
                  <input
                    className="ai-search-input search-bar-wide"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Describe what you're looking for… (press Enter)"
                    onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
                    disabled={aiLoading}
                  />
                ) : (
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by title, author, genre…"
                    className="search-bar-wide"
                  />
                )}
                {!aiMode && (
                  <button
                    className={`search-icon-btn${
                      hasExtraFilters ? " has-filters" : ""
                    }`}
                    onClick={() => setFiltersOpen((o) => !o)}
                    aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                    title="Filters"
                  >
                    {filtersOpen ? <XIcon /> : <FilterIcon />}
                    {hasExtraFilters && !filtersOpen && (
                      <span className="search-active-dot" />
                    )}
                  </button>
                )}
                <button
                  className={`ai-toggle-btn${
                    aiMode ? " ai-toggle-active" : ""
                  }`}
                  onClick={toggleAiMode}
                  title={
                    aiMode ? "Switch to keyword search" : "Switch to AI search"
                  }
                >
                  AI
                </button>
              </div>

              {books.length > 0 && (
                <div className="book-count-label">
                  {aiMode && aiResults !== null
                    ? `${aiResults.length} AI match${
                        aiResults.length !== 1 ? "es" : ""
                      }`
                    : filteredBooks.length === books.length
                    ? `${books.length} books`
                    : `${filteredBooks.length} of ${books.length} books`}
                </div>
              )}

              {/* Expandable filter panel */}
              {!aiMode && filtersOpen && (
                <div className="search-panel">
                  <div className="search-panel-filters">
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
                    {hasExtraFilters && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={clearFilters}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
              {aiMode && (aiResults !== null || aiError) && (
                <div className="search-panel search-panel-filters">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Genre pills */}
              {!aiMode && availableGenres.length > 0 && (
                <div
                  className="genre-strip"
                  style={{ marginTop: 20 }}
                  data-tour="member-genres"
                >
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
              {aiMode &&
                !aiLoading &&
                aiResults !== null &&
                aiResults.length === 0 && (
                  <div className="empty search-no-results">
                    No results found for this search.{" "}
                    <button
                      className="btn-link"
                      onClick={() => openBookRequestModal(aiQuery)}
                    >
                      Request that we add it
                    </button>
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
                          {b.cover_url ? (
                            <img
                              src={b.cover_url}
                              alt=""
                              className="rec-card-cover"
                            />
                          ) : (
                            <NoCoverPlaceholder
                              title={b.title}
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
                  <button
                    className="btn-link"
                    onClick={() => openBookRequestModal(search)}
                  >
                    Request that we add it
                  </button>
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
                        {b.cover_url ? (
                          <img
                            src={b.cover_url}
                            alt=""
                            className="rec-card-cover"
                          />
                        ) : (
                          <NoCoverPlaceholder
                            title={b.title}
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
                                {book.cover_url ? (
                                  <img
                                    src={book.cover_url}
                                    alt=""
                                    className="rec-card-cover"
                                  />
                                ) : (
                                  <NoCoverPlaceholder
                                    title={book.title}
                                    className="rec-card-cover"
                                  />
                                )}
                                <div className="rec-card-reason">
                                  {n} borrow{n !== 1 ? "s" : ""} this week
                                </div>
                                <div className="rec-card-title">
                                  {book.title}
                                </div>
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
                                {book.cover_url ? (
                                  <img
                                    src={book.cover_url}
                                    alt=""
                                    className="rec-card-cover"
                                  />
                                ) : (
                                  <NoCoverPlaceholder
                                    title={book.title}
                                    className="rec-card-cover"
                                  />
                                )}
                                <div className="rec-card-reason">
                                  {book.reason}
                                </div>
                                <div className="rec-card-title">
                                  {book.title}
                                </div>
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
                                {book.cover_url ? (
                                  <img
                                    src={book.cover_url}
                                    alt=""
                                    className="rec-card-cover"
                                  />
                                ) : (
                                  <NoCoverPlaceholder
                                    title={book.title}
                                    className="rec-card-cover"
                                  />
                                )}
                                <div className="rec-card-reason">
                                  {book.reason}
                                </div>
                                <div className="rec-card-title">
                                  {book.title}
                                </div>
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
                              {book.cover_url ? (
                                <img
                                  src={book.cover_url}
                                  alt=""
                                  className="rec-card-cover"
                                />
                              ) : (
                                <NoCoverPlaceholder
                                  title={book.title}
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
                              <div className="rec-card-author">
                                {book.author}
                              </div>
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
                  <div className="profile-avatar-hint">
                    Click to change photo
                  </div>
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
                <div className="membership-card" data-tour="member-membership">
                  <div className="membership-card-tier">
                    <MembershipBadge tier={membershipInfo.membership?.tier} />
                    {!membershipInfo.membership && (
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        {pendingMembershipRequest
                          ? "No membership yet"
                          : "No membership — pick a tier below to request one"}
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
                            {formatCurrency(
                              membershipInfo.membership.tier === "silver"
                                ? membershipInfo.pricing.silver_rate
                                : membershipInfo.membership.tier === "gold"
                                ? membershipInfo.pricing.gold_rate
                                : membershipInfo.pricing.family_rate,
                              currency
                            )}
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

              {pendingMembershipRequest ? (
                <div className="membership-card" style={{ marginTop: -16 }}>
                  <div className="membership-card-tier">
                    <MembershipBadge
                      tier={pendingMembershipRequest.requested_tier}
                    />
                  </div>
                  <div className="membership-card-stats">
                    <div className="membership-stat">
                      <span className="membership-stat-label">Status</span>
                      <span className="membership-stat-value">
                        Requested — awaiting admin approval
                      </span>
                    </div>
                    <div className="membership-stat">
                      <span className="membership-stat-label">Submitted</span>
                      <span className="membership-stat-value">
                        {new Date(
                          pendingMembershipRequest.submitted_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                membershipInfo && (
                  <div style={{ marginTop: -16, marginBottom: 28 }}>
                    {lastReviewedMembershipRequest?.status === "rejected" && (
                      <p
                        className="field-hint"
                        style={{ marginTop: 0, marginBottom: 10 }}
                      >
                        Your last request (
                        {
                          TIER_LABELS[
                            lastReviewedMembershipRequest.requested_tier
                          ]
                        }
                        ) was declined
                        {lastReviewedMembershipRequest.admin_notes
                          ? `: "${lastReviewedMembershipRequest.admin_notes}"`
                          : "."}{" "}
                        You can submit a new request below.
                      </p>
                    )}
                    <Select
                      value={requestedTier || ""}
                      onChange={(e) => setRequestedTier(e.target.value || null)}
                    >
                      <option value="">Switch Membership Tier</option>
                      {TIER_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {membershipInfo.pricing
                            ? ` — ${formatCurrency(
                                membershipInfo.pricing[t.priceKey],
                                currency
                              )}/mo`
                            : ""}
                        </option>
                      ))}
                    </Select>
                    {requestedTier && (
                      <>
                        <p className="field-hint">
                          {
                            TIER_OPTIONS.find((t) => t.id === requestedTier)
                              ?.desc
                          }
                        </p>
                        <button
                          className="btn btn-sm"
                          style={{ marginTop: 10 }}
                          onClick={submitTierRequest}
                        >
                          {membershipInfo.membership
                            ? "Request Update"
                            : "Request Membership"}
                        </button>
                      </>
                    )}
                  </div>
                )
              )}

              {/* Account details */}
              <div className="section-header" style={{ marginTop: 32 }}>
                <h3>Account Details</h3>
                {!accountEditing && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={startAccountEdit}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 32 }}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={
                      accountEditing ? accountForm.username : user.username
                    }
                    disabled={!accountEditing}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        username: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={
                      accountEditing ? accountForm.email : user.email || ""
                    }
                    disabled={!accountEditing}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder={
                      accountEditing
                        ? "Leave blank to keep current password"
                        : "••••••••"
                    }
                    value={accountEditing ? accountForm.new_password : ""}
                    disabled={!accountEditing}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        new_password: e.target.value,
                      })
                    }
                  />
                </div>
                {accountEditing && (
                  <>
                    <div className="form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={accountForm.confirm_password}
                        onChange={(e) =>
                          setAccountForm({
                            ...accountForm,
                            confirm_password: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Current Password (required to save changes)</label>
                      <input
                        type="password"
                        value={accountForm.current_password}
                        onChange={(e) =>
                          setAccountForm({
                            ...accountForm,
                            current_password: e.target.value,
                          })
                        }
                        autoFocus
                      />
                    </div>
                    {accountError && (
                      <div className="error">{accountError}</div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        className="btn btn-sm"
                        onClick={saveAccountDetails}
                        disabled={accountSaving}
                      >
                        {accountSaving ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={cancelAccountEdit}
                        disabled={accountSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Preferences */}
              <div className="section-header" style={{ marginTop: 32 }}>
                <h3>Preferences</h3>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "var(--text-3)",
                    marginBottom: 10,
                  }}
                >
                  Navigation style
                </div>
                <div className="nav-style-picker">
                  <button
                    type="button"
                    className={`nav-style-option${
                      navStyle !== "dock" ? " active" : ""
                    }`}
                    onClick={() => setNavStyle("tabs")}
                  >
                    <div className="nav-style-preview">
                      <div className="nav-style-preview-tabs">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div className="nav-style-option-name">Tab Bar</div>
                    <div className="nav-style-option-desc">
                      Tabs below the header, as it is now
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`nav-style-option${
                      navStyle === "dock" ? " active" : ""
                    }`}
                    onClick={() => setNavStyle("dock")}
                  >
                    <div className="nav-style-preview">
                      <div className="nav-style-preview-dock">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div className="nav-style-option-name">Dock</div>
                    <div className="nav-style-option-desc">
                      A floating Mac-style icon dock
                    </div>
                  </button>
                </div>
              </div>

              <div className="pref-columns" style={{ marginBottom: 32 }}>
                <div className="pref-column">
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-3)",
                      marginBottom: 10,
                    }}
                  >
                    Appearance
                  </div>
                  <div className="pd-options-row pref-options-row">
                    {APPEARANCE_OPTIONS.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className={`pd-option${
                          appearance === key ? " pd-option-active" : ""
                        }`}
                        onClick={() => setAppearance(key)}
                        title={label}
                      >
                        <Icon />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pref-column">
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-3)",
                      marginBottom: 10,
                    }}
                  >
                    Reader theme
                  </div>
                  <div className="pd-options-row pref-options-row">
                    {READER_THEME_OPTIONS.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className={`pd-option${
                          readerTheme === key ? " pd-option-active" : ""
                        }`}
                        onClick={() =>
                          setReaderTheme(readerTheme === key ? "" : key)
                        }
                        title={label}
                      >
                        <Icon />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "var(--text-3)",
                    marginBottom: 10,
                  }}
                >
                  Accent color
                </div>
                <div className="accent-swatch-row">
                  <button
                    type="button"
                    className={`accent-swatch accent-swatch-auto${
                      !accentOverride ? " accent-swatch-selected" : ""
                    }`}
                    onClick={() => setAccentOverride("")}
                    title={
                      autoAccentColor
                        ? "Default — matches your borrowed book's cover"
                        : "Default — matches your borrowed book's cover (borrow a book to see it)"
                    }
                    style={
                      autoAccentColor
                        ? {
                            background: autoAccentColor,
                            color: contrastTextFor(autoAccentColor),
                          }
                        : undefined
                    }
                  >
                    {!accentOverride ? <CheckIcon /> : <ReaderBookIcon />}
                  </button>
                  {ACCENT_PRESETS.map(({ key, label, color, text }) => (
                    <button
                      key={key}
                      type="button"
                      className={`accent-swatch${
                        accentOverride === color
                          ? " accent-swatch-selected"
                          : ""
                      }${color === "#ffffff" ? " accent-swatch-outlined" : ""}`}
                      style={{ background: color, color: text }}
                      onClick={() => setAccentOverride(color)}
                      title={label}
                    >
                      {accentOverride === color && <CheckIcon />}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`accent-swatch accent-swatch-custom${
                      accentOverride && !isPresetAccent
                        ? " accent-swatch-selected"
                        : ""
                    }`}
                    style={
                      accentOverride && !isPresetAccent
                        ? {
                            background: accentOverride,
                            color: contrastTextFor(accentOverride),
                          }
                        : undefined
                    }
                    onClick={() => accentColorInputRef.current?.click()}
                    title="Pick a custom color"
                  >
                    {accentOverride && !isPresetAccent ? (
                      <CheckIcon />
                    ) : (
                      <PaletteIcon />
                    )}
                  </button>
                  <input
                    ref={accentColorInputRef}
                    type="color"
                    value={
                      accentOverride && !isPresetAccent
                        ? accentOverride
                        : "#000000"
                    }
                    onChange={(e) => setAccentOverride(e.target.value)}
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      opacity: 0,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Donate Tab ── */}
          {tab === "donate" && (
            <>
              <div className="section-header" data-tour="member-donations">
                <h3>Donate a Book</h3>
                <button className="btn btn-sm" onClick={openDonateModal}>
                  Donate
                </button>
              </div>
              <p
                style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}
              >
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
                              {formatCurrency(totalCredit, currency)}
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
                          <td>{formatCurrency(d.estimated_price, currency)}</td>
                          <td>
                            {d.status === "approved" ? (
                              <span
                                style={{ color: "#2e7d32", fontWeight: 600 }}
                              >
                                {formatCurrency(d.credit_amount || 0, currency)}
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
                          <td>
                            {new Date(d.submitted_at).toLocaleDateString()}
                          </td>
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
              ) : communityView === "list" ? (
                <>
                  <div className="section-header">
                    <h3>Communities</h3>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setCommunityForm({
                          id: null,
                          name: "",
                          description: "",
                          icon_url: "",
                          banner_url: "",
                        });
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
                          onClick={
                            c.is_member ? () => openCommunity(c) : undefined
                          }
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
                                <div className="empty">Loading comments…</div>
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
            </>
          )}

          {/* ── Games Tab (Gold perk) ── */}
          {tab === "games" && (
            <>
              {!isGold ? (
                <div className="community-locked">
                  <div className="community-locked-icon">
                    <LockIcon />
                  </div>
                  <h3>Gold Members Only</h3>
                  <p>Book Games are exclusively for Gold members.</p>
                  <p>
                    Upgrade your membership to Gold to unlock three classic word
                    games with a literary twist.
                  </p>
                </div>
              ) : gameView === "menu" ? (
                <>
                  <div className="section-header">
                    <h3>Gold Games</h3>
                    <div className="games-xp-total">{user.xp || 0} XP</div>
                  </div>
                  <div className="games-grid">
                    {GAMES_LIST.map((g) => (
                      <div
                        key={g.id}
                        className="game-card"
                        onClick={() => openGame(g.id)}
                      >
                        <div className="game-card-icon">
                          <g.Icon />
                        </div>
                        <div className="game-card-name">{g.name}</div>
                        <div className="game-card-tagline">{g.tagline}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="game-panel-header">
                    <button
                      className="back-nav-link"
                      onClick={() => setGameView("menu")}
                    >
                      <ChevronLeft /> Back to Games
                    </button>
                    <h3>{GAMES_LIST.find((g) => g.id === gameView)?.name}</h3>
                  </div>

                  <div className="game-panel">
                    {gameView === "hangman" && hangman && (
                      <div className="hangman-game">
                        <HangmanFigure wrong={hangman.wrong} />
                        <div className="hangman-word">
                          {hangman.answer.split("").map((ch, i) => (
                            <span key={i} className="hangman-letter">
                              {/[A-Z]/.test(ch)
                                ? hangman.guessed.has(ch) ||
                                  hangman.status !== "playing"
                                  ? ch
                                  : "_"
                                : ch === " "
                                ? "  "
                                : ch}
                            </span>
                          ))}
                        </div>
                        {hangman.status === "won" && (
                          <div className="game-result game-result-won">
                            You got it! +{hangman.xpEarned} XP
                          </div>
                        )}
                        {hangman.status === "lost" && (
                          <div className="game-result game-result-lost">
                            Out of guesses — it was "{hangman.answer}"
                          </div>
                        )}
                        {hangman.status !== "playing" &&
                          hangman.book &&
                          !hangmanRevealDismissed && (
                            <div className="hangman-reveal-card">
                              <button
                                type="button"
                                className="hangman-reveal-close"
                                aria-label="Cancel"
                                onClick={() => setHangmanRevealDismissed(true)}
                              >
                                &times;
                              </button>
                              <div className="hangman-reveal-cover-wrap">
                                {hangman.book.cover_url ? (
                                  <img
                                    src={hangman.book.cover_url}
                                    alt=""
                                    className="hangman-reveal-cover"
                                  />
                                ) : (
                                  <NoCoverPlaceholder
                                    title={hangman.book.title}
                                  />
                                )}
                              </div>
                              <div className="hangman-reveal-book-title">
                                {hangman.book.title}
                              </div>
                              <div className="hangman-reveal-book-author">
                                {hangman.book.author}
                              </div>
                              <div className="hangman-reveal-actions">
                                <button
                                  className="btn btn-sm"
                                  onClick={() => openBook(hangman.book.id)}
                                >
                                  Explore
                                </button>
                                <button
                                  className="btn btn-sm"
                                  onClick={startHangman}
                                >
                                  Play Again
                                </button>
                              </div>
                            </div>
                          )}
                        <div className="game-wrong-count">
                          Wrong guesses: {hangman.wrong} / {HANGMAN_MAX_WRONG}
                          {hangman.status === "playing" &&
                            " · type a letter to guess"}
                        </div>
                        <div className="hangman-keyboard">
                          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                            .split("")
                            .map((letter) => {
                              const used = hangman.guessed.has(letter);
                              const correct =
                                used && hangman.answer.includes(letter);
                              return (
                                <button
                                  key={letter}
                                  className={`hangman-key ${
                                    used
                                      ? correct
                                        ? "hangman-key-correct"
                                        : "hangman-key-wrong"
                                      : ""
                                  }`}
                                  disabled={
                                    used || hangman.status !== "playing"
                                  }
                                  onClick={() => guessHangmanLetter(letter)}
                                >
                                  {letter}
                                </button>
                              );
                            })}
                        </div>
                        {hangman.status !== "playing" && (
                          <button className="btn btn-sm" onClick={startHangman}>
                            Play Again
                          </button>
                        )}
                      </div>
                    )}

                    {gameView === "scramble" && scramble && (
                      <div className="scramble-game">
                        <div className="scramble-letters">
                          {scramble.scrambled.split("").map((ch, i) => (
                            <span key={i} className="scramble-tile">
                              {ch}
                            </span>
                          ))}
                        </div>
                        <div className="scramble-clue">
                          {scramble.answer.length} letters · library & literary
                          vocabulary
                        </div>
                        {scramble.hintRevealed > 0 && (
                          <div className="scramble-hint-word">
                            {scramble.answer.split("").map((ch, i) => (
                              <span key={i} className="scramble-hint-letter">
                                {i < scramble.hintRevealed ? ch : "_"}
                              </span>
                            ))}
                          </div>
                        )}
                        <form
                          className="scramble-form"
                          onSubmit={submitScrambleGuess}
                        >
                          <input
                            type="text"
                            className="scramble-input"
                            value={scramble.guess}
                            onChange={(e) =>
                              setScramble((prev) => ({
                                ...prev,
                                guess: e.target.value,
                              }))
                            }
                            disabled={scramble.status === "won"}
                            placeholder="Your guess…"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="btn btn-sm"
                            disabled={
                              scramble.status === "won" ||
                              !scramble.guess.trim()
                            }
                          >
                            Submit
                          </button>
                        </form>
                        {scramble.status === "wrong" && (
                          <div className="game-result game-result-lost">
                            Not quite — try again!
                          </div>
                        )}
                        {scramble.status === "won" && (
                          <div className="game-result game-result-won">
                            Correct! It was "{scramble.answer}" · +
                            {scramble.xpEarned} XP
                          </div>
                        )}
                        <div className="scramble-actions">
                          {scramble.status !== "won" && (
                            <>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={reshuffleScramble}
                              >
                                Reshuffle
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={revealScrambleHint}
                                disabled={scrambleHintCooldown}
                              >
                                Hint
                              </button>
                            </>
                          )}
                          {scramble.status === "won" && (
                            <button
                              className="btn btn-sm"
                              onClick={startScramble}
                            >
                              Next Word
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {gameView === "wordle" && wordle && (
                      <div className="wordle-game">
                        <div className="wordle-grid">
                          {Array.from({ length: 6 }).map((_, row) => {
                            const guess = wordle.guesses[row];
                            const isCurrentRow =
                              row === wordle.guesses.length &&
                              wordle.status === "playing";
                            const rowLetters = guess
                              ? guess.split("")
                              : isCurrentRow
                              ? wordle.current.padEnd(5, " ").split("")
                              : ["", "", "", "", ""];
                            const feedback = guess
                              ? wordleFeedback(guess, wordle.answer)
                              : null;
                            return (
                              <div key={row} className="wordle-row">
                                {rowLetters.map((ch, i) => (
                                  <span
                                    key={i}
                                    className={`wordle-tile ${
                                      feedback
                                        ? `wordle-tile-${feedback[i]}`
                                        : ch.trim()
                                        ? "wordle-tile-filled"
                                        : ""
                                    }`}
                                  >
                                    {ch.trim()}
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                        {wordle.status === "playing" ? (
                          <>
                            <form
                              className="wordle-form"
                              onSubmit={submitWordleGuess}
                            >
                              <input
                                type="text"
                                className="wordle-input"
                                value={wordle.current}
                                maxLength={5}
                                onChange={(e) =>
                                  setWordle((prev) => ({
                                    ...prev,
                                    current: e.target.value
                                      .replace(/[^a-zA-Z]/g, "")
                                      .toUpperCase(),
                                    error: "",
                                  }))
                                }
                                placeholder="5-letter word"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="btn btn-sm"
                                disabled={wordle.current.length !== 5}
                              >
                                Guess
                              </button>
                            </form>
                            {wordle.error && (
                              <div className="game-result game-result-lost">
                                {wordle.error}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {wordle.status === "won" && (
                              <div className="game-result game-result-won">
                                Solved in {wordle.guesses.length}/6! +
                                {wordle.xpEarned} XP
                              </div>
                            )}
                            {wordle.status === "lost" && (
                              <div className="game-result game-result-lost">
                                Out of guesses — it was "{wordle.answer}"
                              </div>
                            )}
                            <button
                              className="btn btn-sm"
                              onClick={startWordle}
                            >
                              Play Again
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Book detail modal */}
        {selectedBook && (
          <Modal
            title={selectedBook.title}
            onClose={closeBook}
            wide
            heroBg={coverPalette?.bg ?? "var(--bg-raised)"}
            heroTextColor={coverPalette?.text ?? "var(--text)"}
            heroContent={
              <>
                <div className="book-detail-header" style={heroCssVars}>
                  {selectedBook.cover_url && (
                    <img
                      src={selectedBook.cover_url}
                      alt={`Cover of ${selectedBook.title}`}
                      className="book-cover-img"
                    />
                  )}
                  <div className="book-detail book-detail-meta">
                    <div className="book-detail-row" style={heroRowStyle}>
                      <span
                        className="book-detail-label"
                        style={heroLabelStyle}
                      >
                        Author
                      </span>
                      <span>{selectedBook.author}</span>
                    </div>
                    <div className="book-detail-row" style={heroRowStyle}>
                      <span
                        className="book-detail-label"
                        style={heroLabelStyle}
                      >
                        Genre
                      </span>
                      <span>
                        {selectedBook.genre || (
                          <span style={heroFaintStyle}>—</span>
                        )}
                      </span>
                    </div>
                    <div className="book-detail-row" style={heroRowStyle}>
                      <span
                        className="book-detail-label"
                        style={heroLabelStyle}
                      >
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
                      <span
                        className="book-detail-label"
                        style={heroLabelStyle}
                      >
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
                              style={{
                                fontSize: "0.85rem",
                                ...heroSubtleStyle,
                              }}
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
                    <div className="book-detail-action">
                      <BookActionButton book={selectedBook} />
                      {!borrowedBookIds.has(selectedBook.id) && (
                        <button
                          className={`btn${
                            wishlistIds.has(selectedBook.id)
                              ? ""
                              : " btn-outline"
                          }`}
                          onClick={() => toggleWishlist(selectedBook.id)}
                          disabled={wishlistLoading}
                          title={
                            wishlistIds.has(selectedBook.id)
                              ? "Remove from wishlist"
                              : "Add to wishlist"
                          }
                        >
                          {wishlistIds.has(selectedBook.id)
                            ? "♥ Wishlisted"
                            : "♡ Wishlist"}
                        </button>
                      )}
                    </div>
                    {actionError && (
                      <div
                        className="error"
                        style={
                          heroErrorColor
                            ? {
                                marginTop: 12,
                                color: heroErrorColor,
                                borderColor: heroErrorColor,
                                background: "transparent",
                              }
                            : { marginTop: 12 }
                        }
                      >
                        {actionError}
                      </div>
                    )}
                  </div>
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
          <Modal
            title="Donate a Book"
            onClose={() => setShowDonateModal(false)}
          >
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
                      setDonationForm({
                        ...donationForm,
                        title: e.target.value,
                      })
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
                      setDonationForm({
                        ...donationForm,
                        author: e.target.value,
                      })
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
                      setDonationForm({
                        ...donationForm,
                        genre: e.target.value,
                      })
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
                  <label>Estimated Value ({getCurrencySymbol(currency)}) *</label>
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
                        {formatCurrency(
                          Number(donationForm.estimated_price) / 4,
                          currency
                        )}
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

        {/* Request a Book Modal */}
        {showBookRequestModal && (
          <Modal
            title="Request a Book"
            onClose={() => setShowBookRequestModal(false)}
          >
            {bookRequestSuccess ? (
              <>
                <p style={{ color: "#2e7d32", marginBottom: 20 }}>
                  Your request has been submitted! The admin will review it —
                  you'll see the outcome on your Home tab once it's reviewed.
                </p>
                <div className="modal-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setShowBookRequestModal(false);
                      setBookRequestSuccess(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submitBookRequest}>
                {bookRequestError && (
                  <div className="error">{bookRequestError}</div>
                )}
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    value={bookRequestForm.title}
                    onChange={(e) =>
                      setBookRequestForm({
                        ...bookRequestForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="Book title"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Author{" "}
                    <span
                      className="muted"
                      style={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      (optional)
                    </span>
                  </label>
                  <input
                    value={bookRequestForm.author}
                    onChange={(e) =>
                      setBookRequestForm({
                        ...bookRequestForm,
                        author: e.target.value,
                      })
                    }
                    placeholder="Author name"
                  />
                </div>
                <div className="form-group">
                  <label>
                    ISBN{" "}
                    <span
                      className="muted"
                      style={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      (optional)
                    </span>
                  </label>
                  <input
                    value={bookRequestForm.isbn}
                    onChange={(e) =>
                      setBookRequestForm({
                        ...bookRequestForm,
                        isbn: e.target.value,
                      })
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
                    value={bookRequestForm.genre}
                    onChange={(e) =>
                      setBookRequestForm({
                        ...bookRequestForm,
                        genre: e.target.value,
                      })
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
                  <label>
                    Notes{" "}
                    <span
                      className="muted"
                      style={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      (optional — anything that helps us find it)
                    </span>
                  </label>
                  <textarea
                    value={bookRequestForm.notes}
                    onChange={(e) =>
                      setBookRequestForm({
                        ...bookRequestForm,
                        notes: e.target.value,
                      })
                    }
                    placeholder="e.g. edition, why you'd like it added…"
                    rows={3}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowBookRequestModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm">
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}

        {/* Create / Edit Community Modal */}
        {showCreateCommunity && (
          <Modal
            title={communityForm.id ? "Edit Community" : "Create a Community"}
            onClose={() => setShowCreateCommunity(false)}
          >
            {!communityForm.id && (
              <p
                style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}
              >
                Communities require admin approval before members can join.
                You'll be notified once reviewed.
              </p>
            )}
            <form onSubmit={submitCommunityForm}>
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
                  onChange={handleCommunityBannerChange}
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
                  onChange={handleCommunityIconChange}
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
                  onClick={() => setShowCreateCommunity(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  {communityForm.id ? "Save Changes" : "Submit for Approval"}
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

            <div className="anonymous-row" style={{ marginBottom: 20 }}>
              <input
                type="checkbox"
                id="mark-complete-check"
                checked={markComplete}
                onChange={(e) => setMarkComplete(e.target.checked)}
              />
              <label htmlFor="mark-complete-check">
                Mark as complete — count this toward my reading goals
              </label>
            </div>

            {returnHasUnpaidFine && (
              <div className="return-fine-notice">
                <div className="return-fine-amount">
                  Fine due: <strong>{formatCurrency(returnModal.fine, currency)}</strong>
                </div>
                <div className="anonymous-row">
                  <input
                    type="checkbox"
                    id="pay-fine-check"
                    checked={payFineWithReturn}
                    onChange={(e) => setPayFineWithReturn(e.target.checked)}
                  />
                  <label htmlFor="pay-fine-check">
                    I'm paying this fine now — submit for admin verification
                  </label>
                </div>
                {!payFineWithReturn && (
                  <p className="return-fine-hint">
                    This book has an unpaid fine. Check the box above to submit
                    your fine payment along with the return for the library to
                    verify.
                  </p>
                )}
              </div>
            )}

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
              <button
                className="btn btn-sm"
                onClick={handleReturn}
                disabled={returnHasUnpaidFine && !payFineWithReturn}
              >
                {returnHasUnpaidFine
                  ? "Submit Return & Fine Payment"
                  : reviewRating > 0
                  ? "Submit & Return"
                  : "Return"}
              </button>
            </div>
          </Modal>
        )}
        <Toast toasts={toasts} />
      </div>
    </>
  );
}

export default MemberDashboard;
