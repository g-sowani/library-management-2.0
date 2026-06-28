# Library Management System — Project Context

## Overview
A full-stack library management app. Admins manage the book catalogue, monitor borrows, configure fines, and track inventory changes. Members browse books, borrow/return them, reserve books when all copies are out, view their fines, and leave optional ratings and reviews when returning a book. The Books tab surfaces personalised recommendations and trending content to help members discover what to read next.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 · Flask 3 · SQLAlchemy · SQLite |
| Frontend | React 18 (Create React App) · Axios |
| Auth | Flask session cookies (signed, `withCredentials`) |

---

## Running Locally

**Backend** (from `backend/`):
```bash
.venv/bin/python app.py     # starts on http://localhost:5027
```

**Frontend** (from `frontend/`):
```bash
npm start                   # starts on http://localhost:3000
```

The CRA dev server proxies all `/api/*` requests to `http://localhost:5027` (configured in `frontend/package.json`).

**Seed accounts** (created automatically on first run):
- `admin / admin123` — role: admin
- `member / member123` — role: member

---

## Backend Structure

```
backend/
  app.py              # Flask app factory (create_app) + entry point
  config.py           # Config class — ports, CORS origin, secret key
  extensions.py       # db = SQLAlchemy() singleton
  decorators.py       # @login_required, @admin_required
  utils.py            # lock_book() — dialect-aware SELECT FOR UPDATE SKIP LOCKED helper
  models/
    user.py           # User (id, username, password_hash, role)
    book.py           # Book (id, title, author, isbn, genre, total/available_copies)
    borrow.py         # Borrow (user↔book, borrow/due/return dates, fine, fine_paid)
    reservation.py    # Reservation (user↔book, created_at, status: pending|ready)
    book_log.py       # BookLog (audit log per book — action, details, admin, timestamp)
    setting.py        # Setting (key/value) + get_setting() helper
    review.py         # Review (book↔user↔borrow, rating 1–5, review_text, is_anonymous, created_at)
    __init__.py       # re-exports all models + seed_data()
  routes/
    auth.py           # /api/auth/  — register, login, logout, me
    books.py          # /api/books/ — CRUD + PUT edit + GET logs + GET reviews
                      #   + GET trending + GET recommendations + GET collaborative-recommendations
                      #   book list includes reservation_count, avg_rating, rating_count per book
    borrows.py        # /api/borrow/, /api/return/, /api/my-borrows, /api/my-fines
                      #   return accepts optional JSON body with rating/review
    reservations.py   # /api/reserve/, /api/cancel-reservation/, /api/my-reservations
    admin.py          # /api/admin/ — borrows, fines, policy GET/PUT
    __init__.py       # register_blueprints()
```

### DB migrations
`app.py` runs `_migrate_db()` on every startup. It uses `ALTER TABLE` to add columns that exist in models but not yet in the SQLite file. New tables are created automatically by `db.create_all()`.

### Fine calculation
`Borrow.calculate_fine()` reads `fine_per_day` live from the `setting` table. `borrow_days` (loan duration) is also read from `setting` at borrow time. Both are configurable by the admin at runtime.

---

## Frontend Structure

```
frontend/src/
  api.js                    # Axios instance — baseURL: /api, withCredentials: true
  constants.js              # GENRES list (shared across add/edit forms and filters)
  context/
    AuthContext.js          # AuthProvider + useAuth() — user, login(), logout()
                            # Axios interceptor: 401 clears user; 403 re-fetches /auth/me
                            # to re-sync React state with the real Flask session
  components/
    TopBar.js               # Header with title, username, sign-out
    NavTabs.js              # Tab bar driven by a tabs config array
    Badge.js                # Status chip (active / overdue / returned)
    Modal.js                # Overlay modal; wide prop for 640px variant
    SearchBar.js            # Controlled search input
  pages/
    Login.js                # Sign-in / register form (role selector on register)
    MemberDashboard.js      # Books · My Books · Fines tabs
                            #
                            # Books tab (top → bottom):
                            #   1. Section header + live book count
                            #   2. Trending This Week strip — horizontal scrollable cards,
                            #      each showing borrow count this week; cards have dark border
                            #   3. Recommended for you strip — content-based recs
                            #   4. Readers like you also enjoyed strip — collab-filtered recs
                            #      (deduped against content-based strip client-side)
                            #   5. Filter bar — search input + availability dropdown
                            #      + min-rating dropdown + Clear button
                            #   6. Genre cards — scrollable strip; click to filter by genre
                            #   7. Book table — Title / Author / Genre / Rating columns
                            #      Trending books show an inline "Trending" badge in the title cell
                            #      Click row → Book Detail modal (wide):
                            #        copies, avg rating + count, reviews list,
                            #        Borrow / Reserve / Borrow (Ready) / Borrowed action button
                            #
                            # My Books tab: active borrows (Return button → Return+Review modal)
                            #   + My Reservations section
                            # Return modal: optional 5-star picker, review text, anonymous toggle
    AdminDashboard.js       # Books · Borrowed · Fines · Fine Policy tabs
                            # + Edit book modal + Inventory Logs modal
```

### Auth flow
`AuthContext` calls `GET /api/auth/me` on mount. A 401 sets `user = null` → redirect to `/login`. Login/register calls set `user` via `login(userData)`. All protected pages use `useAuth()` — no prop drilling.

A global Axios response interceptor handles session drift: a 401 clears the user immediately; a 403 re-fetches `/auth/me` and updates React state to match the real Flask session (prevents stale "admin" UI after switching accounts in the same browser).

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user (role selectable via payload) |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/logout` | session | Logout |
| GET | `/api/auth/me` | session | Current user |

### Books
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/books` | member+ | List all books; each entry includes `reservation_count`, `avg_rating`, `rating_count` |
| POST | `/api/books` | admin | Add book (logs entry) |
| PUT | `/api/books/:id` | admin | Edit book — metadata and/or copy count; discard reason required when reducing copies |
| DELETE | `/api/books/:id` | admin | Delete book (blocked if active borrows) |
| GET | `/api/books/:id/logs` | admin | Inventory log for a book |
| GET | `/api/books/:id/reviews` | member+ | Reviews for a book — `{ avg_rating, rating_count, reviews: [...] }` |
| GET | `/api/trending` | member+ | Top 8 books by borrow count in the last 7 days; includes `borrow_count_week` |
| GET | `/api/recommendations` | member+ | Top 8 content-based recommendations for the caller |
| GET | `/api/collaborative-recommendations` | member+ | Top 8 collaborative-filtered recommendations for the caller |

### Borrows
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/borrow/:bookId` | member | Borrow a book |
| POST | `/api/return/:borrowId` | member | Return a book; optional JSON body `{ rating, review_text, is_anonymous }` submits a review atomically |
| GET | `/api/my-borrows` | member | Caller's borrow history |
| GET | `/api/my-fines` | member | Caller's unpaid fines |

### Reservations
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/reserve/:bookId` | member | Reserve a book (only when `available_copies == 0`) |
| DELETE | `/api/cancel-reservation/:id` | member | Cancel a reservation |
| GET | `/api/my-reservations` | member | Caller's active reservations with queue position |

### Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/borrows` | admin | All currently borrowed books |
| GET | `/api/admin/fines` | admin | All unpaid fines |
| GET | `/api/admin/policy` | admin | Current fine policy |
| PUT | `/api/admin/policy` | admin | Update `fine_per_day` and `borrow_days` |

---

## Rating & Review System

Members can optionally rate and review a book at return time. One review per borrow (enforced by a unique constraint on `review.borrow_id`).

**Return flow:**
1. Member clicks **Return** → a modal opens showing the book title.
2. Member can click 1–5 stars (optional). If a rating is selected, a review textarea and an **Anonymous** checkbox appear.
3. Clicking **Submit & Return** posts `{ rating, review_text, is_anonymous }` as the JSON body of `POST /api/return/:borrowId`; the review is written in the same transaction as the return.
4. Clicking **Return** with no stars returns the book without creating a review record.

**Where ratings appear:**
- **Available Books table** — "Rating" column shows `★★★★☆ 4.2 (5)` or `—` for unrated books.
- **Book Detail modal** (opened by clicking a book row) — "Rating" row shows average stars + count. A "Reviews" section below the action buttons lists each review: reviewer name (or "Anonymous"), star display, date, and optional review text.

**`Review` model fields:** `id`, `book_id`, `user_id`, `borrow_id` (unique), `rating` (int 1–5), `review_text` (nullable text), `is_anonymous` (bool), `created_at`.

---

## Reservation System

**States:** `pending` → `ready` → (borrowed / cancelled)

**Flow:**
1. All copies are out (`available_copies == 0`) → member sees **Reserve** button in the Book Detail modal.
2. A reservation is created with `status = 'pending'`. Queue position is the count of earlier pending entries for that book.
3. When a book is returned and pending reservations exist, the returned copy is **held** for the first waiter: their status becomes `ready` and `available_copies` stays at 0 (the copy is implicitly held).
4. If no reservations exist on return, `available_copies` is incremented normally.
5. The `ready` user sees **Borrow (Ready)** and can borrow. Their reservation is deleted on borrow.
6. If the `ready` user cancels: the held copy passes to the next `pending` waiter (their status → `ready`), or `available_copies` is incremented if the queue is now empty.

**Book Detail modal button states (member view):**

| Condition | Button |
|---|---|
| `available_copies > 0`, not borrowed | **Borrow** |
| `available_copies == 0`, not in queue | **Reserve** (outline) |
| In queue, `status = pending` | **Reserved #N** (disabled) |
| In queue, `status = ready` | **Borrow (Ready)** |
| Already borrowed | **Borrowed** (disabled) |

---

## Discovery & Recommendations

Three independent signals are computed server-side and surfaced as horizontal scrollable card strips at the top of the Books tab. All three are fetched in parallel on mount; failures are silently swallowed so a slow query never breaks the page.

### Trending This Week (`/api/trending`)
Counts borrows with `borrow_date >= now − 7 days`, returns the top 8 books sorted by that count. Each card shows `"N borrows this week"`. Books in the trending set also get an inline **Trending** badge in the book table title cell, visible regardless of active filters. Dark-bordered cards distinguish trending from recommendation cards visually.

### Content-Based Recommendations (`/api/recommendations`)
Builds a weighted preference profile from the caller's full borrow history:
- **Weight per borrow** = `rating / 5` if the user reviewed it, else `0.6` (implicit positive signal; lower than a 3-star rating to avoid over-crediting passive reads).
- Accumulates weighted totals per genre and per author.
- Scores each unread book as `0.5 × genre_match + 0.3 × author_match + 0.2 × library_avg_rating` (all normalised to [0, 1]).
- Books with score ≤ 0.15 (no meaningful genre/author connection) are filtered out.
- Returns up to 8 books with a human-readable reason: `"More by [Author]"`, `"Because you read [Genre]"`, or `"Highly rated"`.
- Empty if the user has no borrow history.

### Collaborative Filtering (`/api/collaborative-recommendations`)
User-based collaborative filtering using cosine similarity on implicit rating vectors:
- Every user is represented as a sparse vector over book IDs: weight = `rating / 5` if reviewed, `0.6` if borrowed but not reviewed.
- Cosine similarity is computed between the current user and all other users (users with zero book overlap are skipped).
- Each unread book is scored as `Σ sim(other_user) × their_weight(book)` — books read by many highly-similar users with strong ratings score highest.
- Returns up to 8 books with reason `"N readers like you read this"` (N = count of similar users who borrowed it).
- Client-side dedup removes any book already shown in the content-based strip.
- Empty if the user has no borrow history or no other user shares any books.

---

## Books Tab UI — Filter & Navigation

All filtering is client-side (all books are loaded on mount).

- **Genre cards** — horizontally scrollable strip of per-genre buttons, each showing the count of books in that genre. "All" card resets the genre filter. Active card has a filled dark style.
- **Filter bar** — search input (title / author / genre text match) + availability dropdown (All / Available now / Unavailable) + minimum rating dropdown (Any / 2+ / 3+ / 4+) + a **Clear** button that appears when any filter is active.
- **Live count** — header shows `"N of M books"` when filters are active, `"M books"` otherwise.
- **Trending badge** — inline `"Trending"` chip next to the book title in the table for any book in the current trending set.

---

## Concurrency / TOCTOU Protection

All copy-count mutations go through two layers of protection so concurrent borrow/return/reserve requests cannot corrupt `available_copies`.

### Layer 1 — `lock_book()` (`utils.py`)
Dialect-aware row locking called at the start of every borrow, return, and reservation write:
- **PostgreSQL**: `SELECT ... FOR UPDATE SKIP LOCKED` — non-blocking; if another transaction already holds the row lock the query returns `None` immediately and the caller responds **409** so the client can retry.
- **SQLite**: plain `SELECT` — SQLite's WAL-mode journal serialises concurrent writers at the database level; no row-level lock syntax is needed.

### Layer 2 — Atomic conditional UPDATE
All decrements use a server-side expression with a guard condition:

```sql
UPDATE book SET available_copies = available_copies - 1
WHERE id = ? AND available_copies > 0
```

`rowcount == 0` means a concurrent transaction grabbed the last copy between the initial read and this write. The endpoint returns **409** so the client can retry. The same pattern covers increments (`available_copies + 1`) in return and cancel-reservation — the value is never read into Python, modified, and written back.

**Response codes:**
- **409 Conflict** — row locked by a peer (PostgreSQL) or atomic decrement raced and lost (SQLite). Retryable.
- **400 Bad Request** — business rule violation (already borrowed, no copies for non-queued user, etc.). Not retryable without user action.

---

## Key Design Decisions

- **Session-based auth** over JWT — simpler for a monolith; Flask handles signing.
- **SQLite** — zero-config for development; swap `SQLALCHEMY_DATABASE_URI` in `config.py` to migrate to Postgres.
- **Client-side filtering** — all books are loaded on mount; genre, availability, rating, and text filters are applied in-memory with `useMemo`.
- **Audit log per book** (`BookLog`) — stores denormalised `admin_username` so logs survive user deletion.
- **Configurable fine policy** stored in the `setting` table — no server restart needed to change rates.
- **CRA proxy** — frontend calls `/api/*` as same-origin; proxy rewrites to Flask. No CORS handling needed in the browser.
- **Reservation copy tracking** — held copies are tracked implicitly: `available_copies` is not incremented on return when a `pending` reservation exists. The count of `ready` reservations equals the number of held (not-yet-borrowed) copies. This avoids a separate "held" counter.
- **Atomic UPDATE over ORM assignment** — `available_copies` is never read into Python and written back. All mutations use `UPDATE … SET available_copies = available_copies ± 1` so the DB handles the arithmetic atomically.
- **Review submitted at return time** — the review is written in the same DB transaction as the return, so a review can never exist without a completed borrow. The `borrow_id` unique constraint prevents duplicate reviews per borrow.
- **Anonymous reviews** — `is_anonymous` is stored on the `Review` record; the reviewer's username is resolved at read time and replaced with `"Anonymous"` before returning to the client, so the real identity is never exposed via the API.
- **Recommendations are read-only and parallel** — all three discovery endpoints (`/trending`, `/recommendations`, `/collaborative-recommendations`) are pure reads with no side effects; they are fetched in parallel on mount and failures are silently ignored so they never degrade the core browsing experience.
- **Implicit rating weight (0.6)** — unrated borrows contribute a weight below a 3-star rating (0.6 < 0.6̄) so that books the user read but didn't bother to review pull less signal than books they actively rated. This prevents passive reads from dominating the preference profile.
- **Collab dedup is client-side** — the collaborative strip filters out IDs already shown in the content-based strip in React, keeping both endpoints independent and cacheable without needing server-side coordination.
