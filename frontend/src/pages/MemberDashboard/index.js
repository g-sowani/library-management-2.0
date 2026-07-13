import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import TopBar from "../../components/TopBar";
import NavTabs from "../../components/NavTabs";
import Dock from "../../components/Dock";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import SearchBar from "../../components/SearchBar";
import Select from "../../components/Select";
import Toast from "../../components/Toast";
import Onboarding from "../../components/Onboarding";
import PreferenceQuiz from "../../components/PreferenceQuiz";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../context/ThemeContext";
import { GENRES } from "../../constants";
import {
  wcagTextColor,
  minAlphaForContrast,
  relLuminance,
  contrastRatio,
  contrastTextFor,
} from "../../utils/colorContrast";
import { resizeImageToBase64 } from "../../utils/resizeImageToBase64";
import NoCoverPlaceholder from "../../components/NoCoverPlaceholder";
import FilterIcon from "../../components/icons/FilterIcon";
import XIcon from "../../components/icons/XIcon";
import ChevronLeft from "../../components/icons/ChevronLeft";
import ChevronDown from "../../components/icons/ChevronDown";
import AlertTriangleIcon from "../../components/icons/AlertTriangleIcon";
import CheckIcon from "../../components/icons/CheckIcon";
import PaletteIcon from "../../components/icons/PaletteIcon";
import LockIcon from "../../components/icons/LockIcon";
import BookLoader from "../../components/BookLoader";
import BookStrip from "../../components/BookStrip";
import StarPicker from "../../components/StarPicker";
import StarDisplay from "../../components/StarDisplay";
import MembershipBadge from "../../components/MembershipBadge";
import CommentItem from "../../components/community/CommentItem";
import { patchReaction } from "../../components/community/patchReaction";
import { TIER_LABELS, TIER_OPTIONS } from "../../constants/membership";
import {
  APPEARANCE_OPTIONS,
  READER_THEME_OPTIONS,
  ACCENT_PRESETS,
  ReaderBookIcon,
} from "../../constants/appearance";
import GamesTab from "./tabs/games/GamesTab";
import DonateTab from "./tabs/DonateTab";
import ProfileTab from "./tabs/ProfileTab";
import CommunityTab from "./tabs/community/CommunityTab";
import BooksTab from "./tabs/books/BooksTab";
import HomeTab from "./tabs/HomeTab";
import BookDetailModal from "./modals/BookDetailModal";
import DonateModal from "./modals/DonateModal";
import BookRequestModal from "./modals/BookRequestModal";
import ReturnModal from "./modals/ReturnModal";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [collabRecs, setCollabRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [membershipInfo, setMembershipInfo] = useState(null);
  const [membershipRequests, setMembershipRequests] = useState([]);
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

  const borrowedSectionRef = useRef(null);

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
  const [communityBadge, setCommunityBadge] = useState(0);

  const tier = membershipInfo?.membership?.tier || null;
  const isGold = tier === "gold";

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

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "community") {
      localStorage.setItem("communityLastSeen", new Date().toISOString());
      setCommunityBadge(0);
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
            <HomeTab
              user={user}
              overdueBorrows={overdueBorrows}
              unpaidFines={unpaidFines}
              totalUnpaidFines={totalUnpaidFines}
              onGoToOverdueBooks={goToOverdueBooks}
              unnotifiedBookRequests={unnotifiedBookRequests}
              onOpenBook={openBook}
              onDismissBookRequest={dismissBookRequestNotification}
              openHomeSection={openHomeSection}
              toggleHomeSection={toggleHomeSection}
              borrowedSectionRef={borrowedSectionRef}
              activeBorrows={activeBorrows}
              books={books}
              onSelectBook={setSelectedBookId}
              onOpenReturnModal={openReturnModal}
              fines={fines}
              pastBorrows={pastBorrows}
              reservations={reservations}
              onCancelReservation={cancelReservation}
              wishlistItems={wishlistItems}
              wishlistLoading={wishlistLoading}
              onToggleWishlist={toggleWishlist}
              onViewAllBooks={() => handleTabChange("books")}
              toast={toast}
            />
          )}

          {tab === "books" && (
            <BooksTab
              books={books}
              trending={trending}
              recommendations={recommendations}
              collabRecs={collabRecs}
              onOpenBook={openBook}
              onOpenBookRequestModal={openBookRequestModal}
            />
          )}

          {tab === "profile" && (
            <ProfileTab
              user={user}
              updateUser={updateUser}
              toast={toast}
              load={load}
              membershipInfo={membershipInfo}
              membershipRequests={membershipRequests}
              navStyle={navStyle}
              setNavStyle={setNavStyle}
              appearance={appearance}
              setAppearance={setAppearance}
              readerTheme={readerTheme}
              setReaderTheme={setReaderTheme}
              accentOverride={accentOverride}
              setAccentOverride={setAccentOverride}
              autoAccentColor={autoAccentColor}
            />
          )}

          {/* ── Donate Tab ── */}
          {tab === "donate" && (
            <DonateTab donations={donations} onOpenDonateModal={openDonateModal} />
          )}

          {/* ── Community Tab ── */}
          {tab === "community" && (
            <CommunityTab isGold={isGold} user={user} toast={toast} />
          )}

          {/* ── Games Tab (Gold perk) ── */}
          {tab === "games" && (
            <GamesTab
              isGold={isGold}
              user={user}
              books={books}
              updateUser={updateUser}
              onOpenBook={openBook}
            />
          )}
        </div>

        {selectedBook && (
          <BookDetailModal
            book={selectedBook}
            onClose={closeBook}
            coverPalette={coverPalette}
            heroCssVars={heroCssVars}
            heroRowStyle={heroRowStyle}
            heroLabelStyle={heroLabelStyle}
            heroSubtleStyle={heroSubtleStyle}
            heroFaintStyle={heroFaintStyle}
            heroErrorColor={heroErrorColor}
            bookReviews={bookReviews}
            actionError={actionError}
            borrowedBookIds={borrowedBookIds}
            wishlistIds={wishlistIds}
            wishlistLoading={wishlistLoading}
            onToggleWishlist={toggleWishlist}
            reservedBooks={reservedBooks}
            activeBorrows={activeBorrows}
            onOpenReturnModal={openReturnModal}
            onBorrow={borrow}
            onReserve={reserve}
          />
        )}
        {showDonateModal && (
          <DonateModal
            donationForm={donationForm}
            setDonationForm={setDonationForm}
            donationError={donationError}
            donationSuccess={donationSuccess}
            setDonationSuccess={setDonationSuccess}
            onClose={() => setShowDonateModal(false)}
            onSubmit={submitDonation}
          />
        )}
        {showBookRequestModal && (
          <BookRequestModal
            bookRequestForm={bookRequestForm}
            setBookRequestForm={setBookRequestForm}
            bookRequestError={bookRequestError}
            bookRequestSuccess={bookRequestSuccess}
            setBookRequestSuccess={setBookRequestSuccess}
            onClose={() => setShowBookRequestModal(false)}
            onSubmit={submitBookRequest}
          />
        )}
        {returnModal && (
          <ReturnModal
            returnModal={returnModal}
            onClose={closeReturnModal}
            markComplete={markComplete}
            setMarkComplete={setMarkComplete}
            returnHasUnpaidFine={returnHasUnpaidFine}
            payFineWithReturn={payFineWithReturn}
            setPayFineWithReturn={setPayFineWithReturn}
            reviewRating={reviewRating}
            setReviewRating={setReviewRating}
            reviewHover={reviewHover}
            setReviewHover={setReviewHover}
            reviewText={reviewText}
            setReviewText={setReviewText}
            reviewAnonymous={reviewAnonymous}
            setReviewAnonymous={setReviewAnonymous}
            onSubmit={handleReturn}
          />
        )}
        <Toast toasts={toasts} />
      </div>
    </>
  );
}

export default MemberDashboard;
