# Library Management System — Project Context

## Overview
A full-stack library management app. Admins manage the book catalogue, monitor borrows, configure fines, track inventory changes, and review incoming book donations. Members browse books, borrow/return them, reserve books when all copies are out, view their fines, leave optional ratings and reviews when returning a book, and donate books to the library in exchange for credit. The Books tab surfaces personalised recommendations and trending content to help members discover what to read next.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 · Flask 3 · SQLAlchemy · SQLite |
| Frontend | React 18 (Create React App) · Axios |
| Auth | Flask session cookies (signed, `withCredentials`) |
| Metadata | Open Library API (urllib) · Pillow (dominant colour extraction) |
| AI Search | Groq API (`groq` Python SDK) · `llama-3.1-8b-instant` |

---

## Running Locally

**Backend** (from `backend/`):
```bash
python3 -m venv .venv          # first time only
source .venv/bin/activate
pip install -r requirements.txt
python app.py                  # starts on http://localhost:5027
```

**Frontend** (from `frontend/`):
```bash
npm install    # first time only
npm start      # starts on http://localhost:3000
```

Start the backend first. The CRA dev server proxies all `/api/*` requests to `http://127.0.0.1:5027` (configured in `frontend/package.json` — note: uses `127.0.0.1`, not `localhost`, to avoid Node.js IPv6 resolution issues).

**Seed accounts** (created automatically on first run):
- `admin / admin123` — role: admin
- `member / member123` — role: member

---

## Backend Structure

```
backend/
  app.py              # Flask app factory (create_app) + entry point
  seed_extra.py       # One-shot seeding script (run manually once) — adds 45 books across
                      #   11 genres (Fiction, Sci-Fi, Fantasy, Mystery, Thriller, Biography,
                      #   History, Science, Self-Help, Horror, Children's) + 4 extra member
                      #   accounts (alice/alice123, bob/bob123, carol/carol123, dave/dave123)
                      #   with rich borrow histories: on-time returns, paid/unpaid late fines,
                      #   currently-borrowed, and overdue-not-returned records per user
  config.py           # Config class — ports, CORS origin, secret key
  extensions.py       # db = SQLAlchemy() singleton
  decorators.py       # @login_required, @admin_required
  utils.py            # lock_book() — dialect-aware SELECT FOR UPDATE SKIP LOCKED helper
  models/
    user.py           # User (id, username, password_hash, role, avatar)
                      #   avatar: TEXT nullable — base64 data-URL stored in DB; NULL = no photo
                      #   has a joined-load `membership` relationship → Membership
    book.py           # Book (id, title, author, isbn, genre, total/available_copies,
                      #        description, author_bio, cover_url, cover_color)
                      #   description/author_bio: NULL = never scraped, '' = tried/no data, text = data
                      #   cover_color: VARCHAR(7) nullable — dominant mid-tone hex colour of cover image
                      #     (e.g. '#a83c2e'); NULL = not yet extracted; set during scrape via Pillow
    borrow.py         # Borrow (user↔book, borrow/due/return dates, fine, fine_paid)
    reservation.py    # Reservation (user↔book, created_at, status: pending|ready)
    book_log.py       # BookLog (audit log per book — action, details, admin, timestamp)
    setting.py        # Setting (key/value) + get_setting() helper
    review.py         # Review (book↔user↔borrow, rating 1–5, review_text, is_anonymous, created_at)
    donation.py       # Donation (user_id FK, title, author, isbn nullable, genre nullable,
                      #   condition: new|good|fair|poor, estimated_price float,
                      #   credit_amount float nullable — set on approval to estimated_price/4,
                      #   status: pending|approved|rejected, admin_notes nullable,
                      #   submitted_at, reviewed_at nullable, book_id nullable FK)
    membership.py     # Membership (user_id unique FK, tier: silver|gold|family,
                      #   family_group_id nullable int — links family plan members,
                      #   created_at)
                      #   TIER_LIMITS = {silver:1, gold:3, family:1} (active concurrent borrows)
                      #   borrow_limit() helper reads TIER_LIMITS; to_dict() includes borrow_limit
    community.py      # 6 models for the Gold-member community feature:
                      #   Community (id, name, description, creator_id FK, status: pending|approved|rejected,
                      #     admin_notes, created_at)
                      #   CommunityMembership (community_id, user_id, role: member|moderator, joined_at)
                      #   CommunityPost (community_id, author_id, title, content, created_at)
                      #   CommunityComment (post_id, author_id, parent_id FK→self, content, created_at)
                      #     — self-referential for unlimited reply depth
                      #   PostReaction (post_id, user_id, emoji VARCHAR, created_at)
                      #     — emoji column stores string keys: like|love|haha|wow|sad|angry
                      #   CommentReaction (comment_id, user_id, emoji VARCHAR, created_at)
                      #   VALID_REACTIONS = {'like','love','haha','wow','sad','angry'}
    __init__.py       # re-exports all models + seed_data() + _seed_memberships()
                      #   _seed_memberships() — randomly assigns tiers to any unassigned members
                      #     on every startup; groups family members by family_group_id (max 4)
  routes/
    auth.py           # /api/auth/  — register, login, logout, me, avatar (PUT)
                      #   /me now includes membership dict if user has one
    books.py          # /api/books/ — CRUD + PUT edit + GET logs + GET reviews
                      #   + GET trending + GET recommendations + GET collaborative-recommendations
                      #   + GET enrichment (lazy scrape) + POST scrape (admin re-scrape)
                      #   + POST scrape-all (admin bulk re-scrape with sequential per-book processing)
                      #   + POST ai-search — natural-language book search via Groq
                      #   book list includes reservation_count, avg_rating, rating_count,
                      #   description, author_bio, cover_url, cover_color per book
                      #   _scrape_book_data() — Open Library scraper (description, bio, cover)
                      #   _extract_dominant_color(cover_url) — downloads cover image, resizes to
                      #     64×64 via Pillow, bins mid-tone pixels (skips near-white/near-black),
                      #     returns most-frequent bin as '#rrggbb'; called after every scrape
                      #   _scrape_and_store() — background thread helper (called on add_book)
    borrows.py        # /api/borrow/, /api/return/, /api/my-borrows, /api/my-fines
                      #   borrow enforces per-tier active-borrow limit (Silver 1, Gold 3, Family 1)
                      #   return accepts optional JSON body with rating/review
    reservations.py   # /api/reserve/, /api/cancel-reservation/, /api/my-reservations
    admin.py          # /api/admin/ — borrows, fines, policy GET/PUT, members GET/POST,
                      #   memberships/pricing GET/PUT, members/<id>/membership PUT
                      #   PUT /api/admin/fines/<borrow_id>/mark-paid — mark a fine as paid
                      #     (sets fine_paid=True); 400 if no fine or already paid
                      #   members list now includes membership_tier and family_group_id
    membership.py     # /api/membership — GET current user's tier, pricing, family members list
    donations.py      # /api/donations POST — member submits a donation
                      # /api/my-donations GET — member's own donation history
                      # /api/admin/donations GET — all donations (filterable by ?status=)
                      # /api/admin/donations/:id/approve PUT — approve: adds book (or copy)
                      #   to catalogue, sets credit_amount (default price/4, admin-adjustable)
                      # /api/admin/donations/:id/reject PUT — reject with optional reason
    communities.py    # Gold-member community endpoints; _gold_user() enforces tier
                      # GET  /api/communities              — all approved communities
                      # POST /api/communities              — create community (Gold; status=pending)
                      # GET  /api/my-communities           — communities the caller has joined
                      # POST /api/communities/:id/join     — join an approved community
                      # DEL  /api/communities/:id/leave    — leave a community
                      # GET  /api/communities/:id/posts    — list posts (members only)
                      # POST /api/communities/:id/posts    — create post
                      # GET  /api/communities/:id/posts/:pid — single post with threaded comments
                      # POST /api/communities/:id/posts/:pid/comments — add comment or reply
                      #   (parent_id in body = reply to that comment, any depth)
                      # POST /api/communities/:id/posts/:pid/react — toggle post reaction
                      # POST /api/communities/:id/posts/:pid/comments/:cid/react — toggle comment reaction
                      # GET  /api/communities/activity-count?since= — count new activity
                      #   (posts + comments + reactions by others) for badge polling
                      # GET  /api/admin/communities        — all communities for admin review
                      # PUT  /api/admin/communities/:id/approve — approve + auto-join creator as moderator
                      # PUT  /api/admin/communities/:id/reject  — reject with optional reason
    __init__.py       # register_blueprints()
```

### DB migrations
`app.py` runs `_migrate_db()` on every startup. It uses a reusable `add_missing_cols(table, additions)` helper that calls `ALTER TABLE` for any column in models not yet present in the SQLite file. New tables (e.g. `community`, `community_membership`) are created automatically by `db.create_all()`. `_seed_memberships()` runs on every startup and silently no-ops when all members already have a tier.

Tables currently patched by `_migrate_db()`: `book` (genre, description, author_bio, cover_url, cover_color), `user` (avatar), `post_reaction` (created_at), `comment_reaction` (created_at).

### Fine calculation
`Borrow.calculate_fine()` reads `fine_per_day` live from the `setting` table. `borrow_days` (loan duration) is also read from `setting` at borrow time. Both are configurable by the admin at runtime.

---

## Frontend Structure

```
frontend/src/
  api.js                    # Axios instance — baseURL: /api, withCredentials: true
  constants.js              # GENRES list (shared across add/edit forms and filters)
  context/
    AuthContext.js          # AuthProvider + useAuth() — user, login(), logout(), updateUser()
                            # Axios interceptor: 401 clears user; 403 re-fetches /auth/me
                            # to re-sync React state with the real Flask session
                            # updateUser(patch) merges patch into user state (used after avatar upload)
    ThemeContext.js         # ThemeProvider + useTheme() — two independent axes:
                            #   appearance ('light'|'dark'|'system') → sets data-color-mode on <html>
                            #   readerTheme ('sepia'|'forest'|'ocean'|'rose'|'') → sets data-theme on <html>
                            #   'system' appearance listens to OS prefers-color-scheme and updates live
                            #   Both persisted in localStorage ('appearance', 'readerTheme')
                            #   Combined selectors ([data-color-mode="X"][data-theme="Y"]) give 10 total
                            #   theme combinations (2 base + 4 reader × 2 modes); combined selectors
                            #   have specificity 20 vs single-attribute 10 so reader+mode always wins
  components/
    TopBar.js               # Header with title on left; avatar button on right opens a profile dropdown
                            #   Dropdown sections (top → bottom):
                            #     avatar + username + tier badge (inline, not stretched)
                            #     Appearance row — 3 compact pd-option buttons: Light / System / Dark
                            #     Reader Themes row — 4 compact pd-option buttons: Sepia / Forest /
                            #       Ocean / Rose; clicking an active theme toggles it off (back to base)
                            #     Sign Out row
                            #   pd-options-row / pd-option / pd-option-active CSS for compact inline layout
                            #   Closes on outside click; fade+slide animation
                            #   Props: title, username, avatar, tier, onLogout
    UserAvatar.js           # Circular avatar — renders <img> when avatar (base64) is set,
                            #   otherwise a styled circle with the username's first initial
                            #   Props: avatar, username, size (default 32)
    NavTabs.js              # Tab bar driven by a tabs config array
                            #   accepts `badges = {}` prop: { [tabId]: number }
                            #   renders a red pill badge next to the tab label when count > 0
    Badge.js                # Status chip — variants: active (green), overdue (red), returned (gray),
                            #   queue (yellow — used for reservation queue position)
    Modal.js                # Overlay modal; wide prop for 640px variant
                            #   Header row has title on left and ✕ close button on right
                            #   Hero mode: heroBg + heroTextColor + heroContent props render a
                            #     full-width coloured zone (background set inline) that includes
                            #     the header; padding removed from .modal root; .modal-body
                            #     wraps the remaining children with restored padding
    SearchBar.js            # Controlled search input; supports autoFocus prop
  pages/
    (MemberDashboard.js exports one component but defines several helpers inline:)
    BookLoader              # Full-page animated CSS loader: open book with two halves
                            #   each having 5 placeholder lines, a spine div, and a
                            #   turning-page div; shown while initial data fetch is in flight
    BookStrip               # Horizontal scroll wrapper with left/right chevron arrows;
                            #   arrows only rendered when content overflows (ResizeObserver watches
                            #     scrollWidth > clientWidth on the rec-strip; re-checks on resize)
                            #   arrows are bare chevrons (no box/border), absolutely positioned over
                            #     the strip at 50% vertical; appear on mouseenter via JS state class
                            #     (arrows-active); auto-hide 2 s after the last click via setTimeout;
                            #     mouseLeave cancels the timer and hides immediately
                            #   scrolls 420 px per click with smooth behavior; each strip has its own
                            #     useRef, useState (active), useRef (timer)
    ReactionIcon            # Stroke-based inline SVG icon for community reactions;
                            #   types: like|love|haha|wow|sad|angry; size prop (default 13)
    CommentItem             # Recursive threaded comment with reaction buttons, Reply
                            #   toggle, inline reply form; visual indent capped at depth 4
    StarPicker              # 1–5 interactive star rating input with hover state
    StarDisplay             # Read-only star display from a numeric rating
    MembershipBadge         # Tier chip (Silver / Gold / Family) with tier-specific CSS class
    Login.js                # Sign-in / register form (role selector on register)
    MemberDashboard.js      # Home · Available Books · Community · My Profile tabs
                            #   TopBar receives avatar and tier; no badge prop
                            #   fetches /api/membership on mount alongside books/borrows
                            #   while loading, renders <BookLoader /> (animated CSS open-book
                            #     with page-lines on left and right halves, plus a turning page)
                            #   global accent theming: cover_color of the user's most recently
                            #     borrowed active book (or latest borrow) sets --accent /
                            #     --accent-text CSS vars on the layout root; WCAG-safe text
                            #     colour computed via wcagTextColor(); null if no borrow history
                            #
                            # Home tab (new, default landing tab):
                            #   1. Hero banner — time-aware greeting ("Good morning/afternoon/
                            #      evening/Hello night owl") + username + tagline
                            #   2. "What we offer" services strip — horizontally scrollable
                            #      cards with background-image photos, each describing a
                            #      library feature; scroll 380 px per arrow click; 6 cards:
                            #      Borrow Books · Reserve a Copy · AI Search · Personalised
                            #      Picks · Reading Communities · Donate & Earn
                            #      (images served from /public: service_borrow.jpg,
                            #       service_reserve.jpg, service_ai_search.jpg,
                            #       service_picks.jpg, service_community.jpg, service_donate.jpg)
                            #      Arrows: bare chevrons absolutely positioned over the cards
                            #      (position:absolute, top:50%), appear on mouseenter, auto-hide
                            #      2 s after the last click; JS state (servicesActive +
                            #      servicesTimerRef) drives visibility via arrows-active class
                            #   3. "From the collection" section — 6-book grid (first 6 books
                            #      from API); each card shows cover image (or placeholder),
                            #      title, author, genre badge, star rating; clicking a card
                            #      opens the Book Detail modal; "View all →" button navigates
                            #      to the Available Books tab
                            #
                            # Available Books tab (top → bottom):
                            #   1. Search trigger row — magnifying-glass icon button + book count
                            #      Active filters shown as a dot on the icon when panel is closed
                            #   2. Collapsible search panel (searchOpen state):
                            #      search-panel-top row: SearchBar (keyword) OR ai-search-input
                            #        (AI mode) + ✨ AI toggle button
                            #      Keyword mode: genre / availability / rating dropdowns + Clear
                            #      AI mode: natural-language input + Search button; fires
                            #        POST /api/books/ai-search on Enter or button click;
                            #        state: aiMode, aiQuery, aiResults, aiLoading, aiError
                            #      animates in with fade+translateY
                            #   3. Filtered results card grid (shown only when filters active) —
                            #      same rec-card style as strips; trending books get inline badge
                            #   4. Trending This Week strip — BookStrip with hover-reveal arrows;
                            #      cards identical in style to other strips
                            #   5. Recommended for you strip — content-based recs (BookStrip)
                            #   6. Readers like you also enjoyed strip — collab-filtered recs
                            #      (deduped against content-based strip client-side) (BookStrip)
                            #   7. All books grouped by genre — BookStrip per genre
                            #      Trending books show an inline "Trending" badge in the card title
                            #
                            #   BookStrip component — see BookStrip entry above
                            #
                            #   Click any card → Book Detail modal (wide):
                            #     Hero zone (coloured with book cover's dominant colour):
                            #       modal title + close button, cover image, meta rows
                            #       (Author/Genre/Available/Rating), action button
                            #       Text colours (labels, borders, subtle text) are computed
                            #       at render from cover_color via wcagTextColor() (WCAG AA)
                            #       coverPalette = useMemo over selectedBook.cover_color —
                            #       instant, no async canvas extraction
                            #     Below hero zone (default modal background):
                            #       Description + author bio (lazy-enriched)
                            #       Reviews list
                            #     ✕ close button in modal header (no bottom Close button)
                            #
                            # My Profile tab:
                            #   Avatar editor — 80px avatar circle; click to upload image file;
                            #     resized client-side via canvas (max 400×400, JPEG 0.88) before
                            #     PUT /api/auth/avatar; camera icon overlay on hover
                            #   Membership info card — tier badge, borrow limit, monthly rate,
                            #     family group members (family tier only)
                            #   My Borrowed Books — active borrows with Return button → Return+Review modal
                            #   My Reservations — queue position or ready status, cancel button
                            #   My Fines — fine amount and paid/unpaid status
                            #   Donate a Book section — Donate button opens modal; table of past
                            #     donations with status, estimated value, and credit earned;
                            #     total credits earned card (approved donations only)
                            # Return modal: optional 5-star picker, review text, anonymous toggle
                            # Donate modal: title, author, ISBN (optional), genre (optional),
                            #   condition dropdown (new/good/fair/poor), estimated value field
                            #   with live credit preview (value/4); success screen after submit
                            #
                            # Community tab (Gold members only; non-gold sees a locked card):
                            #   3-level view: list → community → post
                            #   List view: Browse all approved communities + My Communities strip;
                            #     Create Community button → modal (name, description); submitted
                            #     as pending until admin approves
                            #   Community view: community header, member count, Join/Leave button,
                            #     post list with SVG reaction mini-previews; Create Post button
                            #   Post view: full post content, SVG reaction bar (like/love/haha/wow/sad/angry),
                            #     threaded comments at unlimited depth (visual indent capped at depth 4),
                            #     reply-to-reply at any level
                            #   Notification badge: red number on the Community tab title showing
                            #     new posts + comments + reactions since last visit; polled every 60 s;
                            #     count stored in localStorage (communityLastSeen); badge clears on tab open
                            #   Reaction icons: stroke-based inline SVGs (no icon library),
                            #     keys: like | love | haha | wow | sad | angry
    AdminDashboard.js       # Books · Borrowed · Fines · Members · Communities · Donations tabs
                            # + Edit book modal + Inventory Logs modal + Member Records modal
                            # + Approve Donation modal + Reject Donation modal
                            # + Approve Community modal + Reject Community modal
                            # + Refresh All Log modal — opens on "Refresh All"; calls
                            #   POST /books/:id/scrape for each book sequentially; appends
                            #   a log entry per book (✓ title — description, cover, author bio,
                            #   color  |  ✗ title — failed) with a live progress bar
                            #
                            # Fines tab (merged):
                            #   Pending Fines table — all unpaid fines with Status badge
                            #     (Overdue / Returned Late) and Mark Paid button per row;
                            #     header shows total count + total dollar amount
                            #   Fine Policy form — fine_per_day and borrow_days (live editable)
                            #
                            # Members tab (merged):
                            #   All Members table — member list with tier badge + borrow history button
                            #   Membership Pricing cards — Silver / Gold / Family monthly rates (editable)
                            #   Member Tiers table — all members with current tier badge,
                            #     family group, and inline tier-change dropdown
                            #
                            # Communities tab:
                            #   Status filter buttons — Pending / Approved / Rejected / All
                            #   Table: community name, description, creator, member count,
                            #     post count, status badge, created date, Approve/Reject buttons
                            #   Approve modal: optional admin notes; auto-joins creator as moderator
                            #   Reject modal: optional reason
                            #
                            # Donations tab:
                            #   Status filter buttons — Pending / Approved / Rejected / All
                            #   Table: member, title (+ ISBN/genre sub-row), author, condition,
                            #     estimated value, credit awarded, status badge, submitted date,
                            #     Approve/Reject buttons (pending only), admin notes preview
                            #   Approve modal: credit field (defaults to price/4, editable),
                            #     optional admin notes; on confirm adds book to catalogue
                            #     (or increments copy count if title or ISBN already exists)
                            #   Reject modal: optional reason field
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
| POST | `/api/books/scrape-all` | admin | Scrape Open Library for every book sequentially; stores description, author_bio, cover_url, cover_color; returns `{ count }` |
| GET | `/api/trending` | member+ | Top 8 books by borrow count in the last 7 days; includes `borrow_count_week` |
| GET | `/api/recommendations` | member+ | Top 8 content-based recommendations for the caller |
| GET | `/api/collaborative-recommendations` | member+ | Top 8 collaborative-filtered recommendations for the caller |
| POST | `/api/books/ai-search` | member+ | Natural-language search via Groq; body `{ query }` returns up to 8 matched books with a `reason` field per book |

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
| PUT | `/api/admin/fines/:borrow_id/mark-paid` | admin | Mark a fine as paid |
| GET | `/api/admin/policy` | admin | Current fine policy |
| PUT | `/api/admin/policy` | admin | Update `fine_per_day` and `borrow_days` |
| GET | `/api/admin/members` | admin | All members; each entry includes `membership_tier` and `family_group_id` |
| GET | `/api/admin/members/:id/borrows` | admin | Full borrow history for one member |
| GET | `/api/admin/memberships/pricing` | admin | Current tier rates (`silver_rate`, `gold_rate`, `family_rate`) |
| PUT | `/api/admin/memberships/pricing` | admin | Update tier rates |
| PUT | `/api/admin/members/:id/membership` | admin | Set tier for a member (`{tier, family_group_id?}`); `tier: null` removes membership |

### Membership
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/membership` | member | Current user's tier, borrow limit, monthly rate, family group members |

### Donations
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/donations` | member | Submit a book donation (title, author, isbn?, genre?, condition, estimated_price) |
| GET | `/api/my-donations` | member | Caller's donation history |
| GET | `/api/admin/donations` | admin | All donations; optional `?status=pending\|approved\|rejected` filter |
| PUT | `/api/admin/donations/:id/approve` | admin | Approve donation — adds book to catalogue (or copy if title/ISBN already exists), sets credit_amount (default: estimated_price/4, admin-adjustable) |
| PUT | `/api/admin/donations/:id/reject` | admin | Reject donation with optional `admin_notes` |

### Communities (Gold members only)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/communities` | gold | All approved communities with caller's membership status |
| POST | `/api/communities` | gold | Create a community (status = pending until admin approves) |
| GET | `/api/my-communities` | gold | Communities the caller has joined |
| POST | `/api/communities/:id/join` | gold | Join an approved community |
| DELETE | `/api/communities/:id/leave` | gold | Leave a community |
| GET | `/api/communities/:id/posts` | gold+member | List posts (caller must be a member) |
| POST | `/api/communities/:id/posts` | gold+member | Create a post |
| GET | `/api/communities/:id/posts/:pid` | gold+member | Full post with nested comment tree |
| POST | `/api/communities/:id/posts/:pid/comments` | gold+member | Add top-level comment or reply (`parent_id` in body for replies at any depth) |
| POST | `/api/communities/:id/posts/:pid/react` | gold+member | Toggle post reaction (`emoji`: like\|love\|haha\|wow\|sad\|angry) |
| POST | `/api/communities/:id/posts/:pid/comments/:cid/react` | gold+member | Toggle comment reaction |
| GET | `/api/communities/activity-count?since=` | gold | Count new posts+comments+reactions since ISO timestamp (for badge polling) |
| GET | `/api/admin/communities` | admin | All communities for admin review |
| PUT | `/api/admin/communities/:id/approve` | admin | Approve community; auto-joins creator as moderator |
| PUT | `/api/admin/communities/:id/reject` | admin | Reject with optional reason |

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

### AI Search (`/api/books/ai-search`)
Optional natural-language book search powered by Groq (`llama-3.1-8b-instant`).

- Member types a freeform description (e.g. "boy with glasses at a magical school").
- Backend formats the full book catalogue (`id. "Title" by Author [Genre]`) into a prompt asking the model to rank the most relevant matches.
- Groq returns a raw JSON array `[{ "id": <int>, "reason": "<one-line explanation>" }]` ordered by relevance (up to 8 results).
- Backend validates IDs against the DB, hydrates each match with full book data (ratings, availability, reservation count), and returns the result.
- The API key is stored in `Config.GROQ_API_KEY` (falls back to env var `GROQ_API_KEY`).
- Model: `llama-3.1-8b-instant` at `temperature=0.1` for consistent, deterministic ranking.

**Frontend integration** (Available Books tab, search panel):
- A `✨ AI` toggle button sits at the right end of the search input row.
- When active: normal text filters are hidden; a natural-language input field takes their place; pressing Enter or clicking **Search** fires the request.
- Results render as a card grid with an italic `✨ <reason>` badge on each card.
- The book count label switches to `N AI matches` while in AI mode.
- Toggling off or clicking **Clear** resets to normal keyword + filter search.
- State: `aiMode`, `aiQuery`, `aiResults`, `aiLoading`, `aiError` (all local to `MemberDashboard`).

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

## Membership System

Three tiers control how many books a member can have active at once.

| Tier | Active borrow limit | Notes |
|------|-------------------|-------|
| `silver` | 1 | Standard access |
| `gold` | 3 | Full community section access |
| `family` | 1 per person | Up to 4 members share one plan; each has their own account |

**Borrow limit enforcement** is in `POST /api/borrow/:bookId`: before decrementing `available_copies` the endpoint counts `Borrow` records with `return_date = NULL` for the current user and compares against `Membership.borrow_limit()`. A 400 error is returned with a human-readable message (e.g. *"Silver membership allows 1 active borrow at a time"*). Users with no `Membership` record default to a limit of 1.

**Family plan grouping**: all `Membership` rows with the same non-null `family_group_id` integer belong to one family plan. Maximum 4 members per group. When an admin assigns `tier='family'` via the API, the backend auto-places the member in an existing group with room or creates a new group.

**Pricing** is stored in the `setting` table under keys `membership_silver_rate`, `membership_gold_rate`, `membership_family_rate`. Defaults: $9.99 / $19.99 / $29.99 per month. The admin can change these at runtime via the Memberships tab without restarting the server.

**Seeding**: `_seed_memberships()` in `models/__init__.py` runs on every startup. It finds any member `User` without a `Membership` row and randomly assigns them `silver`, `gold`, or `family`. Family members are grouped sequentially (4 per group). This is idempotent — it no-ops when all members already have a tier.

---

## Donation System

Members can donate physical books to the library. Donations sit in a `pending` queue until an admin reviews them.

**Member flow:**
1. Member clicks **Donate** in the My Profile tab → modal opens with form fields: title, author, ISBN (optional), genre (optional), condition (new/good/fair/poor), estimated value. A live preview shows the credit they will earn (value ÷ 4).
2. On submit, a `Donation` record is created with `status = 'pending'`. The member sees it immediately in the My Donations table.
3. Once approved, the credit amount appears in the table and a running total of all earned credits is shown in a summary card.

**Admin flow:**
1. Admin opens the Donations tab (defaults to Pending view) and sees a table of submitted donations.
2. **Approve**: opens a modal showing the default credit (estimated_price / 4). Admin can override the amount and add notes, then confirms. The book is added to the catalogue:
   - If the donated book's title matches an existing book (case-insensitive) or its ISBN matches, a copy is added to that existing record.
   - Otherwise a new `Book` row is created (ISBN defaults to `DONATED-{id}` if not provided).
   - A `BookLog` entry is written in both cases.
   - `donation.credit_amount` is set and `donation.status` → `'approved'`.
3. **Reject**: admin optionally provides a reason. `donation.status` → `'rejected'`.

**`Donation` model fields:** `id`, `user_id`, `title`, `author`, `isbn` (nullable), `genre` (nullable), `condition`, `estimated_price`, `credit_amount` (nullable — set on approval), `status`, `admin_notes` (nullable), `submitted_at`, `reviewed_at` (nullable), `book_id` (nullable FK — set to the matched or newly created book on approval).

**Credit** is stored per donation record. Total credit earned = sum of `credit_amount` across all approved donations for a user. There is no separate wallet table; the member UI computes the total client-side.

---

## Community System

Gold members can create communities, which go through admin approval before becoming active. Once approved, other Gold members can join and participate.

**Lifecycle:** `pending` → `approved` | `rejected` (admin decision).

**Roles within a community:** `member` (default on join) · `moderator` (creator is auto-assigned on approval).

**Threaded comments:** `CommunityComment.parent_id` is a self-referential FK. The backend `to_dict()` recursively serialises replies at any depth. The frontend `CommentItem` component is recursive with a `depth` prop; visual indentation is capped at depth 4 (uses `replies-list-flat` CSS class for lighter styling) but nesting continues in data.

**Reactions:** Six types — `like`, `love`, `haha`, `wow`, `sad`, `angry`. Stored as VARCHAR string keys (not emoji characters) in `PostReaction.emoji` / `CommentReaction.emoji`. Each user can have at most one reaction per post or comment (unique constraint); submitting the same reaction again toggles it off. Frontend renders stroke-based inline SVG icons (no icon library), 12–15 px, via the `ReactionIcon` component.

**Notification badge:** A red number on the Community tab label showing unseen activity. Computed by `GET /api/communities/activity-count?since=<iso>` which counts new posts, comments, post reactions, and comment reactions (by others) across all communities the caller is a member of. The frontend polls every 60 seconds when not on the Community tab; `communityLastSeen` is persisted in `localStorage` and updated whenever the Community tab is opened.

---

## Key Design Decisions

- **Theme system: two-axis CSS custom properties** — `data-color-mode` (light/dark) and `data-theme` (sepia/forest/ocean/rose) are independent HTML attributes. Combined two-attribute CSS selectors (`[data-color-mode="dark"][data-theme="sepia"]`) have specificity 20 vs single-attribute 10, so every reader+mode combo reliably overrides base mode variables. 10 total combinations.
- **WCAG AA compliance across all themes** — every `--text` through `--text-5` variable in all 10 theme combinations meets the 4.5:1 contrast ratio requirement against its `--bg`. The floor is tightest in constrained palettes (e.g. Forest Light green-on-green, Sepia Dark); `--text-4` and `--text-5` converge toward the same value in those cases rather than sacrificing compliance.
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
- **Cover colour extracted server-side, not client-side** — the dominant colour of each book cover is computed by the backend (Pillow, 64×64 downsample, mid-tone bin) and stored as `cover_color` in the database. It is served with the standard book list so member clients can apply it instantly when the detail modal opens — no async canvas extraction, no loading flicker. The WCAG-compliant foreground colour (`wcagTextColor`) is derived in the browser from the stored hex value at render time.
- **Recommendations are read-only and parallel** — all three discovery endpoints (`/trending`, `/recommendations`, `/collaborative-recommendations`) are pure reads with no side effects; they are fetched in parallel on mount and failures are silently ignored so they never degrade the core browsing experience.
- **Implicit rating weight (0.6)** — unrated borrows contribute a weight below a 3-star rating (0.6 < 0.6̄) so that books the user read but didn't bother to review pull less signal than books they actively rated. This prevents passive reads from dominating the preference profile.
- **Collab dedup is client-side** — the collaborative strip filters out IDs already shown in the content-based strip in React, keeping both endpoints independent and cacheable without needing server-side coordination.
- **Membership limit is active-borrow count, not weekly quota** — "per week" language in product specs maps cleanly to concurrent active borrows: Silver = 1, Gold = 3, Family = 1 per person. This avoids time-window queries and means the limit resets naturally when a book is returned.
- **Family group via integer ID, no separate table** — `family_group_id` on `Membership` is sufficient; a separate `FamilyGroup` table would add no behaviour. The backend auto-assigns groups when an admin sets tier to `family`.
- **Membership pricing in `setting` table** — reuses the existing key/value store (same pattern as `fine_per_day`) so pricing changes take effect at request time without a server restart.
- **Community reactions as string keys, not emoji chars** — storing `like`/`love`/etc. instead of emoji characters avoids encoding issues and makes the validation set (`VALID_REACTIONS`) unambiguous. The frontend resolves keys to SVG icons.
- **SVG reaction icons inline, no icon library** — avoids adding a dependency; the `ReactionIcon` component renders stroke-based 24×24 viewBox SVGs sized via a `size` prop (default 13). Icons are feather-style paths for visual consistency.
- **Notification badge via polling, not WebSockets** — 60-second polling via `setInterval` is simple and stateless. The activity-count endpoint is a single aggregating query; polling only runs when the Community tab is not active (to avoid counting events the user is already seeing).
- **Admin tab merging (Fines + Members)** — Pending Fines and Fine Policy share a tab; All Members, Membership Pricing, and Member Tiers share a tab. Reduces nav clutter without hiding functionality.
- **Comment depth capped visually at 4, not structurally** — nesting in data is unlimited; only the CSS indentation class switches at depth 4. This prevents the UI from becoming too narrow on deep threads while preserving full reply history.
- **AI search is a frontend toggle, not a separate page** — the `✨ AI` button lives inside the existing collapsible search panel so the feature is discoverable but not intrusive. Activating it clears normal filters (and vice-versa) so the two modes never conflict. Results use the same `books-grid` / `rec-card` layout as keyword results for visual consistency.
- **Groq over OpenAI for AI search** — Groq's inference is significantly faster (sub-second for this catalogue size), which matters for a search-as-you-submit UX. `llama-3.1-8b-instant` is sufficient for semantic book matching; the prompt is constrained to return only IDs from the provided catalogue so hallucinated books are structurally impossible.
- **API key in `Config`, not hardcoded** — `GROQ_API_KEY` is read from the environment (`os.environ.get`) with the key as the fallback default, making it easy to rotate without a code change.
