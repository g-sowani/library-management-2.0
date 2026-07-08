import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/TopBar";
import NavTabs from "../components/NavTabs";
import Dock from "../components/Dock";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import ActionMenu from "../components/ActionMenu";
import SearchBar from "../components/SearchBar";
import Select from "../components/Select";
import Toast from "../components/Toast";
import Onboarding from "../components/Onboarding";
import { useToast } from "../hooks/useToast";
import { useTheme } from "../context/ThemeContext";

const TABS = [
  { id: "books", label: "Books" },
  { id: "borrows", label: "Borrowed Books" },
  { id: "fines", label: "Fines" },
  { id: "members", label: "Members" },
  { id: "communities", label: "Communities" },
  { id: "donations", label: "Donations" },
];

const EMPTY_BOOK_FORM = {
  title: "",
  author: "",
  isbn: "",
  total_copies: 1,
  genre: "",
};

function wcagTextColor(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
}

// Binary-search the minimum opacity at which rgba(fgVal, fgVal, fgVal, α) composited
// over rgb(bgR,bgG,bgB) achieves the target contrast ratio. fgVal is 0 (black) or 255 (white).
function minAlphaForContrast(fgVal, bgR, bgG, bgB, minRatio) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const bgL = 0.2126 * lin(bgR) + 0.7152 * lin(bgG) + 0.0722 * lin(bgB);
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 16; i++) {
    const alpha = (lo + hi) / 2;
    const rc = Math.round(fgVal * alpha + bgR * (1 - alpha));
    const gc = Math.round(fgVal * alpha + bgG * (1 - alpha));
    const bc = Math.round(fgVal * alpha + bgB * (1 - alpha));
    const fL = 0.2126 * lin(rc) + 0.7152 * lin(gc) + 0.0722 * lin(bc);
    const ratio = (Math.max(fL, bgL) + 0.05) / (Math.min(fL, bgL) + 0.05);
    if (ratio >= minRatio) hi = alpha;
    else lo = alpha;
  }
  return Math.min(1, hi + 0.005);
}

function NoCoverPlaceholder({ title, className }) {
  return (
    <div className={`no-cover-placeholder${className ? ` ${className}` : ""}`}>
      <span className="no-cover-title">{title}</span>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="4 4 20 4 14 13 14 20 10 20 10 13 4 4" />
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ColumnFilterArrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M1.5 3.5l3.5 3 3.5-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.24-4.24a2 2 0 0 0 .11-2.93Z" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function dueInDaysLabel(dueDate) {
  const diffDays = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (diffDays <= 0) return "Due today";
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function AdminDashboard() {
  const { user, logout } = useAuth();
  const { navStyle } = useTheme();
  const [tab, setTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [borrowBookFilter, setBorrowBookFilter] = useState("");
  const [borrowBorrowerFilter, setBorrowBorrowerFilter] = useState("");
  const [borrowStatusFilter, setBorrowStatusFilter] = useState("");
  const [openBorrowFilter, setOpenBorrowFilter] = useState(null); // 'book' | 'borrower' | 'status' | null
  const [borrowFilterSearch, setBorrowFilterSearch] = useState("");
  const borrowFilterBtnRef = useRef(null);
  const borrowFilterSearchRef = useRef(null);
  const [memberUsernameFilter, setMemberUsernameFilter] = useState("");
  const [memberTierFilter, setMemberTierFilter] = useState("");
  const [openMemberFilter, setOpenMemberFilter] = useState(null); // 'username' | 'tier' | null
  const [memberFilterSearch, setMemberFilterSearch] = useState("");
  const memberFilterBtnRef = useRef(null);
  const memberFilterSearchRef = useRef(null);
  const [fines, setFines] = useState([]);
  const [fineHistory, setFineHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [metaFilter, setMetaFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [booksView, setBooksView] = useState(
    () => localStorage.getItem("adminBooksView") || "grid"
  );
  const [loadError, setLoadError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Add book
  const [showAdd, setShowAdd] = useState(false);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [bookError, setBookError] = useState("");

  // Edit book
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState("");

  // Book logs
  const [logsBook, setLogsBook] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [bookBorrows, setBookBorrows] = useState([]);
  const [bookBorrowsLoading, setBookBorrowsLoading] = useState(false);

  // Book detail modal
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookReviews, setBookReviews] = useState(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bookDetailMenuOpen, setBookDetailMenuOpen] = useState(false);
  const bookDetailMenuRef = useRef(null);

  // Book card "more actions" menu (books grid) — id of the card whose menu is open
  const [cardMenuOpenId, setCardMenuOpenId] = useState(null);
  const cardMenuRef = useRef(null);

  // Members
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberBorrows, setMemberBorrows] = useState([]);
  const [memberBorrowsLoading, setMemberBorrowsLoading] = useState(false);

  const { toasts, toast } = useToast();

  // Re-auth modal (for sensitive admin actions)
  const [reAuthFor, setReAuthFor] = useState(null); // 'policy' | 'pricing'
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [reAuthError, setReAuthError] = useState("");
  const [reAuthLoading, setReAuthLoading] = useState(false);

  // Fine policy
  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    fine_per_day: "",
    borrow_days: "",
  });
  const [policyError, setPolicyError] = useState("");
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [processingReturnId, setProcessingReturnId] = useState(null);

  // Memberships
  const [membershipPricing, setMembershipPricing] = useState(null);
  const [membershipPricingForm, setMembershipPricingForm] = useState({
    silver_rate: "",
    gold_rate: "",
    family_rate: "",
  });
  const [membershipPricingError, setMembershipPricingError] = useState("");
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);

  // Donations
  const [donations, setDonations] = useState([]);
  const [donationsLoaded, setDonationsLoaded] = useState(false);

  // Membership requests
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [membershipRequestsLoaded, setMembershipRequestsLoaded] =
    useState(false);
  const [membershipRequestHistoryOpen, setMembershipRequestHistoryOpen] =
    useState(false);
  const [membershipRequestHistoryFilter, setMembershipRequestHistoryFilter] =
    useState("");
  const [approvingMembershipRequest, setApprovingMembershipRequest] =
    useState(null);
  const [approveMembershipNotes, setApproveMembershipNotes] = useState("");
  const [approveMembershipError, setApproveMembershipError] = useState("");
  const [rejectingMembershipRequest, setRejectingMembershipRequest] =
    useState(null);
  const [rejectMembershipNotes, setRejectMembershipNotes] = useState("");
  const [rejectMembershipError, setRejectMembershipError] = useState("");

  // Book requests
  const [bookRequests, setBookRequests] = useState([]);
  const [bookRequestsLoaded, setBookRequestsLoaded] = useState(false);
  const [bookRequestHistoryOpen, setBookRequestHistoryOpen] = useState(false);
  const [bookRequestHistoryFilter, setBookRequestHistoryFilter] =
    useState("");
  const [approvingBookRequest, setApprovingBookRequest] = useState(null);
  const [approveBookTitle, setApproveBookTitle] = useState("");
  const [approveBookAuthor, setApproveBookAuthor] = useState("");
  const [approveBookIsbn, setApproveBookIsbn] = useState("");
  const [approveBookGenre, setApproveBookGenre] = useState("");
  const [approveBookCopies, setApproveBookCopies] = useState(1);
  const [approveBookNotes, setApproveBookNotes] = useState("");
  const [approveBookError, setApproveBookError] = useState("");
  const [rejectingBookRequest, setRejectingBookRequest] = useState(null);
  const [rejectBookNotes, setRejectBookNotes] = useState("");
  const [rejectBookError, setRejectBookError] = useState("");

  // Communities
  const [adminCommunities, setAdminCommunities] = useState([]);
  const [adminCommunitiesLoaded, setAdminCommunitiesLoaded] = useState(false);
  const [approvingCommunity, setApprovingCommunity] = useState(null);
  const [communityApproveNotes, setCommunityApproveNotes] = useState("");
  const [communityApproveError, setCommunityApproveError] = useState("");
  const [rejectingCommunity, setRejectingCommunity] = useState(null);
  const [communityRejectNotes, setCommunityRejectNotes] = useState("");
  const [communityRejectError, setCommunityRejectError] = useState("");
  const [approvingDonation, setApprovingDonation] = useState(null); // donation object
  const [approveCredit, setApproveCredit] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approveError, setApproveError] = useState("");
  const [rejectingDonation, setRejectingDonation] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Genres
  const [genres, setGenres] = useState([]);
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [genreError, setGenreError] = useState("");
  const [genreSaving, setGenreSaving] = useState(false);

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [showRefreshLog, setShowRefreshLog] = useState(false);
  const [refreshLog, setRefreshLog] = useState([]);
  const [refreshProgress, setRefreshProgress] = useState(null); // { done, total }
  const [refreshModalTitle, setRefreshModalTitle] =
    useState("Refresh All Books");
  const [refreshingBookId, setRefreshingBookId] = useState(null);
  const [refreshBookId, setRefreshBookId] = useState(null);

  // AI field generation
  const [aiGenModal, setAiGenModal] = useState(null); // { bookId, field, bookTitle }
  const [aiGenContent, setAiGenContent] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenSlow, setAiGenSlow] = useState(false); // true once generation has taken > 5s
  const [aiGenError, setAiGenError] = useState("");
  const [aiGenSaving, setAiGenSaving] = useState(false);
  const aiGenRequestIdRef = useRef(0);
  const aiGenSlowTimerRef = useRef(null);

  // Cover upload
  const [coverUploadBookId, setCoverUploadBookId] = useState(null);
  const [coverUploadMode, setCoverUploadMode] = useState("file");
  const [coverUploadPreview, setCoverUploadPreview] = useState("");
  const [coverUploadUrl, setCoverUploadUrl] = useState("");
  const [coverUploadSaving, setCoverUploadSaving] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");

  const load = useCallback(() => {
    setLoadError("");
    return Promise.all([
      api.get("/books").then((r) => setBooks(r.data)),
      api.get("/admin/borrows").then((r) => setBorrows(r.data)),
      api.get("/admin/fines").then((r) => setFines(r.data)),
      api.get("/admin/fines/history").then((r) => setFineHistory(r.data)),
      api.get("/admin/policy").then((r) => {
        setPolicy(r.data);
        setPolicyForm({
          fine_per_day: r.data.fine_per_day,
          borrow_days: r.data.borrow_days,
        });
      }),
      api.get("/genres").then((r) => setGenres(r.data.map((g) => g.name))),
    ]);
  }, []);

  useEffect(() => {
    load().catch(() =>
      setLoadError("Failed to load data. Is the server running?")
    );
    // "books" is the default tab, so its Book Requests section needs its
    // own fetch here — every other tab's lazily-loaded data is instead
    // kicked off from handleTabChange when the admin first switches to it.
    loadBookRequests();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    if (!localStorage.getItem(`onboarding_seen_${user.username}`)) {
      setShowOnboarding(true);
    }
  }, [user]);

  const closeOnboarding = () => {
    localStorage.setItem(`onboarding_seen_${user.username}`, "true");
    setShowOnboarding(false);
  };

  const selectedBook = books.find((b) => b.id === selectedBookId) || null;

  // Fetch reviews whenever a book detail is opened
  useEffect(() => {
    setBioExpanded(false);
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

  const changeBooksView = (v) => {
    setBooksView(v);
    localStorage.setItem("adminBooksView", v);
  };

  const openBookDetail = (bookId) => setSelectedBookId(bookId);
  const closeBookDetail = () => {
    setSelectedBookId(null);
    setBookDetailMenuOpen(false);
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshBookId(null);
    setRefreshLog([]);
    setRefreshProgress({ done: 0, total: books.length });
    setRefreshModalTitle("Refresh All Books");
    setShowRefreshLog(true);

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      try {
        const res = await api.post(`/books/${book.id}/scrape`);
        const d = res.data;
        const loaded = [];
        if (d.description) loaded.push("description");
        if (d.cover_url) loaded.push("cover");
        if (d.author_bio) loaded.push("author bio");
        if (d.cover_color) loaded.push("color");
        setRefreshLog((prev) => [
          ...prev,
          { title: book.title, ok: true, loaded },
        ]);
      } catch {
        setRefreshLog((prev) => [
          ...prev,
          { title: book.title, ok: false, loaded: [] },
        ]);
      }
      setRefreshProgress({ done: i + 1, total: books.length });
    }

    await load();
    setRefreshingAll(false);
  };

  const loadMembers = useCallback(() => {
    api.get("/admin/members").then((r) => {
      setMembers(r.data);
      setMembersLoaded(true);
    });
  }, []);

  const loadMembershipPricing = useCallback(() => {
    api.get("/admin/memberships/pricing").then((r) => {
      setMembershipPricing(r.data);
      setMembershipPricingForm({
        silver_rate: r.data.silver_rate,
        gold_rate: r.data.gold_rate,
        family_rate: r.data.family_rate,
      });
    });
  }, []);

  const loadDonations = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/donations${qs}`).then((r) => {
      setDonations(r.data);
      setDonationsLoaded(true);
    });
  }, []);

  const loadAdminCommunities = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/communities${qs}`).then((r) => {
      setAdminCommunities(r.data);
      setAdminCommunitiesLoaded(true);
    });
  }, []);

  const loadMembershipRequests = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/membership-requests${qs}`).then((r) => {
      setMembershipRequests(r.data);
      setMembershipRequestsLoaded(true);
    });
  }, []);

  const loadBookRequests = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/book-requests${qs}`).then((r) => {
      setBookRequests(r.data);
      setBookRequestsLoaded(true);
    });
  }, []);

  const handleTabChange = (t) => {
    setTab(t);

    if (t === "members") {
      if (!membersLoaded) loadMembers();
      if (!membershipsLoaded) {
        loadMembershipPricing();
        setMembershipsLoaded(true);
      }
      loadMembershipRequests();
    }
    if (t === "donations") loadDonations();
    if (t === "communities") loadAdminCommunities();
    if (t === "books") loadBookRequests();
  };

  const submitApproveCommunity = async (e) => {
    e.preventDefault();
    setCommunityApproveError("");
    try {
      await api.put(`/admin/communities/${approvingCommunity.id}/approve`, {
        admin_notes: communityApproveNotes,
      });
      setApprovingCommunity(null);
      loadAdminCommunities();
      toast("Community approved");
    } catch (err) {
      setCommunityApproveError(
        err.response?.data?.error || "Failed to approve"
      );
    }
  };

  const submitRejectCommunity = async (e) => {
    e.preventDefault();
    setCommunityRejectError("");
    try {
      await api.put(`/admin/communities/${rejectingCommunity.id}/reject`, {
        admin_notes: communityRejectNotes,
      });
      setRejectingCommunity(null);
      loadAdminCommunities();
      toast("Community rejected");
    } catch (err) {
      setCommunityRejectError(err.response?.data?.error || "Failed to reject");
    }
  };

  const openMember = async (member) => {
    setSelectedMember(member);
    setMemberBorrows([]);
    setMemberBorrowsLoading(true);
    try {
      const res = await api.get(`/admin/members/${member.id}/borrows`);
      setMemberBorrows(res.data);
    } finally {
      setMemberBorrowsLoading(false);
    }
  };

  // ── Add book ──────────────────────────────────────────────────
  const addBook = async (e) => {
    e.preventDefault();
    setBookError("");
    try {
      await api.post("/books", {
        ...bookForm,
        total_copies: Number(bookForm.total_copies),
      });
      setShowAdd(false);
      setBookForm(EMPTY_BOOK_FORM);
      load();
      toast("Book added");
    } catch (err) {
      setBookError(err.response?.data?.error || "Failed to add book");
    }
  };

  const deleteBook = async (id) => {
    try {
      await api.delete(`/books/${id}`);
      load();
      toast("Book deleted");
    } catch (err) {
      toast(err.response?.data?.error || "Cannot delete book", "error");
    }
  };

  const addGenre = async (e) => {
    e.preventDefault();
    setGenreError("");
    const name = newGenreName.trim();
    if (!name) return;
    if (!/^[A-Za-z]+$/.test(name)) {
      setGenreError("Letters only (a–z), no spaces or special characters");
      return;
    }
    setGenreSaving(true);
    try {
      const { data } = await api.post("/genres", { name });
      setGenres((prev) => [...prev, data.name].sort());
      setShowAddGenre(false);
      setNewGenreName("");
      toast(`Genre "${data.name}" added`);
    } catch (err) {
      setGenreError(err.response?.data?.error || "Failed to add genre");
    } finally {
      setGenreSaving(false);
    }
  };

  const refreshMeta = async (id) => {
    const book = books.find((b) => b.id === id);
    setRefreshingBookId(id);
    setRefreshBookId(id);
    setRefreshLog([]);
    setRefreshProgress(null);
    setRefreshModalTitle(`Refreshing : ${book.title}`);
    setShowRefreshLog(true);
    try {
      const res = await api.post(`/books/${id}/scrape`);
      const d = res.data;
      const loaded = [];
      if (d.description) loaded.push("description");
      if (d.cover_url) loaded.push("cover");
      if (d.author_bio) loaded.push("author bio");
      if (d.cover_color) loaded.push("color");
      setRefreshLog([{ title: book.title, ok: true, loaded }]);
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                description: d.description,
                author_bio: d.author_bio,
                cover_url: d.cover_url || b.cover_url,
                cover_color: d.cover_color || b.cover_color,
              }
            : b
        )
      );
      toast(
        loaded.length > 0
          ? `Metadata changed · ${loaded.join(", ")}`
          : "Metadata changed · no data found"
      );
    } catch {
      setRefreshLog([{ title: book.title, ok: false, loaded: [] }]);
      toast("Failed to refresh metadata", "error");
    } finally {
      setRefreshingBookId(null);
    }
  };

  // ── AI field generation ───────────────────────────────────────
  const AI_GEN_SLOW_MS = 5000;

  const clearAiGenSlowTimer = () => {
    clearTimeout(aiGenSlowTimerRef.current);
    aiGenSlowTimerRef.current = null;
  };

  const runAiGenerate = async (bookId, field) => {
    const reqId = ++aiGenRequestIdRef.current;
    setAiGenContent("");
    setAiGenError("");
    setAiGenSlow(false);
    setAiGenLoading(true);
    clearAiGenSlowTimer();
    aiGenSlowTimerRef.current = setTimeout(() => {
      if (aiGenRequestIdRef.current === reqId) setAiGenSlow(true);
    }, AI_GEN_SLOW_MS);

    try {
      const res = await api.post(`/books/${bookId}/generate-field`, { field });
      if (aiGenRequestIdRef.current !== reqId) return; // superseded — ignore stale response
      setAiGenContent(res.data.content);
    } catch (err) {
      if (aiGenRequestIdRef.current !== reqId) return;
      setAiGenError(err.response?.data?.error || "Generation failed");
    } finally {
      if (aiGenRequestIdRef.current === reqId) {
        setAiGenLoading(false);
        setAiGenSlow(false);
        clearAiGenSlowTimer();
      }
    }
  };

  const openAiGen = (bookId, field) => {
    const book = books.find((b) => b.id === bookId);
    const existing = book?.[field] || "";
    setAiGenModal({
      bookId,
      field,
      bookTitle: book?.title || "",
      mode: existing ? "edit" : "generate",
    });
    setAiGenError("");
    setAiGenSlow(false);
    if (existing) {
      // Editing existing metadata — pre-fill with the current value; no AI call needed.
      aiGenRequestIdRef.current++; // invalidate any stray in-flight request
      clearAiGenSlowTimer();
      setAiGenContent(existing);
      setAiGenLoading(false);
      return;
    }
    runAiGenerate(bookId, field);
  };

  // Write a missing field by hand from the start — never fires an AI call,
  // unlike openAiGen() which auto-generates the moment the field is empty.
  const openManualEdit = (bookId, field) => {
    const book = books.find((b) => b.id === bookId);
    aiGenRequestIdRef.current++; // invalidate any stray in-flight request
    clearAiGenSlowTimer();
    setAiGenModal({
      bookId,
      field,
      bookTitle: book?.title || "",
      mode: "edit",
    });
    setAiGenError("");
    setAiGenSlow(false);
    setAiGenContent(book?.[field] || "");
    setAiGenLoading(false);
  };

  const regenerateAiField = () => {
    if (!aiGenModal) return;
    runAiGenerate(aiGenModal.bookId, aiGenModal.field);
  };

  // Bail out of waiting on Groq and let the admin type the field by hand instead.
  const writeAiGenManually = () => {
    aiGenRequestIdRef.current++; // invalidate the in-flight request so its response is ignored
    clearAiGenSlowTimer();
    setAiGenLoading(false);
    setAiGenSlow(false);
    setAiGenError("");
    setAiGenContent("");
  };

  const closeAiGenModal = () => {
    if (aiGenSaving) return;
    aiGenRequestIdRef.current++; // invalidate any in-flight request
    clearAiGenSlowTimer();
    setAiGenModal(null);
  };

  const saveAiGenContent = async () => {
    if (!aiGenModal || !aiGenContent.trim()) return;
    setAiGenSaving(true);
    setAiGenError("");
    try {
      await api.put(`/books/${aiGenModal.bookId}/patch-metadata`, {
        [aiGenModal.field]: aiGenContent.trim(),
      });
      setBooks((prev) =>
        prev.map((b) =>
          b.id === aiGenModal.bookId
            ? { ...b, [aiGenModal.field]: aiGenContent.trim() }
            : b
        )
      );
      const logLabel =
        aiGenModal.field === "author_bio" ? "author bio" : aiGenModal.field;
      setRefreshLog((prev) =>
        prev.map((entry, i) =>
          i === 0 ? { ...entry, loaded: [...entry.loaded, logLabel] } : entry
        )
      );
      toast(
        `${
          aiGenModal.field === "author_bio" ? "Author bio" : "Description"
        } saved`
      );
      setAiGenModal(null);
    } catch (err) {
      setAiGenError(err.response?.data?.error || "Failed to save");
    } finally {
      setAiGenSaving(false);
    }
  };

  // ── Cover upload ──────────────────────────────────────────────
  const openCoverUpload = (bookId) => {
    setCoverUploadBookId(bookId);
    setCoverUploadMode("file");
    setCoverUploadPreview("");
    setCoverUploadUrl("");
    setCoverUploadError("");
  };

  const handleCoverFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 400;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        setCoverUploadPreview(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveCoverUpload = async () => {
    if (!coverUploadBookId) return;
    const urlToSave =
      coverUploadMode === "file" ? coverUploadPreview : coverUploadUrl.trim();
    if (!urlToSave) return;
    setCoverUploadSaving(true);
    setCoverUploadError("");
    try {
      const res = await api.put(`/books/${coverUploadBookId}/patch-metadata`, {
        cover_url: urlToSave,
      });
      setBooks((prev) =>
        prev.map((b) =>
          b.id === coverUploadBookId
            ? {
                ...b,
                cover_url: res.data.cover_url,
                cover_color: res.data.cover_color,
              }
            : b
        )
      );
      setRefreshLog((prev) =>
        prev.map((entry, i) =>
          i === 0 ? { ...entry, loaded: [...entry.loaded, "cover"] } : entry
        )
      );
      toast("Cover saved");
      setCoverUploadBookId(null);
      setCoverUploadPreview("");
      setCoverUploadUrl("");
    } catch (err) {
      setCoverUploadError(err.response?.data?.error || "Failed to save cover");
    } finally {
      setCoverUploadSaving(false);
    }
  };

  // ── Edit book ─────────────────────────────────────────────────
  const openEdit = (book) => {
    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre || "",
      total_copies: book.total_copies,
      discard_reason: "",
    });
    setEditError("");
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditError("");
    try {
      await api.put(`/books/${editingBook.id}`, {
        ...editForm,
        total_copies: Number(editForm.total_copies),
      });
      setEditingBook(null);
      load();
      toast("Book updated");
    } catch (err) {
      setEditError(err.response?.data?.error || "Failed to update book");
    }
  };

  // ── Book logs ─────────────────────────────────────────────────
  const openLogs = async (book) => {
    setLogsBook(book);
    setLogsLoading(true);
    setBookBorrowsLoading(true);
    setLogs([]);
    setBookBorrows([]);
    try {
      const [logsRes, borrowsRes] = await Promise.allSettled([
        api.get(`/books/${book.id}/logs`),
        api.get(`/books/${book.id}/borrows`),
      ]);
      if (logsRes.status === "fulfilled") setLogs(logsRes.value.data);
      if (borrowsRes.status === "fulfilled")
        setBookBorrows(borrowsRes.value.data);
    } finally {
      setLogsLoading(false);
      setBookBorrowsLoading(false);
    }
  };

  // ── Re-auth ───────────────────────────────────────────────────
  const openReAuth = (e, forAction) => {
    e.preventDefault();
    setReAuthFor(forAction);
    setReAuthPassword("");
    setReAuthError("");
  };

  const confirmReAuth = async () => {
    setReAuthError("");
    setReAuthLoading(true);
    try {
      await api.post("/admin/verify-password", { password: reAuthPassword });
    } catch {
      setReAuthError("Incorrect password. Please try again.");
      setReAuthLoading(false);
      return;
    }
    setReAuthLoading(false);
    const action = reAuthFor;
    setReAuthFor(null);
    if (action === "policy") await doSavePolicy();
    if (action === "pricing") await doSaveMembershipPricing();
  };

  // ── Fines ─────────────────────────────────────────────────────
  const markFinePaid = async (borrowId) => {
    setMarkingPaidId(borrowId);
    try {
      const res = await api.put(`/admin/fines/${borrowId}/mark-paid`);
      setFines((prev) => prev.filter((f) => f.id !== borrowId));
      setFineHistory((prev) => [res.data, ...prev]);
      toast("Fine marked as paid");
    } catch {
      toast("Failed to mark fine as paid", "error");
    } finally {
      setMarkingPaidId(null);
    }
  };

  // ── Return requests ───────────────────────────────────────────
  const approveReturn = async (borrowId) => {
    setProcessingReturnId(borrowId);
    try {
      await api.put(`/admin/returns/${borrowId}/approve`);
      setBorrows((prev) => prev.filter((b) => b.id !== borrowId));
      toast("Return approved");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to approve return", "error");
    } finally {
      setProcessingReturnId(null);
    }
  };

  const rejectReturn = async (borrowId) => {
    setProcessingReturnId(borrowId);
    try {
      const res = await api.put(`/admin/returns/${borrowId}/reject`);
      setBorrows((prev) =>
        prev.map((b) => (b.id === borrowId ? res.data : b))
      );
      toast("Return request rejected");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to reject return", "error");
    } finally {
      setProcessingReturnId(null);
    }
  };

  // ── Fine policy ───────────────────────────────────────────────
  const doSavePolicy = async () => {
    setPolicyError("");
    try {
      const res = await api.put("/admin/policy", policyForm);
      setPolicy(res.data);
      toast("Policy saved");
    } catch (err) {
      const errs = err.response?.data?.errors;
      setPolicyError(
        errs ? Object.values(errs).join(", ") : "Failed to save policy"
      );
    }
  };

  const savePolicy = (e) => openReAuth(e, "policy");

  // ── Membership ────────────────────────────────────────────────
  const doSaveMembershipPricing = async () => {
    setMembershipPricingError("");
    try {
      const res = await api.put(
        "/admin/memberships/pricing",
        membershipPricingForm
      );
      setMembershipPricing(res.data);
      toast("Pricing saved");
    } catch (err) {
      const errs = err.response?.data?.errors;
      setMembershipPricingError(
        errs ? Object.values(errs).join(", ") : "Failed to save pricing"
      );
    }
  };

  const saveMembershipPricing = (e) => openReAuth(e, "pricing");

  const changeMemberTier = async (memberId, tier) => {
    try {
      await api.put(`/admin/members/${memberId}/membership`, {
        tier: tier || null,
      });
      loadMembers();
      toast("Tier updated");
    } catch (err) {
      toast(err.response?.data?.error || "Failed to update tier", "error");
    }
  };

  const openApprove = (donation) => {
    setApprovingDonation(donation);
    setApproveCredit((donation.estimated_price / 4).toFixed(2));
    setApproveNotes("");
    setApproveError("");
  };

  const submitApprove = async (e) => {
    e.preventDefault();
    setApproveError("");
    try {
      await api.put(`/admin/donations/${approvingDonation.id}/approve`, {
        credit_amount: Number(approveCredit),
        admin_notes: approveNotes,
      });
      setApprovingDonation(null);
      loadDonations();
      toast("Donation approved");
    } catch (err) {
      setApproveError(
        err.response?.data?.error || "Failed to approve donation"
      );
    }
  };

  const openReject = (donation) => {
    setRejectingDonation(donation);
    setRejectNotes("");
    setRejectError("");
  };

  const submitReject = async (e) => {
    e.preventDefault();
    setRejectError("");
    try {
      await api.put(`/admin/donations/${rejectingDonation.id}/reject`, {
        admin_notes: rejectNotes,
      });
      setRejectingDonation(null);
      loadDonations();
      toast("Donation rejected");
    } catch (err) {
      setRejectError(err.response?.data?.error || "Failed to reject donation");
    }
  };

  const openApproveMembershipRequest = (req) => {
    setApprovingMembershipRequest(req);
    setApproveMembershipNotes("");
    setApproveMembershipError("");
  };

  const submitApproveMembershipRequest = async (e) => {
    e.preventDefault();
    setApproveMembershipError("");
    try {
      await api.put(
        `/admin/membership-requests/${approvingMembershipRequest.id}/approve`,
        { admin_notes: approveMembershipNotes }
      );
      setApprovingMembershipRequest(null);
      loadMembershipRequests();
      toast("Membership request approved");
    } catch (err) {
      setApproveMembershipError(
        err.response?.data?.error || "Failed to approve request"
      );
    }
  };

  const openRejectMembershipRequest = (req) => {
    setRejectingMembershipRequest(req);
    setRejectMembershipNotes("");
    setRejectMembershipError("");
  };

  const submitRejectMembershipRequest = async (e) => {
    e.preventDefault();
    setRejectMembershipError("");
    try {
      await api.put(
        `/admin/membership-requests/${rejectingMembershipRequest.id}/reject`,
        { admin_notes: rejectMembershipNotes }
      );
      setRejectingMembershipRequest(null);
      loadMembershipRequests();
      toast("Membership request rejected");
    } catch (err) {
      setRejectMembershipError(
        err.response?.data?.error || "Failed to reject request"
      );
    }
  };

  const openApproveBookRequest = (req) => {
    setApprovingBookRequest(req);
    setApproveBookTitle(req.title);
    setApproveBookAuthor(req.author || "");
    setApproveBookIsbn(req.isbn || "");
    setApproveBookGenre(req.genre || "");
    setApproveBookCopies(1);
    setApproveBookNotes("");
    setApproveBookError("");
  };

  const submitApproveBookRequest = async (e) => {
    e.preventDefault();
    setApproveBookError("");
    try {
      await api.put(`/admin/book-requests/${approvingBookRequest.id}/approve`, {
        title: approveBookTitle,
        author: approveBookAuthor,
        isbn: approveBookIsbn,
        genre: approveBookGenre,
        total_copies: Number(approveBookCopies),
        admin_notes: approveBookNotes,
      });
      setApprovingBookRequest(null);
      loadBookRequests();
      toast("Book request approved");
    } catch (err) {
      setApproveBookError(
        err.response?.data?.error || "Failed to approve request"
      );
    }
  };

  const openRejectBookRequest = (req) => {
    setRejectingBookRequest(req);
    setRejectBookNotes("");
    setRejectBookError("");
  };

  const submitRejectBookRequest = async (e) => {
    e.preventDefault();
    setRejectBookError("");
    try {
      await api.put(`/admin/book-requests/${rejectingBookRequest.id}/reject`, {
        admin_notes: rejectBookNotes,
      });
      setRejectingBookRequest(null);
      loadBookRequests();
      toast("Book request rejected");
    } catch (err) {
      setRejectBookError(
        err.response?.data?.error || "Failed to reject request"
      );
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
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

  // Union of Genre-table entries + genres already used on books, sorted
  const allGenres = useMemo(
    () => [...new Set([...genres, ...Object.keys(genreCounts)])].sort(),
    [genres, genreCounts]
  );

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
          (availFilter === "out-of-stock" && b.available_copies === 0);
        const isComplete = b.description && b.author_bio && b.cover_url;
        const matchMeta =
          metaFilter === "all" ||
          (metaFilter === "complete" && isComplete) ||
          (metaFilter === "incomplete" && !isComplete);
        return matchSearch && matchGenre && matchAvail && matchMeta;
      }).sort((a, b) => b.id - a.id),
    [books, search, selectedGenre, availFilter, metaFilter]
  );

  const hasExtraBookFilters = availFilter !== "all" || metaFilter !== "all";
  const clearBookFilters = () => {
    setAvailFilter("all");
    setMetaFilter("all");
  };

  const borrowBookOptions = useMemo(
    () => [...new Set(borrows.map((b) => b.book_title))].sort(),
    [borrows]
  );
  const borrowBorrowerOptions = useMemo(
    () => [...new Set(borrows.map((b) => b.username))].sort(),
    [borrows]
  );

  const filteredBorrows = useMemo(
    () =>
      borrows
        .filter((b) => {
          const matchBook =
            !borrowBookFilter || b.book_title === borrowBookFilter;
          const matchBorrower =
            !borrowBorrowerFilter || b.username === borrowBorrowerFilter;
          const matchStatus =
            !borrowStatusFilter ||
            (borrowStatusFilter === "overdue" && b.is_overdue) ||
            (borrowStatusFilter === "active" && !b.is_overdue);
          return matchBook && matchBorrower && matchStatus;
        })
        // Pending return/fine-payment requests need admin action — surface
        // them first so they aren't buried in the full borrows list.
        .sort((a, b) => (b.return_requested_at ? 1 : 0) - (a.return_requested_at ? 1 : 0)),
    [borrows, borrowBookFilter, borrowBorrowerFilter, borrowStatusFilter]
  );

  const hasBorrowFilters =
    borrowBookFilter || borrowBorrowerFilter || borrowStatusFilter;
  const clearBorrowFilters = () => {
    setBorrowBookFilter("");
    setBorrowBorrowerFilter("");
    setBorrowStatusFilter("");
  };

  const borrowFilterMenus = {
    book: {
      value: borrowBookFilter,
      setValue: setBorrowBookFilter,
      options: [
        { value: "", label: "All books" },
        ...borrowBookOptions.map((title) => ({ value: title, label: title })),
      ],
    },
    borrower: {
      value: borrowBorrowerFilter,
      setValue: setBorrowBorrowerFilter,
      options: [
        { value: "", label: "All borrowers" },
        ...borrowBorrowerOptions.map((username) => ({
          value: username,
          label: username,
        })),
      ],
    },
    status: {
      value: borrowStatusFilter,
      setValue: setBorrowStatusFilter,
      options: [
        { value: "", label: "All statuses" },
        { value: "active", label: "Active" },
        { value: "overdue", label: "Overdue" },
      ],
    },
  };

  const toggleBorrowFilter = (column) => {
    setOpenBorrowFilter((prev) => (prev === column ? null : column));
    setBorrowFilterSearch("");
  };

  const visibleBorrowFilterOptions = openBorrowFilter
    ? borrowFilterMenus[openBorrowFilter].options.filter(
        (opt) =>
          opt.value === "" ||
          opt.label
            .toLowerCase()
            .includes(borrowFilterSearch.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    if (openBorrowFilter) borrowFilterSearchRef.current?.focus();
  }, [openBorrowFilter]);

  const memberUsernameOptions = useMemo(
    () => [...new Set(members.map((m) => m.username))].sort(),
    [members]
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const matchUsername =
          !memberUsernameFilter || m.username === memberUsernameFilter;
        const matchTier =
          !memberTierFilter ||
          (memberTierFilter === "none"
            ? !m.membership_tier
            : m.membership_tier === memberTierFilter);
        return matchUsername && matchTier;
      }),
    [members, memberUsernameFilter, memberTierFilter]
  );

  const hasMemberFilters = memberUsernameFilter || memberTierFilter;
  const clearMemberFilters = () => {
    setMemberUsernameFilter("");
    setMemberTierFilter("");
  };

  const memberStats = useMemo(() => {
    const tierCounts = { none: 0, silver: 0, gold: 0, family: 0 };
    let currentlyBorrowed = 0;
    let finesPending = 0;
    let finesPaid = 0;
    for (const m of members) {
      tierCounts[m.membership_tier || "none"] += 1;
      currentlyBorrowed += m.currently_borrowed || 0;
      finesPending += m.fines_pending || 0;
      finesPaid += m.fines_paid || 0;
    }
    const tiers = [
      { key: "none", label: "None" },
      { key: "silver", label: "Silver" },
      { key: "gold", label: "Gold" },
      { key: "family", label: "Family" },
    ].map((t) => ({ ...t, count: tierCounts[t.key] }));
    const maxTierCount = Math.max(1, ...tiers.map((t) => t.count));

    const topBorrowers = [...members]
      .filter((m) => m.total_borrows > 0)
      .sort((a, b) => b.total_borrows - a.total_borrows)
      .slice(0, 5);
    const maxBorrows = Math.max(1, ...topBorrowers.map((m) => m.total_borrows));

    return {
      totalMembers: members.length,
      currentlyBorrowed,
      finesPending,
      finesPaid,
      tiers,
      maxTierCount,
      topBorrowers,
      maxBorrows,
    };
  }, [members]);

  const pendingBookRequests = bookRequests.filter(
    (r) => r.status === "pending"
  );
  const historyBookRequests = bookRequests.filter(
    (r) =>
      r.status !== "pending" &&
      (!bookRequestHistoryFilter || r.status === bookRequestHistoryFilter)
  );

  const pendingMembershipRequests = membershipRequests.filter(
    (r) => r.status === "pending"
  );
  const historyMembershipRequests = membershipRequests.filter(
    (r) =>
      r.status !== "pending" &&
      (!membershipRequestHistoryFilter ||
        r.status === membershipRequestHistoryFilter)
  );

  const pendingReturnRequests = borrows.filter((b) => b.return_requested_at);

  const tabDots = {
    books: pendingBookRequests.length > 0,
    borrows: pendingReturnRequests.length > 0,
    fines: memberStats.finesPending > 0,
    members: pendingMembershipRequests.length > 0,
    communities: adminCommunities.some((c) => c.status === "pending"),
    donations: donations.some((d) => d.status === "pending"),
  };

  const memberFilterMenus = {
    username: {
      value: memberUsernameFilter,
      setValue: setMemberUsernameFilter,
      options: [
        { value: "", label: "All members" },
        ...memberUsernameOptions.map((username) => ({
          value: username,
          label: username,
        })),
      ],
    },
    tier: {
      value: memberTierFilter,
      setValue: setMemberTierFilter,
      options: [
        { value: "", label: "All tiers" },
        { value: "none", label: "None" },
        { value: "silver", label: "Silver" },
        { value: "gold", label: "Gold" },
        { value: "family", label: "Family" },
      ],
    },
  };

  const toggleMemberFilter = (column) => {
    setOpenMemberFilter((prev) => (prev === column ? null : column));
    setMemberFilterSearch("");
  };

  const visibleMemberFilterOptions = openMemberFilter
    ? memberFilterMenus[openMemberFilter].options.filter(
        (opt) =>
          opt.value === "" ||
          opt.label
            .toLowerCase()
            .includes(memberFilterSearch.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    if (openMemberFilter) memberFilterSearchRef.current?.focus();
  }, [openMemberFilter]);

  const isDiscarding =
    editingBook && Number(editForm.total_copies) < editingBook.total_copies;
  const borrowed = editingBook
    ? editingBook.total_copies - editingBook.available_copies
    : 0;

  // Derive palette instantly from server-stored cover_color (no async canvas needed).
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
      text,
      labelColor: mk(isLight ? 0.65 : 0.5),
      subtleColor: mk(isLight ? 0.78 : 0.65),
      faintColor: mk(isLight ? 0.5 : 0.38),
    };
  }, [selectedBook]);

  const AUTHOR_BIO_WORD_LIMIT = 50;
  const authorBioTruncated = useMemo(() => {
    const bio = selectedBook?.author_bio;
    if (!bio) return null;
    const words = bio.trim().split(/\s+/);
    if (words.length <= AUTHOR_BIO_WORD_LIMIT) return null;
    return words.slice(0, AUTHOR_BIO_WORD_LIMIT).join(" ") + "…";
  }, [selectedBook]);

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

  const bookField = (key) => ({
    value: bookForm[key],
    onChange: (e) => setBookForm({ ...bookForm, [key]: e.target.value }),
  });

  const editField = (key) => ({
    value: editForm[key] ?? "",
    onChange: (e) => setEditForm({ ...editForm, [key]: e.target.value }),
  });

  const renderBookActions = (b) => (
    <>
      <button
        className="btn btn-sm btn-icon btn-icon-ghost"
        onClick={() => openEdit(b)}
        aria-label="Edit book"
        title="Edit book"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>
      <div className="action-menu-wrap">
        <button
          className="btn btn-sm btn-icon btn-icon-ghost"
          ref={cardMenuOpenId === b.id ? cardMenuRef : null}
          onClick={() =>
            setCardMenuOpenId(cardMenuOpenId === b.id ? null : b.id)
          }
          aria-label="More actions"
          aria-expanded={cardMenuOpenId === b.id}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
        <ActionMenu
          open={cardMenuOpenId === b.id}
          anchorRef={cardMenuRef}
          onClose={() => setCardMenuOpenId(null)}
        >
          <button
            className="action-menu-item"
            onClick={() => {
              setCardMenuOpenId(null);
              openLogs(b);
            }}
          >
            Logs
          </button>
          <button
            className="action-menu-item"
            onClick={() => {
              setCardMenuOpenId(null);
              refreshingBookId === b.id
                ? setShowRefreshLog(true)
                : refreshMeta(b.id);
            }}
            disabled={refreshingAll}
          >
            {refreshingBookId === b.id ? "Refreshing…" : "Refresh metadata"}
          </button>
          <div className="action-menu-divider" />
          <button
            className="action-menu-item action-menu-danger"
            onClick={() => {
              setCardMenuOpenId(null);
              deleteBook(b.id);
            }}
          >
            Delete
          </button>
        </ActionMenu>
      </div>
    </>
  );

  return (
    <>
      {showOnboarding && (
        <Onboarding
          role="admin"
          username={user.username}
          onClose={closeOnboarding}
          onNavigate={handleTabChange}
        />
      )}
      <div className={`layout${navStyle === "dock" ? " layout-nav-dock" : ""}`}>
        <div className="dashboard-header">
          <TopBar
            title="Library Admin"
            username={user.username}
            library={user.library}
            onLogout={logout}
            onReplayTour={() => setShowOnboarding(true)}
          />
          {navStyle !== "dock" && (
            <NavTabs
              tabs={TABS}
              active={tab}
              onChange={handleTabChange}
              dots={tabDots}
            />
          )}
        </div>
        {navStyle === "dock" && (
          <Dock
            tabs={TABS}
            active={tab}
            onChange={handleTabChange}
            dots={tabDots}
          />
        )}
        <div className="content">
          {loadError && <div className="error">{loadError}</div>}

          {/* ── Books ── */}
          {tab === "books" && (
            <>
              {bookRequestsLoaded && pendingBookRequests.length > 0 && (
                <>
                  <div className="section-header">
                    <h3>Book Requests</h3>
                    <span
                      className="fine-amount"
                      style={{ fontSize: "0.9rem", fontWeight: 600 }}
                    >
                      {pendingBookRequests.length} pending
                    </span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Book</th>
                        <th>Notes</th>
                        <th>Submitted</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBookRequests.map((r) => (
                        <tr key={r.id}>
                          <td>{r.username}</td>
                          <td>
                            {r.title}
                            <div
                              style={{ fontSize: "0.75rem", color: "#666" }}
                            >
                              {[r.author, r.genre]
                                .filter(Boolean)
                                .join(" · ") || (
                                <span className="muted">—</span>
                              )}
                            </div>
                          </td>
                          <td>{r.notes || <span className="muted">—</span>}</td>
                          <td>
                            {new Date(r.submitted_at).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="btn-row">
                              <button
                                className="btn btn-sm"
                                onClick={() => openApproveBookRequest(r)}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => openRejectBookRequest(r)}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div
                className="section-header section-header-start"
                data-tour="admin-books"
                style={{
                  marginTop:
                    bookRequestsLoaded && pendingBookRequests.length > 0
                      ? 40
                      : 0,
                }}
              >
                <h3>All Books</h3>
                <div className="btn-row">
                  <button
                    className="btn btn-sm"
                    onClick={() => setShowAdd(true)}
                  >
                    Add Book
                  </button>
                  <button
                    className="btn btn-sm btn-outline btn-icon"
                    onClick={
                      refreshingAll
                        ? () => setShowRefreshLog(true)
                        : handleRefreshAll
                    }
                    title={
                      refreshingAll
                        ? "Show refresh progress"
                        : "Refresh all books data"
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    {refreshingAll ? "Refreshing…" : "Refresh All"}
                  </button>
                </div>
              </div>

              <div className="search-top-bar">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by title, author or genre…"
                  className="search-bar-wide"
                />
                <button
                  type="button"
                  className={`search-icon-btn${
                    hasExtraBookFilters ? " has-filters" : ""
                  }`}
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                  title="Filters"
                >
                  {filtersOpen ? <XIcon /> : <FilterIcon />}
                  {hasExtraBookFilters && !filtersOpen && (
                    <span className="search-active-dot" />
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-icon view-toggle"
                  onClick={() =>
                    changeBooksView(booksView === "grid" ? "list" : "grid")
                  }
                  title={
                    booksView === "grid"
                      ? "Switch to list view"
                      : "Switch to grid view"
                  }
                >
                  {booksView === "grid" ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  )}
                </button>
              </div>

              {filtersOpen && (
                <div className="search-panel-filters admin-book-filters">
                  <Select
                    className="filter-select"
                    value={availFilter}
                    onChange={(e) => setAvailFilter(e.target.value)}
                  >
                    <option value="all">All copies</option>
                    <option value="available">Available</option>
                    <option value="out-of-stock">Out of stock</option>
                  </Select>
                  <Select
                    className="filter-select"
                    value={metaFilter}
                    onChange={(e) => setMetaFilter(e.target.value)}
                  >
                    <option value="all">All metadata</option>
                    <option value="complete">Complete</option>
                    <option value="incomplete">Incomplete</option>
                  </Select>
                  {hasExtraBookFilters && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={clearBookFilters}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {availableGenres.length > 0 && (
                <div className="genre-strip">
                  <button
                    className={`genre-card${!selectedGenre ? " active" : ""}`}
                    onClick={() => setSelectedGenre("")}
                  >
                    <span className="genre-card-name">All</span>
                    <span className="genre-card-count">{books.length}</span>
                  </button>
                  {availableGenres.map((genre) => (
                    <button
                      key={genre}
                      className={`genre-card${
                        selectedGenre === genre ? " active" : ""
                      }`}
                      onClick={() =>
                        setSelectedGenre(selectedGenre === genre ? "" : genre)
                      }
                    >
                      <span className="genre-card-name">{genre}</span>
                      <span className="genre-card-count">
                        {genreCounts[genre]}
                      </span>
                    </button>
                  ))}
                  <button
                    className="genre-card genre-card-add"
                    onClick={() => {
                      setNewGenreName("");
                      setGenreError("");
                      setShowAddGenre(true);
                    }}
                  >
                    <span className="genre-card-name">+ Genre</span>
                  </button>
                </div>
              )}

              {filteredBooks.length === 0 && (
                <div className="empty">
                  {search || selectedGenre || hasExtraBookFilters
                    ? "No books match your filters"
                    : "No books yet"}
                </div>
              )}
              {filteredBooks.length > 0 && booksView === "grid" && (
                <div className="books-grid admin-books-grid">
                  {filteredBooks.map((b) => {
                    const stars = b.avg_rating ? Math.round(b.avg_rating) : 0;
                    const missing = [
                      !b.description && "description",
                      !b.author_bio && "author bio",
                      !b.cover_url && "cover",
                    ].filter(Boolean);
                    return (
                      <div
                        key={b.id}
                        className="rec-card admin-book-card"
                        onClick={() => openBookDetail(b.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="admin-card-cover-wrap">
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
                          {missing.length > 0 && (
                            <span
                              className="admin-missing-badge"
                              title={`Missing: ${missing.join(", ")}`}
                            >
                              Incomplete
                            </span>
                          )}
                        </div>
                        <div className="rec-card-title">{b.title}</div>
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
                        <div className="admin-card-bottom-row">
                          <div className="rec-card-avail">
                            {b.available_copies} / {b.total_copies} available
                          </div>
                          <div
                            className="admin-card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderBookActions(b)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredBooks.length > 0 && booksView === "list" && (
                <div className="admin-book-list">
                  {filteredBooks.map((b) => {
                    const stars = b.avg_rating ? Math.round(b.avg_rating) : 0;
                    const missing = [
                      !b.description && "description",
                      !b.author_bio && "author bio",
                      !b.cover_url && "cover",
                    ].filter(Boolean);
                    return (
                      <div
                        key={b.id}
                        className="admin-list-row"
                        onClick={() => openBookDetail(b.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="admin-list-cover">
                          {b.cover_url ? (
                            <img src={b.cover_url} alt="" />
                          ) : (
                            <NoCoverPlaceholder title={b.title} />
                          )}
                          {missing.length > 0 && (
                            <span
                              className="admin-missing-dot"
                              title={`Missing: ${missing.join(", ")}`}
                            />
                          )}
                        </div>
                        <div className="admin-list-info">
                          <div className="admin-list-title">{b.title}</div>
                          <div className="admin-list-author">{b.author}</div>
                        </div>
                        <div className="admin-list-genre">
                          {b.genre || <span className="muted">—</span>}
                        </div>
                        <div className="admin-list-rating">
                          {b.rating_count > 0 ? (
                            <>
                              <span className="rec-stars">
                                {"★".repeat(stars)}
                                {"☆".repeat(5 - stars)}
                              </span>
                              <span className="rec-rating-val">
                                {b.avg_rating}
                              </span>
                            </>
                          ) : (
                            <span className="muted">No ratings</span>
                          )}
                        </div>
                        <div className="admin-list-avail">
                          {b.available_copies} / {b.total_copies} available
                        </div>
                        <div
                          className="admin-list-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderBookActions(b)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="section-header" style={{ marginTop: 40 }}>
                <button
                  type="button"
                  className="history-toggle"
                  onClick={() => setBookRequestHistoryOpen((o) => !o)}
                  aria-expanded={bookRequestHistoryOpen}
                >
                  <span
                    className={`history-toggle-chevron${
                      bookRequestHistoryOpen
                        ? " history-toggle-chevron-open"
                        : ""
                    }`}
                  >
                    <ColumnFilterArrow />
                  </span>
                  Book Request History
                </button>
              </div>
              {bookRequestHistoryOpen && (
                <>
                  <div className="btn-row" style={{ marginBottom: 16 }}>
                    {["", "approved", "rejected"].map((s) => (
                      <button
                        key={s || "all"}
                        className={`btn btn-sm${
                          bookRequestHistoryFilter === s ? "" : " btn-outline"
                        }`}
                        onClick={() => setBookRequestHistoryFilter(s)}
                      >
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                      </button>
                    ))}
                  </div>
                  {historyBookRequests.length === 0 ? (
                    <div className="empty">
                      No past book requests
                      {bookRequestHistoryFilter
                        ? ` with status "${bookRequestHistoryFilter}"`
                        : ""}
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Book</th>
                          <th>Notes</th>
                          <th>Status</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyBookRequests.map((r) => (
                          <tr key={r.id}>
                            <td>{r.username}</td>
                            <td>
                              {r.title}
                              <div
                                style={{ fontSize: "0.75rem", color: "#666" }}
                              >
                                {[r.author, r.genre]
                                  .filter(Boolean)
                                  .join(" · ") || (
                                  <span className="muted">—</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {r.notes || <span className="muted">—</span>}
                            </td>
                            <td>
                              <Badge
                                variant={
                                  r.status === "approved"
                                    ? "active"
                                    : "overdue"
                                }
                              >
                                {r.status.charAt(0).toUpperCase() +
                                  r.status.slice(1)}
                              </Badge>
                              {r.admin_notes && (
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#666",
                                    marginTop: 4,
                                  }}
                                  title={r.admin_notes}
                                >
                                  Note:{" "}
                                  {r.admin_notes.length > 40
                                    ? r.admin_notes.slice(0, 40) + "…"
                                    : r.admin_notes}
                                </div>
                              )}
                            </td>
                            <td>
                              {new Date(r.submitted_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Borrowed Books ── */}
          {tab === "borrows" && (
            <>
              <div className="section-header" data-tour="admin-borrows">
                <h3>Currently Borrowed</h3>
                {hasBorrowFilters && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={clearBorrowFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {borrows.length === 0 ? (
                <div className="empty">No active borrows</div>
              ) : (
                <table className="borrows-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="th-filter-wrap">
                          Book
                          <button
                            type="button"
                            className={`th-filter-btn${
                              borrowBookFilter ? " th-filter-btn-active" : ""
                            }`}
                            ref={
                              openBorrowFilter === "book"
                                ? borrowFilterBtnRef
                                : null
                            }
                            onClick={() => toggleBorrowFilter("book")}
                            aria-label="Filter by book"
                            aria-expanded={openBorrowFilter === "book"}
                          >
                            <ColumnFilterArrow />
                          </button>
                        </span>
                      </th>
                      <th>
                        <span className="th-filter-wrap">
                          Borrower
                          <button
                            type="button"
                            className={`th-filter-btn${
                              borrowBorrowerFilter
                                ? " th-filter-btn-active"
                                : ""
                            }`}
                            ref={
                              openBorrowFilter === "borrower"
                                ? borrowFilterBtnRef
                                : null
                            }
                            onClick={() => toggleBorrowFilter("borrower")}
                            aria-label="Filter by borrower"
                            aria-expanded={openBorrowFilter === "borrower"}
                          >
                            <ColumnFilterArrow />
                          </button>
                        </span>
                      </th>
                      <th>
                        <span className="th-filter-wrap">
                          Tags
                          <button
                            type="button"
                            className={`th-filter-btn${
                              borrowStatusFilter ? " th-filter-btn-active" : ""
                            }`}
                            ref={
                              openBorrowFilter === "status"
                                ? borrowFilterBtnRef
                                : null
                            }
                            onClick={() => toggleBorrowFilter("status")}
                            aria-label="Filter by tag"
                            aria-expanded={openBorrowFilter === "status"}
                          >
                            <TagIcon />
                          </button>
                        </span>
                      </th>
                      <th>Borrow Date</th>
                      <th>Due Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBorrows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          No borrows match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredBorrows.map((b) => (
                        <tr key={b.id}>
                          <td>{b.book_title}</td>
                          <td>{b.username}</td>
                          <td>
                            <span
                              className={`status-tag${
                                b.is_overdue
                                  ? " status-tag-overdue"
                                  : " status-tag-active"
                              }`}
                            >
                              {b.is_overdue
                                ? "Overdue"
                                : dueInDaysLabel(b.due_date)}
                            </span>
                            {b.return_requested_at && (
                              <span className="status-tag status-tag-queue">
                                Return Requested
                              </span>
                            )}
                            {b.fine_payment_requested_at && (
                              <span className="status-tag status-tag-queue">
                                Fine Payment ${b.fine.toFixed(2)} Pending
                              </span>
                            )}
                          </td>
                          <td>
                            {new Date(b.borrow_date).toLocaleDateString()}
                          </td>
                          <td>{new Date(b.due_date).toLocaleDateString()}</td>
                          <td className="col-action">
                            {b.return_requested_at && (
                              <div className="borrow-return-actions">
                                <button
                                  className="btn btn-sm"
                                  disabled={processingReturnId === b.id}
                                  onClick={() => approveReturn(b.id)}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-sm btn-outline"
                                  disabled={processingReturnId === b.id}
                                  onClick={() => rejectReturn(b.id)}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              <ActionMenu
                open={!!openBorrowFilter}
                anchorRef={borrowFilterBtnRef}
                onClose={() => setOpenBorrowFilter(null)}
              >
                {openBorrowFilter && (
                  <>
                    <div className="custom-select-search-wrap">
                      <input
                        ref={borrowFilterSearchRef}
                        type="text"
                        className="custom-select-search"
                        placeholder="Search…"
                        value={borrowFilterSearch}
                        onChange={(e) => setBorrowFilterSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setOpenBorrowFilter(null);
                        }}
                      />
                    </div>
                    <div className="action-menu-scroll">
                      {visibleBorrowFilterOptions.length === 0 ? (
                        <div className="custom-select-no-match">No matches</div>
                      ) : (
                        visibleBorrowFilterOptions.map((opt) => (
                          <button
                            key={opt.value}
                            className={`action-menu-item${
                              borrowFilterMenus[openBorrowFilter].value ===
                              opt.value
                                ? " action-menu-item-active"
                                : ""
                            }`}
                            onClick={() => {
                              borrowFilterMenus[openBorrowFilter].setValue(
                                opt.value
                              );
                              setOpenBorrowFilter(null);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </ActionMenu>
            </>
          )}

          {/* ── Fines ── */}
          {tab === "fines" && (
            <>
              <div className="section-header" data-tour="admin-fines">
                <h3>Pending Fines</h3>
                {fines.length > 0 && (
                  <span
                    className="fine-amount"
                    style={{ fontSize: "0.9rem", fontWeight: 600 }}
                  >
                    {fines.length} unpaid · $
                    {fines.reduce((s, f) => s + f.fine, 0).toFixed(2)} total
                  </span>
                )}
              </div>
              {fines.length === 0 ? (
                <div className="empty">No pending fines</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>User</th>
                      <th>Due Date</th>
                      <th>Fine</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map((b) => (
                      <tr key={b.id}>
                        <td>{b.book_title}</td>
                        <td>{b.username}</td>
                        <td>{new Date(b.due_date).toLocaleDateString()}</td>
                        <td className="fine-amount">${b.fine.toFixed(2)}</td>
                        <td>
                          {b.return_date ? (
                            <span className="status-tag status-tag-returned">
                              Returned Late
                            </span>
                          ) : (
                            <span className="status-tag status-tag-overdue">
                              Overdue
                            </span>
                          )}
                        </td>
                        <td>
                          <label className="mark-paid-checkbox">
                            <input
                              type="checkbox"
                              checked={false}
                              disabled={markingPaidId === b.id}
                              onChange={() => markFinePaid(b.id)}
                            />
                            {markingPaidId === b.id ? "Saving…" : "Mark Paid"}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="section-header" style={{ marginTop: 40 }}>
                <h3>Fine History</h3>
                {fineHistory.length > 0 && (
                  <span
                    className="fine-amount"
                    style={{ fontSize: "0.9rem", fontWeight: 600 }}
                  >
                    {fineHistory.length} paid · $
                    {fineHistory.reduce((s, f) => s + f.fine, 0).toFixed(2)}{" "}
                    total
                  </span>
                )}
              </div>
              {fineHistory.length === 0 ? (
                <div className="empty">No fines paid yet</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>User</th>
                      <th>Due Date</th>
                      <th>Fine</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fineHistory.map((b) => (
                      <tr key={b.id}>
                        <td>{b.book_title}</td>
                        <td>{b.username}</td>
                        <td>{new Date(b.due_date).toLocaleDateString()}</td>
                        <td className="fine-amount">${b.fine.toFixed(2)}</td>
                        <td>
                          <span className="status-tag status-tag-returned">
                            Paid
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="section-header" style={{ marginTop: 40 }}>
                <h3>Fine Policy</h3>
              </div>
              {policy && (
                <form className="policy-form" onSubmit={savePolicy}>
                  {policyError && <div className="error">{policyError}</div>}
                  <div className="form-group">
                    <label>Fine Per Day ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={policyForm.fine_per_day}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          fine_per_day: e.target.value,
                        })
                      }
                      required
                    />
                    <p className="field-hint">
                      Charged per day a book is overdue
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Borrow Duration (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={policyForm.borrow_days}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          borrow_days: e.target.value,
                        })
                      }
                      required
                    />
                    <p className="field-hint">Applies to new borrows only</p>
                  </div>
                  <button type="submit" className="btn btn-sm">
                    Save Policy
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── Members ── */}
          {tab === "members" && (
            <>
              {membershipRequestsLoaded && pendingMembershipRequests.length > 0 && (
                <>
                  <div className="section-header">
                    <h3>Membership Requests</h3>
                    <span
                      className="fine-amount"
                      style={{ fontSize: "0.9rem", fontWeight: 600 }}
                    >
                      {pendingMembershipRequests.length} pending
                    </span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Requested Tier</th>
                        <th>Notes</th>
                        <th>Submitted</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMembershipRequests.map((r) => (
                        <tr key={r.id}>
                          <td>{r.username}</td>
                          <td>
                            <span
                              className={`membership-badge membership-badge-${r.requested_tier}`}
                            >
                              {r.requested_tier.charAt(0).toUpperCase() +
                                r.requested_tier.slice(1)}
                            </span>
                          </td>
                          <td>{r.notes || <span className="muted">—</span>}</td>
                          <td>
                            {new Date(r.submitted_at).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="btn-row">
                              <button
                                className="btn btn-sm"
                                onClick={() => openApproveMembershipRequest(r)}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => openRejectMembershipRequest(r)}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div
                className="section-header"
                style={{
                  marginTop:
                    membershipRequestsLoaded &&
                    pendingMembershipRequests.length > 0
                      ? 40
                      : 0,
                }}
              >
                <h3>Membership Pricing</h3>
              </div>
              {membershipPricing && (
                <form
                  className="membership-pricing-form"
                  onSubmit={saveMembershipPricing}
                >
                  {membershipPricingError && (
                    <div className="error">{membershipPricingError}</div>
                  )}
                  <div className="tier-pricing-grid">
                    <div className="tier-pricing-card">
                      <div className="tier-pricing-name">Silver</div>
                      <div className="tier-pricing-desc">
                        1 book at a time · Standard access
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Monthly Rate ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={membershipPricingForm.silver_rate}
                          onChange={(e) =>
                            setMembershipPricingForm({
                              ...membershipPricingForm,
                              silver_rate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="tier-pricing-card tier-pricing-card-gold">
                      <div className="tier-pricing-name">Gold</div>
                      <div className="tier-pricing-desc">
                        3 books at a time · Community & Games access
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Monthly Rate ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={membershipPricingForm.gold_rate}
                          onChange={(e) =>
                            setMembershipPricingForm({
                              ...membershipPricingForm,
                              gold_rate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="tier-pricing-card">
                      <div className="tier-pricing-name">Family</div>
                      <div className="tier-pricing-desc">
                        Up to 4 members · 1 book each · Shared plan
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Monthly Rate ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={membershipPricingForm.family_rate}
                          onChange={(e) =>
                            setMembershipPricingForm({
                              ...membershipPricingForm,
                              family_rate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <p className="field-hint" style={{ marginBottom: 12 }}>
                    Gold rate must be higher than Silver; Family rate is for the
                    whole group
                  </p>
                  <button type="submit" className="btn btn-sm">
                    Save Pricing
                  </button>
                </form>
              )}

              <div className="section-header" style={{ marginTop: 40 }}>
                <h3>Member Overview</h3>
              </div>

              <div className="member-stats">
                <div className="member-stat">
                  <span className="member-stat-label">Total members</span>
                  <span className="member-stat-value">
                    {memberStats.totalMembers}
                  </span>
                </div>
                <div className="member-stat">
                  <span className="member-stat-label">
                    Currently borrowed
                  </span>
                  <span className="member-stat-value">
                    {memberStats.currentlyBorrowed}
                  </span>
                </div>
                <div className="member-stat">
                  <span className="member-stat-label">Fines pending</span>
                  <span
                    className={`member-stat-value${
                      memberStats.finesPending > 0 ? " fine-amount" : ""
                    }`}
                  >
                    ${memberStats.finesPending.toFixed(2)}
                  </span>
                </div>
                <div className="member-stat">
                  <span className="member-stat-label">Fines collected</span>
                  <span className="member-stat-value member-stat-value-good">
                    ${memberStats.finesPaid.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="member-charts">
                <div className="member-chart-card">
                  <div className="member-chart-title">Members by tier</div>
                  <div className="bar-chart">
                    {memberStats.tiers.map((t) => (
                      <div className="bar-chart-row" key={t.key}>
                        <span className="bar-chart-row-label">{t.label}</span>
                        <div className="bar-chart-track">
                          <div
                            className={`bar-chart-fill bar-chart-fill-tier-${t.key}`}
                            tabIndex={0}
                            title={`${t.label}: ${t.count} member${
                              t.count === 1 ? "" : "s"
                            }`}
                            style={{
                              width: `${
                                (t.count / memberStats.maxTierCount) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="bar-chart-row-value">
                          {t.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="member-chart-card">
                  <div className="member-chart-title">Top borrowers</div>
                  {memberStats.topBorrowers.length === 0 ? (
                    <div className="empty">No borrows yet</div>
                  ) : (
                    <div className="bar-chart">
                      {memberStats.topBorrowers.map((m) => (
                        <div className="bar-chart-row" key={m.id}>
                          <span className="bar-chart-row-label">
                            {m.username}
                          </span>
                          <div className="bar-chart-track">
                            <div
                              className="bar-chart-fill bar-chart-fill-accent"
                              tabIndex={0}
                              title={`${m.username}: ${m.total_borrows} total borrows`}
                              style={{
                                width: `${
                                  (m.total_borrows / memberStats.maxBorrows) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="bar-chart-row-value">
                            {m.total_borrows}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="section-header"
                style={{ marginTop: 40 }}
                data-tour="admin-members"
              >
                <h3>Member Records</h3>
                {hasMemberFilters && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={clearMemberFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {!membersLoaded ? (
                <div className="empty">Loading…</div>
              ) : members.length === 0 ? (
                <div className="empty">No members registered</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>
                        <span className="th-filter-wrap">
                          Username
                          <button
                            type="button"
                            className={`th-filter-btn${
                              memberUsernameFilter ? " th-filter-btn-active" : ""
                            }`}
                            ref={
                              openMemberFilter === "username"
                                ? memberFilterBtnRef
                                : null
                            }
                            onClick={() => toggleMemberFilter("username")}
                            aria-label="Filter by username"
                            aria-expanded={openMemberFilter === "username"}
                          >
                            <ColumnFilterArrow />
                          </button>
                        </span>
                      </th>
                      <th>
                        <span className="th-filter-wrap">
                          Tier
                          <button
                            type="button"
                            className={`th-filter-btn${
                              memberTierFilter ? " th-filter-btn-active" : ""
                            }`}
                            ref={
                              openMemberFilter === "tier"
                                ? memberFilterBtnRef
                                : null
                            }
                            onClick={() => toggleMemberFilter("tier")}
                            aria-label="Filter by tier"
                            aria-expanded={openMemberFilter === "tier"}
                          >
                            <TagIcon />
                          </button>
                        </span>
                      </th>
                      <th>Family Group</th>
                      <th>Currently Borrowed</th>
                      <th>Total Borrows</th>
                      <th>Fines Pending</th>
                      <th>Fines Paid</th>
                      <th>Change Tier</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="empty">
                          No members match your filters
                        </td>
                      </tr>
                    ) : (
                    filteredMembers.map((m) => (
                      <tr key={m.id}>
                        <td>{m.username}</td>
                        <td>
                          {m.membership_tier ? (
                            <span
                              className={`membership-badge membership-badge-${m.membership_tier}`}
                            >
                              {m.membership_tier.charAt(0).toUpperCase() +
                                m.membership_tier.slice(1)}
                            </span>
                          ) : (
                            <span className="muted">None</span>
                          )}
                        </td>
                        <td>
                          {m.family_group_id != null ? (
                            `Group ${m.family_group_id}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{m.currently_borrowed}</td>
                        <td>{m.total_borrows}</td>
                        <td
                          className={m.fines_pending > 0 ? "fine-amount" : ""}
                        >
                          {m.fines_pending > 0 ? (
                            `$${m.fines_pending.toFixed(2)}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {m.fines_paid > 0 ? (
                            `$${m.fines_paid.toFixed(2)}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <Select
                            className="filter-select"
                            value={m.membership_tier || ""}
                            onChange={(e) =>
                              changeMemberTier(m.id, e.target.value)
                            }
                          >
                            <option value="">None</option>
                            <option value="silver">Silver</option>
                            <option value="gold">Gold</option>
                            <option value="family">Family</option>
                          </Select>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => openMember(m)}
                          >
                            View Records
                          </button>
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              )}

              <div className="section-header" style={{ marginTop: 40 }}>
                <button
                  type="button"
                  className="history-toggle"
                  onClick={() => setMembershipRequestHistoryOpen((o) => !o)}
                  aria-expanded={membershipRequestHistoryOpen}
                >
                  <span
                    className={`history-toggle-chevron${
                      membershipRequestHistoryOpen
                        ? " history-toggle-chevron-open"
                        : ""
                    }`}
                  >
                    <ColumnFilterArrow />
                  </span>
                  Membership Request History
                </button>
              </div>
              {membershipRequestHistoryOpen && (
                <>
                  <div className="btn-row" style={{ marginBottom: 16 }}>
                    {["", "approved", "rejected"].map((s) => (
                      <button
                        key={s || "all"}
                        className={`btn btn-sm${
                          membershipRequestHistoryFilter === s
                            ? ""
                            : " btn-outline"
                        }`}
                        onClick={() => setMembershipRequestHistoryFilter(s)}
                      >
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                      </button>
                    ))}
                  </div>
                  {historyMembershipRequests.length === 0 ? (
                    <div className="empty">
                      No past membership requests
                      {membershipRequestHistoryFilter
                        ? ` with status "${membershipRequestHistoryFilter}"`
                        : ""}
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Requested Tier</th>
                          <th>Notes</th>
                          <th>Status</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyMembershipRequests.map((r) => (
                          <tr key={r.id}>
                            <td>{r.username}</td>
                            <td>
                              <span
                                className={`membership-badge membership-badge-${r.requested_tier}`}
                              >
                                {r.requested_tier.charAt(0).toUpperCase() +
                                  r.requested_tier.slice(1)}
                              </span>
                            </td>
                            <td>
                              {r.notes || <span className="muted">—</span>}
                            </td>
                            <td>
                              <Badge
                                variant={
                                  r.status === "approved"
                                    ? "active"
                                    : "overdue"
                                }
                              >
                                {r.status.charAt(0).toUpperCase() +
                                  r.status.slice(1)}
                              </Badge>
                              {r.admin_notes && (
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#666",
                                    marginTop: 4,
                                  }}
                                  title={r.admin_notes}
                                >
                                  Note:{" "}
                                  {r.admin_notes.length > 40
                                    ? r.admin_notes.slice(0, 40) + "…"
                                    : r.admin_notes}
                                </div>
                              )}
                            </td>
                            <td>
                              {new Date(r.submitted_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              <ActionMenu
                open={!!openMemberFilter}
                anchorRef={memberFilterBtnRef}
                onClose={() => setOpenMemberFilter(null)}
              >
                {openMemberFilter && (
                  <>
                    <div className="custom-select-search-wrap">
                      <input
                        ref={memberFilterSearchRef}
                        type="text"
                        className="custom-select-search"
                        placeholder="Search…"
                        value={memberFilterSearch}
                        onChange={(e) => setMemberFilterSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setOpenMemberFilter(null);
                        }}
                      />
                    </div>
                    <div className="action-menu-scroll">
                      {visibleMemberFilterOptions.length === 0 ? (
                        <div className="custom-select-no-match">No matches</div>
                      ) : (
                        visibleMemberFilterOptions.map((opt) => (
                          <button
                            key={opt.value}
                            className={`action-menu-item${
                              memberFilterMenus[openMemberFilter].value ===
                              opt.value
                                ? " action-menu-item-active"
                                : ""
                            }`}
                            onClick={() => {
                              memberFilterMenus[openMemberFilter].setValue(
                                opt.value
                              );
                              setOpenMemberFilter(null);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </ActionMenu>
            </>
          )}

          {/* ── Communities ── */}
          {tab === "communities" && (
            <>
              <div className="section-header" data-tour="admin-communities">
                <h3>Community Requests</h3>
              </div>
              {!adminCommunitiesLoaded ? (
                <div className="empty">Loading…</div>
              ) : adminCommunities.length === 0 ? (
                <div className="empty">No community requests yet</div>
              ) : (
                <div className="kanban-board">
                  {["pending", "approved", "rejected"].map((status) => {
                    const columnCommunities = adminCommunities.filter(
                      (c) => c.status === status
                    );
                    return (
                      <div className="kanban-column" key={status}>
                        <div className="kanban-column-header">
                          <span
                            className={`kanban-column-dot kanban-column-dot-${status}`}
                          />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                          <span className="kanban-column-count">
                            {columnCommunities.length}
                          </span>
                        </div>
                        <div className="kanban-column-body">
                          {columnCommunities.length === 0 ? (
                            <div className="kanban-empty">Nothing here</div>
                          ) : (
                            columnCommunities.map((c) => (
                              <div className="kanban-card" key={c.id}>
                                <div className="kanban-card-title">
                                  {c.name}
                                </div>
                                <div className="kanban-card-desc">
                                  {c.description || (
                                    <span className="muted">
                                      No description
                                    </span>
                                  )}
                                </div>
                                <div className="kanban-card-meta">
                                  <span>{c.creator_username}</span>
                                  <span>{c.member_count} members</span>
                                  <span>{c.post_count} posts</span>
                                </div>
                                <div className="kanban-card-date">
                                  {new Date(
                                    c.created_at
                                  ).toLocaleDateString()}
                                </div>
                                {status === "pending" && (
                                  <div className="btn-row kanban-card-actions">
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => {
                                        setApprovingCommunity(c);
                                        setCommunityApproveNotes("");
                                        setCommunityApproveError("");
                                      }}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline"
                                      onClick={() => {
                                        setRejectingCommunity(c);
                                        setCommunityRejectNotes("");
                                        setCommunityRejectError("");
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                                {c.admin_notes && (
                                  <div
                                    className="kanban-card-note"
                                    title={c.admin_notes}
                                  >
                                    Note:{" "}
                                    {c.admin_notes.length > 40
                                      ? c.admin_notes.slice(0, 40) + "…"
                                      : c.admin_notes}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Donations ── */}
          {tab === "donations" && (
            <>
              <div className="section-header" data-tour="admin-donations">
                <h3>Book Donations</h3>
              </div>
              {!donationsLoaded ? (
                <div className="empty">Loading…</div>
              ) : donations.length === 0 ? (
                <div className="empty">No donations yet</div>
              ) : (
                <div className="kanban-board">
                  {["pending", "approved", "rejected"].map((status) => {
                    const columnDonations = donations.filter(
                      (d) => d.status === status
                    );
                    return (
                      <div className="kanban-column" key={status}>
                        <div className="kanban-column-header">
                          <span
                            className={`kanban-column-dot kanban-column-dot-${status}`}
                          />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                          <span className="kanban-column-count">
                            {columnDonations.length}
                          </span>
                        </div>
                        <div className="kanban-column-body">
                          {columnDonations.length === 0 ? (
                            <div className="kanban-empty">Nothing here</div>
                          ) : (
                            columnDonations.map((d) => (
                              <div className="kanban-card" key={d.id}>
                                <div className="kanban-card-title">
                                  {d.title}
                                </div>
                                <div className="kanban-card-desc">
                                  {d.author}
                                  {d.genre ? ` · ${d.genre}` : ""}
                                  {d.isbn ? ` · ISBN-13: ${d.isbn}` : ""}
                                </div>
                                <div className="kanban-card-meta">
                                  <span>{d.username}</span>
                                  <span style={{ textTransform: "capitalize" }}>
                                    {d.condition}
                                  </span>
                                  <span>
                                    ${d.estimated_price.toFixed(2)} est.
                                  </span>
                                  {d.credit_amount != null && (
                                    <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                                      ${d.credit_amount.toFixed(2)} credit
                                    </span>
                                  )}
                                </div>
                                <div className="kanban-card-date">
                                  {new Date(
                                    d.submitted_at
                                  ).toLocaleDateString()}
                                </div>
                                {d.status === "pending" && (
                                  <div className="btn-row kanban-card-actions">
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => openApprove(d)}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline"
                                      onClick={() => openReject(d)}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                                {d.admin_notes && (
                                  <div
                                    className="kanban-card-note"
                                    title={d.admin_notes}
                                  >
                                    Note:{" "}
                                    {d.admin_notes.length > 40
                                      ? d.admin_notes.slice(0, 40) + "…"
                                      : d.admin_notes}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>

        {/* ── Refresh Log Panel ── */}
        {showRefreshLog && (
          <div className="refresh-panel">
            <div className="refresh-panel-header">
              <span className="refresh-panel-title">{refreshModalTitle}</span>
              <button
                className="modal-close-btn"
                onClick={() => setShowRefreshLog(false)}
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
                              openManualEdit(refreshBookId, "description")
                            }
                          >
                            Description
                          </button>
                        )}
                        {missingBio && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() =>
                              openManualEdit(refreshBookId, "author_bio")
                            }
                          >
                            Author bio
                          </button>
                        )}
                        {missingCover && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => openCoverUpload(refreshBookId)}
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
        )}

        {/* ── Re-auth Modal ── */}
        {reAuthFor && (
          <Modal
            title="Confirm Your Identity"
            onClose={() => setReAuthFor(null)}
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
                onKeyDown={(e) => e.key === "Enter" && confirmReAuth()}
                autoFocus
                placeholder="Enter your password"
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                className="btn btn-sm"
                onClick={confirmReAuth}
                disabled={reAuthLoading || !reAuthPassword}
              >
                {reAuthLoading ? "Verifying…" : "Confirm"}
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setReAuthFor(null)}
              >
                Cancel
              </button>
            </div>
          </Modal>
        )}

        {/* ── Approve Community Modal ── */}
        {approvingCommunity && (
          <Modal
            title="Approve Community"
            onClose={() => setApprovingCommunity(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Approving <strong>{approvingCommunity.name}</strong> created by{" "}
              <strong>{approvingCommunity.creator_username}</strong>. The
              creator will automatically be added as a moderator.
            </p>
            <form onSubmit={submitApproveCommunity}>
              {communityApproveError && (
                <div className="error">{communityApproveError}</div>
              )}
              <div className="form-group">
                <label>
                  Admin notes{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  value={communityApproveNotes}
                  onChange={(e) => setCommunityApproveNotes(e.target.value)}
                  placeholder="Any notes for the community creator…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setApprovingCommunity(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  Confirm Approval
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Reject Community Modal ── */}
        {rejectingCommunity && (
          <Modal
            title="Reject Community"
            onClose={() => setRejectingCommunity(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Rejecting <strong>{rejectingCommunity.name}</strong> submitted by{" "}
              <strong>{rejectingCommunity.creator_username}</strong>.
            </p>
            <form onSubmit={submitRejectCommunity}>
              {communityRejectError && (
                <div className="error">{communityRejectError}</div>
              )}
              <div className="form-group">
                <label>
                  Reason{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional — shown to creator)
                  </span>
                </label>
                <input
                  value={communityRejectNotes}
                  onChange={(e) => setCommunityRejectNotes(e.target.value)}
                  placeholder="e.g. Duplicate community, inappropriate name…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setRejectingCommunity(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-outline">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Approve Donation Modal ── */}
        {approvingDonation && (
          <Modal
            title="Approve Donation"
            onClose={() => setApprovingDonation(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Approving <strong>{approvingDonation.title}</strong> by{" "}
              {approvingDonation.author} donated by{" "}
              <strong>{approvingDonation.username}</strong>. The book will be
              added to the catalogue with 1 copy.
            </p>
            <form onSubmit={submitApprove}>
              {approveError && <div className="error">{approveError}</div>}
              <div className="form-group">
                <label>Credit to award ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approveCredit}
                  onChange={(e) => setApproveCredit(e.target.value)}
                  required
                />
                <p className="field-hint">
                  Default is 1/4 of estimated value ($
                  {(approvingDonation.estimated_price / 4).toFixed(2)}). You can
                  adjust this.
                </p>
              </div>
              <div className="form-group">
                <label>
                  Admin notes{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Any notes for the member…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setApprovingDonation(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  Confirm Approval
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Reject Donation Modal ── */}
        {rejectingDonation && (
          <Modal
            title="Reject Donation"
            onClose={() => setRejectingDonation(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Rejecting <strong>{rejectingDonation.title}</strong> donated by{" "}
              <strong>{rejectingDonation.username}</strong>.
            </p>
            <form onSubmit={submitReject}>
              {rejectError && <div className="error">{rejectError}</div>}
              <div className="form-group">
                <label>
                  Reason{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional — shown to member)
                  </span>
                </label>
                <input
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="e.g. Duplicate, poor condition, not in our catalogue…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setRejectingDonation(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-outline">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Approve Membership Request Modal ── */}
        {approvingMembershipRequest && (
          <Modal
            title="Approve Membership Request"
            onClose={() => setApprovingMembershipRequest(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Approving{" "}
              <strong>
                {approvingMembershipRequest.requested_tier
                  .charAt(0)
                  .toUpperCase() +
                  approvingMembershipRequest.requested_tier.slice(1)}
              </strong>{" "}
              membership for{" "}
              <strong>{approvingMembershipRequest.username}</strong>. Their tier
              will activate immediately.
            </p>
            <form onSubmit={submitApproveMembershipRequest}>
              {approveMembershipError && (
                <div className="error">{approveMembershipError}</div>
              )}
              <div className="form-group">
                <label>
                  Admin notes{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  value={approveMembershipNotes}
                  onChange={(e) => setApproveMembershipNotes(e.target.value)}
                  placeholder="Any notes for the member…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setApprovingMembershipRequest(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  Confirm Approval
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Reject Membership Request Modal ── */}
        {rejectingMembershipRequest && (
          <Modal
            title="Reject Membership Request"
            onClose={() => setRejectingMembershipRequest(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Rejecting the membership request from{" "}
              <strong>{rejectingMembershipRequest.username}</strong>.
            </p>
            <form onSubmit={submitRejectMembershipRequest}>
              {rejectMembershipError && (
                <div className="error">{rejectMembershipError}</div>
              )}
              <div className="form-group">
                <label>
                  Reason{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional — shown to member)
                  </span>
                </label>
                <input
                  value={rejectMembershipNotes}
                  onChange={(e) => setRejectMembershipNotes(e.target.value)}
                  placeholder="e.g. Payment not received yet…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setRejectingMembershipRequest(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-outline">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Approve Book Request Modal ── */}
        {approvingBookRequest && (
          <Modal
            title="Approve Book Request"
            onClose={() => setApprovingBookRequest(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Approving <strong>{approvingBookRequest.username}</strong>'s
              request. Review the details below, then add it to the catalogue.
            </p>
            <form onSubmit={submitApproveBookRequest}>
              {approveBookError && (
                <div className="error">{approveBookError}</div>
              )}
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={approveBookTitle}
                  onChange={(e) => setApproveBookTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Author *</label>
                <input
                  value={approveBookAuthor}
                  onChange={(e) => setApproveBookAuthor(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  ISBN-13{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  value={approveBookIsbn}
                  onChange={(e) => setApproveBookIsbn(e.target.value)}
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
                  value={approveBookGenre}
                  onChange={(e) => setApproveBookGenre(e.target.value)}
                >
                  <option value="">Select genre</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>Copies to add</label>
                <input
                  type="number"
                  min="1"
                  value={approveBookCopies}
                  onChange={(e) => setApproveBookCopies(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>
                  Admin notes{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  value={approveBookNotes}
                  onChange={(e) => setApproveBookNotes(e.target.value)}
                  placeholder="Any notes for the member…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setApprovingBookRequest(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm">
                  Confirm Approval
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Reject Book Request Modal ── */}
        {rejectingBookRequest && (
          <Modal
            title="Reject Book Request"
            onClose={() => setRejectingBookRequest(null)}
          >
            <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#555" }}>
              Rejecting the request for{" "}
              <strong>"{rejectingBookRequest.title}"</strong> from{" "}
              <strong>{rejectingBookRequest.username}</strong>.
            </p>
            <form onSubmit={submitRejectBookRequest}>
              {rejectBookError && (
                <div className="error">{rejectBookError}</div>
              )}
              <div className="form-group">
                <label>
                  Reason{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (optional — shown to member)
                  </span>
                </label>
                <input
                  value={rejectBookNotes}
                  onChange={(e) => setRejectBookNotes(e.target.value)}
                  placeholder="e.g. Couldn't source this title…"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setRejectingBookRequest(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-outline">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Add Book Modal ── */}
        {showAddGenre && (
          <Modal title="Add Genre" onClose={() => setShowAddGenre(false)}>
            <form onSubmit={addGenre}>
              {genreError && <div className="error">{genreError}</div>}
              <div className="form-group">
                <label>Genre name</label>
                <input
                  value={newGenreName}
                  onChange={(e) => setNewGenreName(e.target.value)}
                  placeholder="e.g. Fantasy"
                  autoFocus
                  required
                />
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-4)",
                    marginTop: 4,
                  }}
                >
                  Letters only (a–z). First letter will be capitalised
                  automatically.
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowAddGenre(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={genreSaving}
                >
                  {genreSaving ? "Saving…" : "Add Genre"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {showAdd && (
          <Modal
            title="Add Book"
            subtitle="Add a new title to the library catalogue."
            wide
            onClose={() => {
              setShowAdd(false);
              setBookError("");
            }}
          >
            <form onSubmit={addBook} className="modal-form-grid">
              {bookError && <div className="error">{bookError}</div>}
              <div className="form-group form-group-full">
                <label>Title</label>
                <input {...bookField("title")} required autoFocus />
              </div>
              <div className="form-group">
                <label>Author</label>
                <input {...bookField("author")} required />
              </div>
              <div className="form-group">
                <label>ISBN-13</label>
                <input {...bookField("isbn")} required />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <Select {...bookField("genre")}>
                  <option value="">Select genre</option>
                  {allGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>Copies</label>
                <input
                  type="number"
                  min="1"
                  {...bookField("total_copies")}
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setShowAdd(false);
                    setBookError("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Add Book
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Book Detail Modal ── */}
        {selectedBook && (
          <Modal
            title={selectedBook.title}
            onClose={closeBookDetail}
            wide
            heroBg={coverPalette?.bg ?? "var(--bg-raised)"}
            heroTextColor={coverPalette?.text ?? "var(--text)"}
            heroContent={
              <div className="book-detail-header">
                {selectedBook.cover_url ? (
                  <div className="admin-cover-slot">
                    <img
                      src={selectedBook.cover_url}
                      alt={`Cover of ${selectedBook.title}`}
                      className="book-cover-img"
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openCoverUpload(selectedBook.id)}
                    >
                      Change cover
                    </button>
                  </div>
                ) : (
                  <div className="admin-cover-slot">
                    <div className="book-cover-placeholder">
                      <NoCoverPlaceholder title={selectedBook.title} />
                    </div>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openCoverUpload(selectedBook.id)}
                    >
                      + Add cover
                    </button>
                  </div>
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
                      ISBN-13
                    </span>
                    <span>{selectedBook.isbn}</span>
                  </div>
                  <div className="book-detail-row" style={heroRowStyle}>
                    <span className="book-detail-label" style={heroLabelStyle}>
                      Copies
                    </span>
                    <span>
                      {selectedBook.available_copies} /{" "}
                      {selectedBook.total_copies} available
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
                          <span className="star-display">
                            {"★".repeat(Math.round(bookReviews.avg_rating))}
                            {"☆".repeat(5 - Math.round(bookReviews.avg_rating))}
                          </span>
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
                  <div className="book-detail-action">
                    <button
                      className="btn btn-sm btn-icon btn-icon-ghost"
                      onClick={() => {
                        closeBookDetail();
                        openEdit(selectedBook);
                      }}
                      aria-label="Edit book"
                      title="Edit book"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <div className="action-menu-wrap">
                      <button
                        className="btn btn-sm btn-icon btn-icon-ghost"
                        ref={bookDetailMenuRef}
                        onClick={() => setBookDetailMenuOpen((o) => !o)}
                        aria-label="More actions"
                        aria-expanded={bookDetailMenuOpen}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="12" cy="19" r="1.8" />
                        </svg>
                      </button>
                      <ActionMenu
                        open={bookDetailMenuOpen}
                        anchorRef={bookDetailMenuRef}
                        onClose={() => setBookDetailMenuOpen(false)}
                      >
                        <button
                          className="action-menu-item"
                          onClick={() => {
                            setBookDetailMenuOpen(false);
                            closeBookDetail();
                            openLogs(selectedBook);
                          }}
                        >
                          Logs
                        </button>
                        <button
                          className="action-menu-item"
                          onClick={() => {
                            setBookDetailMenuOpen(false);
                            refreshingBookId === selectedBook.id
                              ? setShowRefreshLog(true)
                              : refreshMeta(selectedBook.id);
                          }}
                          disabled={refreshingAll}
                        >
                          {refreshingBookId === selectedBook.id
                            ? "Refreshing…"
                            : "Refresh metadata"}
                        </button>
                        <div className="action-menu-divider" />
                        <button
                          className="action-menu-item action-menu-danger"
                          onClick={() => {
                            setBookDetailMenuOpen(false);
                            closeBookDetail();
                            deleteBook(selectedBook.id);
                          }}
                        >
                          Delete
                        </button>
                      </ActionMenu>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            {selectedBook.description ? (
              <div className="enrichment-section">
                <div className="enrichment-label-row">
                  <span className="enrichment-label">About this book</span>
                  <button
                    className="btn-link"
                    onClick={() => openAiGen(selectedBook.id, "description")}
                  >
                    Edit
                  </button>
                </div>
                <p className="enrichment-text">{selectedBook.description}</p>
              </div>
            ) : (
              <div className="enrichment-section">
                <div className="enrichment-label">About this book</div>
                <p className="enrichment-text muted">No description yet.</p>
                <div className="btn-row">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() =>
                      openManualEdit(selectedBook.id, "description")
                    }
                  >
                    Write manually
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => openAiGen(selectedBook.id, "description")}
                  >
                    Generate with AI
                  </button>
                </div>
              </div>
            )}
            {selectedBook.author_bio ? (
              <div className="enrichment-section">
                <div className="enrichment-label-row">
                  <span className="enrichment-label">About the author</span>
                  <button
                    className="btn-link"
                    onClick={() => openAiGen(selectedBook.id, "author_bio")}
                  >
                    Edit
                  </button>
                </div>
                <p className="enrichment-text">
                  {bioExpanded || !authorBioTruncated
                    ? selectedBook.author_bio
                    : authorBioTruncated}
                  {authorBioTruncated && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setBioExpanded((e) => !e)}
                    >
                      {bioExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </p>
              </div>
            ) : (
              <div className="enrichment-section">
                <div className="enrichment-label">About the author</div>
                <p className="enrichment-text muted">No author bio yet.</p>
                <div className="btn-row">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() =>
                      openManualEdit(selectedBook.id, "author_bio")
                    }
                  >
                    Write manually
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => openAiGen(selectedBook.id, "author_bio")}
                  >
                    Generate with AI
                  </button>
                </div>
              </div>
            )}

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
                  No reviews yet.
                </div>
              </div>
            )}
          </Modal>
        )}

        {/* ── Edit Book Modal ── */}
        {editingBook && (
          <Modal
            title={`Editing "${editingBook.title}"`}
            subtitle="Update this title's details, genre, and copy count."
            wide
            onClose={() => setEditingBook(null)}
          >
            <form onSubmit={saveEdit} className="modal-form-grid">
              {editError && <div className="error">{editError}</div>}
              <div className="form-group form-group-full">
                <label>Title</label>
                <input {...editField("title")} required autoFocus />
              </div>
              <div className="form-group">
                <label>Author</label>
                <input {...editField("author")} required />
              </div>
              <div className="form-group">
                <label>ISBN-13</label>
                <input {...editField("isbn")} required />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <Select {...editField("genre")}>
                  <option value="">Select genre</option>
                  {allGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>Total Copies</label>
                <input
                  type="number"
                  min="1"
                  {...editField("total_copies")}
                  required
                />
                {borrowed > 0 && (
                  <p className="field-hint">
                    {borrowed} currently borrowed — minimum is {borrowed}
                  </p>
                )}
              </div>
              {isDiscarding && (
                <div className="form-group discard-reason form-group-full">
                  <label>
                    Reason for Discarding <span className="required">*</span>
                  </label>
                  <input
                    {...editField("discard_reason")}
                    placeholder="e.g. Damaged, lost, worn out…"
                    required
                  />
                  <p className="field-hint">
                    Discarding{" "}
                    {editingBook.total_copies - Number(editForm.total_copies)}{" "}
                    copy/copies — this will be logged
                  </p>
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditingBook(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Changes
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Member Records Modal ── */}
        {selectedMember && (
          <Modal
            title={`Records for ${selectedMember.username}`}
            onClose={() => setSelectedMember(null)}
            wide
          >
            <div className="member-stats">
              <div className="member-stat">
                <span className="member-stat-label">Currently Borrowed</span>
                <span className="member-stat-value">
                  {selectedMember.currently_borrowed}
                </span>
              </div>
              <div className="member-stat">
                <span className="member-stat-label">Total Borrows</span>
                <span className="member-stat-value">
                  {selectedMember.total_borrows}
                </span>
              </div>
              <div className="member-stat">
                <span className="member-stat-label">Fines Pending</span>
                <span
                  className={`member-stat-value${
                    selectedMember.fines_pending > 0 ? " fine-amount" : ""
                  }`}
                >
                  {selectedMember.fines_pending > 0
                    ? `$${selectedMember.fines_pending.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="member-stat">
                <span className="member-stat-label">Fines Paid</span>
                <span className="member-stat-value">
                  {selectedMember.fines_paid > 0
                    ? `$${selectedMember.fines_paid.toFixed(2)}`
                    : "—"}
                </span>
              </div>
            </div>
            {memberBorrowsLoading ? (
              <div className="empty">Loading…</div>
            ) : memberBorrows.length === 0 ? (
              <div className="empty">No borrow history</div>
            ) : (
              <div className="modal-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Borrowed</th>
                      <th>Due</th>
                      <th>Returned</th>
                      <th>Fine</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberBorrows.map((b) => (
                      <tr key={b.id}>
                        <td>{b.book_title}</td>
                        <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                        <td>{new Date(b.due_date).toLocaleDateString()}</td>
                        <td>
                          {b.return_date ? (
                            new Date(b.return_date).toLocaleDateString()
                          ) : (
                            <Badge
                              variant={b.is_overdue ? "overdue" : "active"}
                            >
                              {b.is_overdue ? "Overdue" : "Active"}
                            </Badge>
                          )}
                        </td>
                        <td className={b.fine > 0 ? "fine-amount" : ""}>
                          {b.fine > 0 ? (
                            `$${b.fine.toFixed(2)}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {b.fine > 0 ? (
                            b.fine_paid ? (
                              <Badge variant="returned">Paid</Badge>
                            ) : (
                              <Badge variant="overdue">Unpaid</Badge>
                            )
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        )}

        <Toast toasts={toasts} />

        {/* ── AI Generate Field Modal ── */}
        {aiGenModal && (
          <Modal
            title={`${aiGenModal.mode === "edit" ? "Edit" : "Generate"} ${
              aiGenModal.field === "author_bio" ? "Author Bio" : "Description"
            } for ${aiGenModal.bookTitle}`}
            onClose={closeAiGenModal}
            wide
          >
            {aiGenError && (
              <div className="error" style={{ marginBottom: 12 }}>
                {aiGenError}
              </div>
            )}
            {aiGenLoading ? (
              <div
                className="empty"
                style={{
                  padding: "24px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>Generating…</span>
                {aiGenSlow && (
                  <>
                    <span style={{ fontSize: "0.8rem" }}>
                      This is taking longer than expected.
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={writeAiGenManually}
                    >
                      Write it yourself instead
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label>
                  {aiGenModal.mode === "edit" ? "Content" : "Generated content"}{" "}
                  <span
                    className="muted"
                    style={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    (editable)
                  </span>
                </label>
                <textarea
                  className="ai-gen-textarea"
                  value={aiGenContent}
                  onChange={(e) => setAiGenContent(e.target.value)}
                  rows={6}
                  placeholder={
                    aiGenModal.mode === "edit"
                      ? "Type the content here…"
                      : "Generated content will appear here…"
                  }
                />
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-sm btn-outline"
                onClick={closeAiGenModal}
                disabled={aiGenSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={regenerateAiField}
                disabled={aiGenLoading || aiGenSaving}
              >
                {aiGenModal.mode === "edit" ? "Generate with AI" : "Regenerate"}
              </button>
              <button
                className="btn btn-sm"
                onClick={saveAiGenContent}
                disabled={aiGenLoading || aiGenSaving || !aiGenContent.trim()}
              >
                {aiGenSaving
                  ? "Saving…"
                  : aiGenModal.mode === "edit"
                  ? "Save"
                  : "Approve & Save"}
              </button>
            </div>
          </Modal>
        )}

        {/* ── Cover Upload Modal ── */}
        {coverUploadBookId && (
          <Modal
            title="Upload Cover"
            onClose={() => {
              setCoverUploadBookId(null);
              setCoverUploadPreview("");
              setCoverUploadUrl("");
            }}
          >
            <div className="cover-upload-tabs">
              <button
                className={`cover-upload-tab${
                  coverUploadMode === "file" ? " active" : ""
                }`}
                onClick={() => {
                  setCoverUploadMode("file");
                  setCoverUploadPreview("");
                }}
              >
                Upload file
              </button>
              <button
                className={`cover-upload-tab${
                  coverUploadMode === "url" ? " active" : ""
                }`}
                onClick={() => {
                  setCoverUploadMode("url");
                  setCoverUploadUrl("");
                }}
              >
                From URL
              </button>
            </div>
            {coverUploadError && (
              <div className="error" style={{ marginBottom: 12 }}>
                {coverUploadError}
              </div>
            )}
            {coverUploadMode === "file" && (
              <div className="cover-upload-file">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                />
                {coverUploadPreview && (
                  <img
                    src={coverUploadPreview}
                    alt="Cover preview"
                    className="cover-upload-preview"
                  />
                )}
              </div>
            )}
            {coverUploadMode === "url" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Image URL</label>
                <input
                  type="text"
                  value={coverUploadUrl}
                  onChange={(e) => setCoverUploadUrl(e.target.value)}
                  placeholder="https://…"
                />
                {coverUploadUrl && (
                  <img
                    src={coverUploadUrl}
                    alt="Cover preview"
                    className="cover-upload-preview"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                    onLoad={(e) => {
                      e.target.style.display = "block";
                    }}
                  />
                )}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setCoverUploadBookId(null);
                  setCoverUploadPreview("");
                  setCoverUploadUrl("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                onClick={saveCoverUpload}
                disabled={
                  coverUploadSaving ||
                  (coverUploadMode === "file"
                    ? !coverUploadPreview
                    : !coverUploadUrl.trim())
                }
              >
                {coverUploadSaving ? "Saving…" : "Save Cover"}
              </button>
            </div>
          </Modal>
        )}

        {/* ── Book Logs Modal ── */}
        {logsBook && (
          <Modal
            title={`Inventory Logs for ${logsBook.title}`}
            onClose={() => setLogsBook(null)}
            wide
            className="modal-xwide"
          >
            <div className="reviews-header">Inventory Logs</div>
            {logsLoading ? (
              <div className="empty">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="empty">No log entries for this book</div>
            ) : (
              <div className="modal-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Details</th>
                      <th>Admin</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="log-action">{l.action}</span>
                        </td>
                        <td className="log-details">{l.details}</td>
                        <td>{l.admin_username}</td>
                        <td className="log-date">
                          {new Date(l.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="reviews-header" style={{ marginTop: 24 }}>
              Borrow History
            </div>
            {bookBorrowsLoading ? (
              <div className="empty">Loading…</div>
            ) : bookBorrows.length === 0 ? (
              <div className="empty">No borrow records for this book</div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Borrowed</th>
                      <th>Due</th>
                      <th>Returned</th>
                      <th>Fine</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookBorrows.map((b) => (
                      <tr key={b.id}>
                        <td>{b.username}</td>
                        <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                        <td>{new Date(b.due_date).toLocaleDateString()}</td>
                        <td>
                          {b.return_date ? (
                            new Date(b.return_date).toLocaleDateString()
                          ) : (
                            <Badge
                              variant={b.is_overdue ? "overdue" : "active"}
                            >
                              {b.is_overdue ? "Overdue" : "Active"}
                            </Badge>
                          )}
                        </td>
                        <td className={b.fine > 0 ? "fine-amount" : ""}>
                          {b.fine > 0 ? (
                            `$${b.fine.toFixed(2)}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {b.fine > 0 ? (
                            b.fine_paid ? (
                              <Badge variant="returned">Paid</Badge>
                            ) : (
                              <Badge variant="overdue">Unpaid</Badge>
                            )
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Modal>
        )}
      </div>
    </>
  );
}

export default AdminDashboard;
