# Library Management System — Project Context

## Overview
A full-stack library management app. Admins manage the book catalogue, monitor borrows, configure fines, and track inventory changes. Members browse books, borrow/return them, reserve books when all copies are out, and view their fines.

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
    __init__.py       # re-exports all models + seed_data()
  routes/
    auth.py           # /api/auth/  — register, login, logout, me
    books.py          # /api/books/ — CRUD + PUT edit + GET logs; includes reservation_count per book
    borrows.py        # /api/borrow/, /api/return/, /api/my-borrows, /api/my-fines
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
                            # Books tab: Title/Author/Genre list; click row → Book Detail modal
                            # My Books tab: active borrows + My Reservations section
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
| GET | `/api/books` | member+ | List all books; each entry includes `reservation_count` |
| POST | `/api/books` | admin | Add book (logs entry) |
| PUT | `/api/books/:id` | admin | Edit book — metadata and/or copy count; discard reason required when reducing copies |
| DELETE | `/api/books/:id` | admin | Delete book (blocked if active borrows) |
| GET | `/api/books/:id/logs` | admin | Inventory log for a book |

### Borrows
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/borrow/:bookId` | member | Borrow a book |
| POST | `/api/return/:borrowId` | member | Return a book |
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
- **Client-side search** — all books are loaded on mount; filtering is in-memory.
- **Audit log per book** (`BookLog`) — stores denormalised `admin_username` so logs survive user deletion.
- **Configurable fine policy** stored in the `setting` table — no server restart needed to change rates.
- **CRA proxy** — frontend calls `/api/*` as same-origin; proxy rewrites to Flask. No CORS handling needed in the browser.
- **Reservation copy tracking** — held copies are tracked implicitly: `available_copies` is not incremented on return when a `pending` reservation exists. The count of `ready` reservations equals the number of held (not-yet-borrowed) copies. This avoids a separate "held" counter.
- **Atomic UPDATE over ORM assignment** — `available_copies` is never read into Python and written back. All mutations use `UPDATE … SET available_copies = available_copies ± 1` so the DB handles the arithmetic atomically.
