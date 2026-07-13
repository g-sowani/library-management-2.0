import React, { useEffect, useState } from "react";
import api from "../../../api";
import Badge from "../../../components/Badge";
import Select from "../../../components/Select";
import NoCoverPlaceholder from "../../../components/NoCoverPlaceholder";
import ChevronDown from "../../../components/icons/ChevronDown";
import AlertTriangleIcon from "../../../components/icons/AlertTriangleIcon";
import { formatCurrency } from "../../../utils/currency";

function HomeTab({
  user,
  overdueBorrows,
  unpaidFines,
  totalUnpaidFines,
  onGoToOverdueBooks,
  unnotifiedBookRequests,
  onOpenBook,
  onDismissBookRequest,
  openHomeSection,
  toggleHomeSection,
  borrowedSectionRef,
  activeBorrows,
  books,
  onSelectBook,
  onOpenReturnModal,
  fines,
  pastBorrows,
  reservations,
  onCancelReservation,
  wishlistItems,
  wishlistLoading,
  onToggleWishlist,
  onViewAllBooks,
  toast,
}) {
  const currency = user?.library?.currency;
  const [readingGoal, setReadingGoal] = useState(null); // { period, target }
  const [readingProgress, setReadingProgress] = useState(0);
  const [booksReadThisYear, setBooksReadThisYear] = useState(0);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalPeriodDraft, setGoalPeriodDraft] = useState("yearly");
  const [goalTargetDraft, setGoalTargetDraft] = useState(12);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
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
      .catch(() => {});
  }, []);

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

  return (
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
                  onClick={onGoToOverdueBooks}
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
                      onOpenBook(r.book_id);
                      onDismissBookRequest(r.id);
                    }}
                  >
                    View book
                  </button>
                )}
                <button
                  className="book-request-banner-dismiss"
                  onClick={() => onDismissBookRequest(r.id)}
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
                  <strong>{readingProgress}</strong> / {readingGoal.target}{" "}
                  books this{" "}
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
                  🎉 Goal reached — nice work!
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
            📚 {booksReadThisYear} book
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
                    onClick={() => onSelectBook(b.book_id)}
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
                          onClick={() => onOpenReturnModal(b)}
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
                    onClick={() => onSelectBook(b.book_id)}
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
                    onClick={() => onSelectBook(b.book_id)}
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
                    onClick={() => onSelectBook(r.book_id)}
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
                        onClick={() => onCancelReservation(r.id)}
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
                  onClick={() => onSelectBook(item.book_id)}
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
                      onClick={() => onToggleWishlist(item.book_id)}
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
              onClick={onViewAllBooks}
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
                    onClick={() => onOpenBook(book.id)}
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
  );
}

export default HomeTab;
