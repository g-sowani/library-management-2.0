import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api";
import SearchBar from "../../../../components/SearchBar";
import Select from "../../../../components/Select";
import ActionMenu from "../../../../components/ActionMenu";
import FilterIcon from "../../../../components/icons/FilterIcon";
import {
  wcagTextColor,
  minAlphaForContrast,
  relLuminance,
  contrastRatio,
} from "../../../../utils/colorContrast";
import AddGenreModal from "./AddGenreModal";
import AddBookModal from "./AddBookModal";
import EditBookModal from "./EditBookModal";
import BookDetailModal from "./BookDetailModal";
import BookLogsModal from "./BookLogsModal";
import AiGenModal from "./AiGenModal";
import CoverUploadModal from "./CoverUploadModal";
import BookRequestModals from "./BookRequestModals";
import RefreshLogPanel from "./RefreshLogPanel";
import BooksGrid from "./BooksGrid";
import BooksListView from "./BooksListView";
import BookRequestsSection from "./BookRequestsSection";

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

const EMPTY_BOOK_FORM = {
  title: "",
  author: "",
  isbn: "",
  total_copies: 1,
  genre: "",
};

const HERO_STAR_GOLD = "#f5a623";

function BooksTab({ bookRequests, bookRequestsLoaded, pendingBookRequests, onReloadBookRequests, toast }) {
  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [metaFilter, setMetaFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [booksView, setBooksView] = useState(
    () => localStorage.getItem("adminBooksView") || "grid"
  );

  const [showAdd, setShowAdd] = useState(false);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [bookError, setBookError] = useState("");

  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState("");

  const [logsBook, setLogsBook] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [bookBorrows, setBookBorrows] = useState([]);
  const [bookBorrowsLoading, setBookBorrowsLoading] = useState(false);

  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookReviews, setBookReviews] = useState(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bookDetailMenuOpen, setBookDetailMenuOpen] = useState(false);
  const bookDetailMenuRef = useRef(null);

  const [cardMenuOpenId, setCardMenuOpenId] = useState(null);
  const cardMenuRef = useRef(null);

  const [showAddGenre, setShowAddGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [genreError, setGenreError] = useState("");
  const [genreSaving, setGenreSaving] = useState(false);

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [showRefreshLog, setShowRefreshLog] = useState(false);
  const [refreshLog, setRefreshLog] = useState([]);
  const [refreshProgress, setRefreshProgress] = useState(null); // { done, total }
  const [refreshModalTitle, setRefreshModalTitle] = useState("Refresh All Books");
  const [refreshingBookId, setRefreshingBookId] = useState(null);
  const [refreshBookId, setRefreshBookId] = useState(null);

  const [aiGenModal, setAiGenModal] = useState(null); // { bookId, field, bookTitle }
  const [aiGenContent, setAiGenContent] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenSlow, setAiGenSlow] = useState(false);
  const [aiGenError, setAiGenError] = useState("");
  const [aiGenSaving, setAiGenSaving] = useState(false);
  const aiGenRequestIdRef = useRef(0);
  const aiGenSlowTimerRef = useRef(null);

  const [coverUploadBookId, setCoverUploadBookId] = useState(null);
  const [coverUploadMode, setCoverUploadMode] = useState("file");
  const [coverUploadPreview, setCoverUploadPreview] = useState("");
  const [coverUploadUrl, setCoverUploadUrl] = useState("");
  const [coverUploadSaving, setCoverUploadSaving] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");

  const [bookRequestHistoryOpen, setBookRequestHistoryOpen] = useState(false);
  const [bookRequestHistoryFilter, setBookRequestHistoryFilter] = useState("");
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

  const load = () =>
    api.get("/books").then((r) => setBooks(r.data));

  useEffect(() => {
    load();
    api.get("/genres").then((r) => setGenres(r.data.map((g) => g.name)));
  }, []);

  const selectedBook = books.find((b) => b.id === selectedBookId) || null;

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
      if (aiGenRequestIdRef.current !== reqId) return;
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
      aiGenRequestIdRef.current++;
      clearAiGenSlowTimer();
      setAiGenContent(existing);
      setAiGenLoading(false);
      return;
    }
    runAiGenerate(bookId, field);
  };

  const openManualEdit = (bookId, field) => {
    const book = books.find((b) => b.id === bookId);
    aiGenRequestIdRef.current++;
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

  const writeAiGenManually = () => {
    aiGenRequestIdRef.current++;
    clearAiGenSlowTimer();
    setAiGenLoading(false);
    setAiGenSlow(false);
    setAiGenError("");
    setAiGenContent("");
  };

  const closeAiGenModal = () => {
    if (aiGenSaving) return;
    aiGenRequestIdRef.current++;
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

  // ── Book requests ─────────────────────────────────────────────
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
      onReloadBookRequests();
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
      onReloadBookRequests();
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

  const historyBookRequests = bookRequests.filter(
    (r) =>
      r.status !== "pending" &&
      (!bookRequestHistoryFilter || r.status === bookRequestHistoryFilter)
  );

  const isDiscarding =
    editingBook && Number(editForm.total_copies) < editingBook.total_copies;
  const borrowed = editingBook
    ? editingBook.total_copies - editingBook.available_copies
    : 0;

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
  }, [selectedBook]);

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
        <BooksGrid books={filteredBooks} onOpenBookDetail={openBookDetail} renderBookActions={renderBookActions} />
      )}
      {filteredBooks.length > 0 && booksView === "list" && (
        <BooksListView books={filteredBooks} onOpenBookDetail={openBookDetail} renderBookActions={renderBookActions} />
      )}

      <BookRequestsSection
        bookRequestsLoaded={bookRequestsLoaded}
        pendingBookRequests={pendingBookRequests}
        onApprove={openApproveBookRequest}
        onReject={openRejectBookRequest}
        historyBookRequests={historyBookRequests}
        bookRequestHistoryOpen={bookRequestHistoryOpen}
        setBookRequestHistoryOpen={setBookRequestHistoryOpen}
        bookRequestHistoryFilter={bookRequestHistoryFilter}
        setBookRequestHistoryFilter={setBookRequestHistoryFilter}
      />

      {showRefreshLog && (
        <RefreshLogPanel
          refreshModalTitle={refreshModalTitle}
          onClose={() => setShowRefreshLog(false)}
          refreshProgress={refreshProgress}
          refreshLog={refreshLog}
          refreshingAll={refreshingAll}
          refreshingBookId={refreshingBookId}
          refreshBookId={refreshBookId}
          onManualEdit={openManualEdit}
          onOpenCoverUpload={openCoverUpload}
        />
      )}

      <BookRequestModals
        approvingBookRequest={approvingBookRequest}
        setApprovingBookRequest={setApprovingBookRequest}
        approveBookTitle={approveBookTitle}
        setApproveBookTitle={setApproveBookTitle}
        approveBookAuthor={approveBookAuthor}
        setApproveBookAuthor={setApproveBookAuthor}
        approveBookIsbn={approveBookIsbn}
        setApproveBookIsbn={setApproveBookIsbn}
        approveBookGenre={approveBookGenre}
        setApproveBookGenre={setApproveBookGenre}
        approveBookCopies={approveBookCopies}
        setApproveBookCopies={setApproveBookCopies}
        approveBookNotes={approveBookNotes}
        setApproveBookNotes={setApproveBookNotes}
        approveBookError={approveBookError}
        genres={genres}
        onSubmitApprove={submitApproveBookRequest}
        rejectingBookRequest={rejectingBookRequest}
        setRejectingBookRequest={setRejectingBookRequest}
        rejectBookNotes={rejectBookNotes}
        setRejectBookNotes={setRejectBookNotes}
        rejectBookError={rejectBookError}
        onSubmitReject={submitRejectBookRequest}
      />

      {showAddGenre && (
        <AddGenreModal
          newGenreName={newGenreName}
          setNewGenreName={setNewGenreName}
          genreError={genreError}
          genreSaving={genreSaving}
          onClose={() => setShowAddGenre(false)}
          onSubmit={addGenre}
        />
      )}

      {showAdd && (
        <AddBookModal
          bookField={bookField}
          allGenres={allGenres}
          bookError={bookError}
          onClose={() => {
            setShowAdd(false);
            setBookError("");
          }}
          onSubmit={addBook}
        />
      )}

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={closeBookDetail}
          coverPalette={coverPalette}
          heroCssVars={heroCssVars}
          heroRowStyle={heroRowStyle}
          heroLabelStyle={heroLabelStyle}
          heroSubtleStyle={heroSubtleStyle}
          heroFaintStyle={heroFaintStyle}
          bookReviews={bookReviews}
          bioExpanded={bioExpanded}
          setBioExpanded={setBioExpanded}
          authorBioTruncated={authorBioTruncated}
          bookDetailMenuOpen={bookDetailMenuOpen}
          setBookDetailMenuOpen={setBookDetailMenuOpen}
          bookDetailMenuRef={bookDetailMenuRef}
          onOpenCoverUpload={openCoverUpload}
          onEdit={openEdit}
          onOpenLogs={openLogs}
          onRefreshMeta={refreshMeta}
          refreshingAll={refreshingAll}
          refreshingBookId={refreshingBookId}
          onShowRefreshLog={() => setShowRefreshLog(true)}
          onDelete={deleteBook}
          onOpenAiGen={openAiGen}
          onOpenManualEdit={openManualEdit}
        />
      )}

      {editingBook && (
        <EditBookModal
          editingBook={editingBook}
          editForm={editForm}
          editField={editField}
          allGenres={allGenres}
          editError={editError}
          isDiscarding={isDiscarding}
          borrowed={borrowed}
          onClose={() => setEditingBook(null)}
          onSubmit={saveEdit}
        />
      )}

      {aiGenModal && (
        <AiGenModal
          aiGenModal={aiGenModal}
          aiGenContent={aiGenContent}
          setAiGenContent={setAiGenContent}
          aiGenLoading={aiGenLoading}
          aiGenSlow={aiGenSlow}
          aiGenError={aiGenError}
          aiGenSaving={aiGenSaving}
          onClose={closeAiGenModal}
          onWriteManually={writeAiGenManually}
          onRegenerate={regenerateAiField}
          onSave={saveAiGenContent}
        />
      )}

      {coverUploadBookId && (
        <CoverUploadModal
          coverUploadMode={coverUploadMode}
          setCoverUploadMode={setCoverUploadMode}
          coverUploadPreview={coverUploadPreview}
          setCoverUploadPreview={setCoverUploadPreview}
          coverUploadUrl={coverUploadUrl}
          setCoverUploadUrl={setCoverUploadUrl}
          coverUploadSaving={coverUploadSaving}
          coverUploadError={coverUploadError}
          onClose={() => {
            setCoverUploadBookId(null);
            setCoverUploadPreview("");
            setCoverUploadUrl("");
          }}
          onFileChange={handleCoverFileChange}
          onSave={saveCoverUpload}
        />
      )}

      {logsBook && (
        <BookLogsModal
          logsBook={logsBook}
          onClose={() => setLogsBook(null)}
          logs={logs}
          logsLoading={logsLoading}
          bookBorrows={bookBorrows}
          bookBorrowsLoading={bookBorrowsLoading}
        />
      )}
    </>
  );
}

export default BooksTab;
