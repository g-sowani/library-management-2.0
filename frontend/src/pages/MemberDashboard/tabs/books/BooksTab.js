import React, { useMemo, useState } from "react";
import api from "../../../../api";
import SearchBar from "../../../../components/SearchBar";
import Select from "../../../../components/Select";
import BookStrip from "../../../../components/BookStrip";
import NoCoverPlaceholder from "../../../../components/NoCoverPlaceholder";
import FilterIcon from "../../../../components/icons/FilterIcon";
import XIcon from "../../../../components/icons/XIcon";

function BooksTab({ books, trending, recommendations, collabRecs, onOpenBook, onOpenBookRequestModal }) {
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

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

  return (
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
              onClick={() => onOpenBookRequestModal(aiQuery)}
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
                  onClick={() => onOpenBook(b.id)}
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
            onClick={() => onOpenBookRequestModal(search)}
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
                onClick={() => onOpenBook(b.id)}
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
                        onClick={() => onOpenBook(book.id)}
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
                        onClick={() => onOpenBook(book.id)}
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
                        onClick={() => onOpenBook(book.id)}
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
                      onClick={() => onOpenBook(book.id)}
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
  );
}

export default BooksTab;
