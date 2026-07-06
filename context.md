# Library Management System — Project Context

## Overview
A full-stack library management app. Admins manage the book catalogue, monitor borrows, configure fines, track inventory changes, review incoming book donations and book-add requests, and approve member membership-tier requests. Members browse books, borrow/return them, reserve books when all copies are out, save books to a wishlist, view their fines, leave optional ratings and reviews when returning a book, donate books to the library in exchange for credit, request that a missing book be added to the catalogue (and get notified on the Home tab once an admin reviews it), and request a membership tier (at registration or later) that activates once an admin approves it. The Books tab surfaces personalised recommendations and trending content to help members discover what to read next. The Home tab is a bold, colour-blocked collapsible dashboard of the member's own borrows/reservations/wishlist/collection highlights. Members can also switch between a classic tab bar and a Mac-style floating dock for navigation. Gold members additionally get community spaces and a set of book-themed word games (Hangman, Word Scramble, Wordle) that build toward a cumulative XP score.

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
                      #   Also calls models._seed_memberships() once at the end to give these
                      #   demo accounts (+ the original seed 'member') realistic random tiers —
                      #   real accounts pick their own tier via the membership-request flow instead
  config.py           # Config class — ports, CORS origin, secret key
  extensions.py       # db = SQLAlchemy() singleton
  decorators.py       # @login_required, @admin_required
  utils.py            # lock_book() — dialect-aware SELECT FOR UPDATE SKIP LOCKED helper
  models/
    user.py           # User (id, username, password_hash, role, avatar, xp)
                      #   avatar: TEXT nullable — base64 data-URL stored in DB; NULL = no photo
                      #   xp: INTEGER default 0 — cumulative Gold Games score, server-authoritative
                      #     (see "Gold Games & XP" below); included in to_dict() and /auth/me
                      #   has a joined-load `membership` relationship → Membership
    wishlist.py       # Wishlist (user_id FK, book_id FK, added_at) — one row per saved book;
                      #   unique per (user_id, book_id); to_dict() includes book title/author/
                      #     cover_url/availability so the frontend can render a card without a
                      #     second lookup
    genre.py          # Genre (id, name unique) — admin-extensible genre list backing the
                      #   book add/edit forms' genre dropdown, in addition to the static
                      #   constants.js GENRES list
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
    membership_request.py  # MembershipRequest (user_id FK, requested_tier: silver|gold|family,
                      #   notes nullable — member's optional note e.g. "paid cash at front desk",
                      #   status: pending|approved|rejected, admin_notes nullable,
                      #   submitted_at, reviewed_at nullable)
                      #   member-submitted request to be granted a tier; approval applies the
                      #   tier via admin.py's apply_tier() helper — see "Membership Request System" below
    book_request.py   # BookRequest (user_id FK, title, author nullable, isbn nullable,
                      #   genre nullable, notes nullable — member's optional note,
                      #   status: pending|approved|rejected, admin_notes nullable,
                      #   submitted_at, reviewed_at nullable, book_id nullable FK — set to the
                      #   newly added/matched book on approval,
                      #   notified bool default False — flips true once the member has dismissed
                      #     the approve/reject banner on the Home tab; lets the outcome survive
                      #     across sessions until acknowledged, unlike a localStorage flag)
                      #   member-submitted "please add this book" request, surfaced when a
                      #   catalogue search returns no results — see "Book Request System" below
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
                      #   _seed_memberships() — randomly assigns tiers to any unassigned members;
                      #     groups family members by family_group_id (max 4). No longer called
                      #     automatically on startup (real members choose a tier via the
                      #     membership-request flow instead) — only seed_extra.py calls it now,
                      #     once, to give demo accounts realistic tiers
  routes/
    auth.py           # /api/auth/  — register, login, logout, me, avatar (PUT)
                      #   /me now includes membership dict if user has one
                      #   register accepts optional requested_tier (member role only) — creates
                      #   a pending MembershipRequest in the same call; does NOT grant the tier
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
    wishlist.py       # GET /api/my-wishlist — caller's saved books, newest first
                      #   POST /api/wishlist/:bookId — save a book; 409 if already saved
                      #   DELETE /api/wishlist/:bookId — remove a saved book; 404 if not saved
    genres.py         # GET /api/genres — full genre list (any logged-in user)
                      #   POST /api/genres — admin adds a new genre; letters-only name,
                      #     normalized to Title Case, 409 if it already exists (case-insensitive)
    games.py          # POST /api/games/xp — Gold-only; body {amount}; adds amount (1–100,
                      #   MAX_XP_PER_AWARD) to the caller's User.xp and returns the new total;
                      #   _gold_user() (local copy of communities.py's helper) enforces tier —
                      #   see "Gold Games & XP" below
    admin.py          # /api/admin/ — borrows, fines, policy GET/PUT, members GET/POST,
                      #   memberships/pricing GET/PUT, members/<id>/membership PUT
                      #   PUT /api/admin/fines/<borrow_id>/mark-paid — mark a fine as paid
                      #     (sets fine_paid=True); 400 if no fine or already paid
                      #   members list now includes membership_tier and family_group_id
                      #   apply_tier(user_id, tier, family_group_id=None) — shared helper that
                      #     sets/clears a member's tier and auto-assigns a family group with room;
                      #     used by members/<id>/membership PUT and by membership_requests.py's
                      #     approve endpoint so the family-grouping logic isn't duplicated
    membership.py     # GET /api/membership — current user's tier, pricing, family members list
                      # GET /api/membership/pricing — unauthenticated pricing read, used by the
                      #   registration form (Login.js) to show real rates before a session exists
    membership_requests.py  # POST /api/membership-requests — member submits {tier, notes?};
                      #     400 if the caller already has a pending request
                      #   GET /api/my-membership-requests — caller's own requests, newest first
                      #   GET /api/admin/membership-requests — all requests (filterable by ?status=)
                      #   PUT /api/admin/membership-requests/:id/approve — calls admin.py's
                      #     apply_tier() to grant the tier immediately, sets status=approved
                      #   PUT /api/admin/membership-requests/:id/reject — sets status=rejected
                      #     with optional admin_notes
    donations.py      # /api/donations POST — member submits a donation
                      # /api/my-donations GET — member's own donation history
                      # /api/admin/donations GET — all donations (filterable by ?status=)
                      # /api/admin/donations/:id/approve PUT — approve: adds book (or copy)
                      #   to catalogue, sets credit_amount (default price/4, admin-adjustable)
                      # /api/admin/donations/:id/reject PUT — reject with optional reason
    book_requests.py  # POST /api/book-requests — member submits {title, author?, isbn?,
                      #   genre?, notes?}; only title is required
                      # GET  /api/my-book-requests — caller's own requests, newest first
                      # PUT  /api/book-requests/:id/dismiss — member acknowledges a reviewed
                      #   request's outcome; sets notified=True so the Home tab banner clears
                      # GET  /api/admin/book-requests — all requests (filterable by ?status=)
                      # PUT  /api/admin/book-requests/:id/approve — admin can edit title/author/
                      #   isbn/genre/total_copies before confirming; matches an existing book by
                      #   ISBN or case-insensitive title (adds copies) or creates a new Book,
                      #   same match-or-create logic as donations.py's approve endpoint
                      # PUT  /api/admin/book-requests/:id/reject — reject with optional admin_notes
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
`app.py` runs `_migrate_db()` on every startup. It uses a reusable `add_missing_cols(table, additions)` helper that calls `ALTER TABLE` for any column in models not yet present in the SQLite file. New tables (e.g. `community`, `community_membership`, `membership_request`, `book_request`) are created automatically by `db.create_all()`. `_seed_memberships()` is no longer called automatically on startup — see "Membership Request System" below.

Tables currently patched by `_migrate_db()`: `book` (genre, description, author_bio, cover_url, cover_color), `user` (avatar, xp), `post_reaction` (created_at), `comment_reaction` (created_at).

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
    ThemeContext.js         # ThemeProvider + useTheme() — three independent axes:
                            #   appearance ('light'|'dark'|'system') → sets data-color-mode on <html>
                            #   readerTheme ('sepia'|'forest'|'ocean'|'rose'|'') → sets data-theme on <html>
                            #   navStyle ('tabs'|'dock', default 'tabs') → both dashboards read this to
                            #     render NavTabs or Dock instead — set from the Navigation Style picker
                            #     in the member My Profile tab (see "Preferences" below); applies to the
                            #     admin dashboard too since the provider is global, same as appearance
                            #   'system' appearance listens to OS prefers-color-scheme and updates live
                            #   All three persisted in localStorage ('appearance', 'readerTheme', 'navStyle')
                            #   Combined selectors ([data-color-mode="X"][data-theme="Y"]) give 10 total
                            #   theme combinations (2 base + 4 reader × 2 modes); combined selectors
                            #   have specificity 20 vs single-attribute 10 so reader+mode always wins
  hooks/
    useToast.js             # Toast notification hook — returns { toasts, toast(msg, type?, action?) }
                            #   toast(msg) defaults type to 'success'; pass 'error' for red variant
                            #   optional 3rd arg action: { label, onClick } renders a clickable link
                            #     inside the toast (e.g. borrow/reserve/wishlist-add toasts link
                            #     to the My Profile tab) — omit for a plain message-only toast
                            #   each toast auto-expires after 2.8 s; IDs are monotonic so stacked
                            #   toasts each dismiss independently
  components/
    TopBar.js               # Header with title on left; avatar button on right opens a profile dropdown
                            #   Rendered inside a `.dashboard-header` wrapper (with NavTabs, or alone
                            #     when navStyle is 'dock') that is `position: sticky; top: 0` so the
                            #     header stays visible while the page content scrolls; z-index kept
                            #     below modals/toasts/dropdowns so it never overlaps them
                            #   Dropdown sections (top → bottom):
                            #     avatar + username + tier badge + XP total (Gold only, "N XP",
                            #       pd-xp) — inline, not stretched
                            #     Appearance row — 3 compact pd-option buttons: Light / System / Dark
                            #     Reader Themes row — 4 compact pd-option buttons: Sepia / Forest /
                            #       Ocean / Rose; clicking an active theme toggles it off (back to base)
                            #     Replay Tour row (pd-item, only rendered if onReplayTour passed) —
                            #       re-opens the Onboarding tour on demand
                            #     Sign Out row
                            #   pd-options-row / pd-option / pd-option-active CSS for compact inline layout
                            #   Closes on outside click; fade+slide animation
                            #   Props: title, username, avatar, tier, xp, onLogout, onReplayTour (optional)
    UserAvatar.js           # Circular avatar — renders <img> when avatar (base64) is set,
                            #   otherwise a styled circle with the username's first initial
                            #   Props: avatar, username, size (default 32)
    NavTabs.js              # Tab bar driven by a tabs config array
                            #   accepts `badges = {}` prop: { [tabId]: number }
                            #   renders a red pill badge next to the tab label when count > 0
                            #   Shown when navStyle === 'tabs' (default); Dock.js replaces it entirely
                            #     when navStyle === 'dock' (see below) — both take the same
                            #     tabs/active/onChange/badges props so dashboards swap one for the
                            #     other with no other changes
    Dock.js                 # Mac-style floating icon dock — alternative to NavTabs when the user's
                            #   navStyle preference is 'dock'; same tabs/active/onChange/badges props
                            #   Renders as a `position: fixed`, bottom-centered rounded pill
                            #     (`.dock-wrap` > `.dock`) with one icon button per tab, no text labels
                            #   ICONS — a hardcoded map of tab id → inline stroke-SVG icon covering
                            #     every member tab id (home/books/community/games/profile) and every
                            #     admin tab id (books/borrows/fines/members/communities/donations/
                            #     membership-requests); unrecognised ids fall back to a generic icon
                            #   Active tab gets an accent-coloured icon + a small dot indicator;
                            #     hover lifts the icon slightly (translateY + scale)
                            #   Badge counts render as a small red circle on the icon's corner
                            #   Both dashboards add a `layout-nav-dock` class to `.layout` when active,
                            #     which pads `.content` at the bottom so page content never sits under
                            #     the fixed dock
    Badge.js                # Status chip — variants: active (green), overdue (red), returned (gray),
                            #   queue (yellow — used for reservation queue position)
    Modal.js                # Overlay modal; wide prop for 640px variant
                            #   Header row has title on left and ✕ close button on right
                            #   Hero mode: heroBg + heroTextColor + heroContent props render a
                            #     full-width coloured zone (background set inline) that includes
                            #     the header; padding removed from .modal root; .modal-body
                            #     wraps the remaining children with restored padding
    SearchBar.js            # Controlled search input; supports autoFocus prop
    Select.js               # Custom themed dropdown replacing all native <select> elements
                            #   Props: value, onChange, children (<option> elements), className, disabled
                            #   onChange fires a synthetic { target: { value } } event so all existing
                            #     handlers work unmodified
                            #   Parses <option> children via React.Children.toArray (handles dynamic lists)
                            #   Closes on outside mousedown or Escape; chevron rotates 180° when open
                            #   Variants: default (form-group sizing, 10px padding) and .filter-select
                            #     (compact 6px padding) — applied via className prop
                            #   .form-group .custom-select stretches to full width automatically
    Toast.js                # Toast notification renderer — Props: toasts (array from useToast)
                            #   Renders a .toast-stack (fixed bottom-right, flex-column, 8px gap)
                            #   .toast-success uses --text/--bg (theme-aware); .toast-error is red
                            #   Each toast animates in with toast-in (fade + translateY)
                            #   Optional t.action renders a .toast-action underlined button inside
                            #     the toast (pointer-events re-enabled per-toast since the stack
                            #     itself is pointer-events:none)
    Onboarding.js           # Role-aware, interactive spotlight tour (see "Onboarding Tour" section below)
                            #   Props: role ('member' | 'admin'), username, onClose, onNavigate
                            #   Renders as a fixed-position overlay (.onboarding-overlay), independent
                            #     of the Modal component — no backdrop-click-to-close (Skip/Esc/finish only)
                            #   Each step either spotlights a real on-page element (switches tabs via
                            #     onNavigate, scrolls it into view, tracks its position live through
                            #     scroll/resize) or — for the welcome/closing steps only — falls back
                            #     to the original centered `.onboarding-card` (fixed 420×480 box)
                            #   Spotlight steps render `.tour-spotlight` (a box-shadow cutout that dims
                            #     the rest of the page, pulsing border) plus a `.tour-tooltip` callout
                            #     anchored above/below the target; both animate smoothly (CSS
                            #     transitions) as the tour moves between steps or the page scrolls
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
    LandingPage.js          # Public marketing page at "/" for logged-out visitors (see "Landing
                            #   Page" section below) — nav, hero, grayscale feature photo grid,
                            #   For Members / For Admins bullet cards, inverted CTA banner, footer
                            #   "Get Started" navigates to /login with { state: { register: true } };
                            #   "Sign In" navigates to /login with no state
    Login.js                # Sign-in / register form (role selector on register)
                            #   Reads useLocation().state?.register to open directly in register
                            #     mode when arriving from LandingPage's "Get Started" CTA
                            #   "← Back to home" link (react-router Link to "/") above the h1
                            #   When registering as a member: an optional tier picker (reuses the
                            #     .tier-picker/.tier-picker-option CSS also used in MemberDashboard's
                            #     My Profile tab) shown with live pricing from the unauthenticated
                            #     GET /api/membership/pricing; selecting a tier and toggling it off
                            #     again clears the selection (same deselect pattern as genre pills).
                            #     Included in the register payload as requested_tier — see
                            #     "Membership Request System" below; leaving it unset is fine, the
                            #     tier can always be requested later from My Profile
    MemberDashboard.js      # Home · Available Books · Community · Games · My Profile tabs
                            #   TopBar receives avatar, tier, and onReplayTour (reopens onboarding)
                            #   fetches /api/membership on mount alongside books/borrows
                            #   while loading, renders <BookLoader /> (animated CSS open-book
                            #     with page-lines on left and right halves, plus a turning page)
                            #   showOnboarding state — set true on mount if
                            #     localStorage["onboarding_seen_<username>"] is unset; renders
                            #     <Onboarding role="member" .../> as a sibling above .layout
                            #   global accent theming: cover_color of the user's most recently
                            #     borrowed active book (or latest borrow) sets --accent /
                            #     --accent-text CSS vars on the layout root; WCAG-safe text
                            #     colour computed via wcagTextColor(); null if no borrow history
                            #
                            # Home tab (default landing tab) — bold, colour-blocked, editorial
                            #   layout (vivid backgrounds + oversized type), not the earlier flat
                            #   "What we offer" services-strip design, which was removed entirely
                            #   (SERVICES const, servicesRef/servicesTimerRef/servicesActive state,
                            #   and its CSS are all gone — replaced by the sections below):
                            #
                            #   HOME_PALETTE (module scope) — 5 hand-picked vivid hex colours (hero/
                            #     borrowed/reservations/wishlist/collection), each run through
                            #     wcagTextColor() + minAlphaForContrast() (the same helpers the Book
                            #     Detail hero uses for cover_color) to pick black-or-white text and
                            #     alpha-tune label/subtle text tiers so every tier clears 4.5:1
                            #     against that exact background — a fixed palette, not per-book data
                            #   1. Hero banner (home-hero, HOME_PALETTE.hero: cobalt blue bg, white
                            #      text) — username eyebrow chip, oversized (3.25rem/800) time-aware
                            #      greeting ("Good morning/afternoon/evening/Hello night owl"),
                            #      subtitle; bottom edge cut on a diagonal via clip-path
                            #      (.home-slant-bottom)
                            #   2. Book-request notification banners (conditional; see "Book Request
                            #      System" below) — dismissible approve/reject outcome cards for the
                            #      caller's own book requests that haven't been acknowledged yet
                            #   3–6. Four collapsible, colour-blocked sections — My Borrowed Books,
                            #      My Reservations, My Wishlist (all three moved here from the My
                            #      Profile tab; My Fines and Donate a Book stayed in My Profile), and
                            #      From the collection (6-book grid, first 6 books from API, "View
                            #      all →" link to Available Books). Borrowed/Reservations/Wishlist
                            #      render the same .books-grid/.rec-card markup as the Available
                            #      Books grid (Collection uses .home-books-grid/.home-book-card
                            #      instead) — the exact same cover/title/author/meta markup either
                            #      way, so "my stuff" looks identical to browsing the catalogue:
                            #      - card is a div (role="button", not a <button>) so it can host a
                            #        stopPropagation'd .admin-card-actions row (Return / Cancel /
                            #        Remove) inside it while the rest of the card still opens the
                            #        Book Detail modal on click
                            #      - Borrowed Books shows Active/Overdue Badge + due date in the
                            #        .rec-card-avail line; Reservations shows Ready/Queue #N Badge;
                            #        Wishlist shows Available/Unavailable
                            #      - cover art is looked up by book_id against the already-loaded
                            #        `books` array (borrow/reservation/wishlist API responses don't
                            #        carry cover_url themselves, wishlist's does via book_cover)
                            #      - Section accordion: openHomeSection state (default "borrowed")
                            #        — only one of borrowed/reservations/wishlist/collection is
                            #        expanded at a time; toggleHomeSection(key) flips it, or closes
                            #        it entirely if it's already open. Header is a clickable
                            #        .home-section-toggle button (bold heading + ChevronDown that
                            #        rotates 180° via .home-section-chevron.open); collapsed sections
                            #        show only their header bar
                            #      - Sections overlap: .home-color-block has margin-top: -40px, so
                            #        each section (and each collapsed header bar) is pulled up over
                            #        the one above it — combined with .home-tab's gap: 0, sections
                            #        visually pile/stack rather than floating with whitespace between
                            #      - Diagonal accents: Reservations has both .home-slant-top and
                            #        .home-slant-bottom (a full parallelogram tilt); Collection has
                            #        .home-slant-top; Borrowed and Wishlist stay plain rounded blocks
                            #        for contrast. clip-path replaces border-radius on cut sides, and
                            #        those sides get extra padding so content clears the slant
                            #      - .empty state text and the "View all →" link inside a colour
                            #        block use `color: inherit` (the block's WCAG-verified text
                            #        colour) instead of the normal muted grey, since --text-5 isn't
                            #        guaranteed to contrast against an arbitrary vivid background
                            #
                            # Available Books tab (top → bottom):
                            #   1. Search trigger row — magnifying-glass icon button; book count
                            #      ("N books" / "N of M books" / "N AI matches") renders as its
                            #      own line (.book-count-label) directly below the row, not inline
                            #      Active filters shown as a dot on the icon when panel is closed
                            #   2. Collapsible search panel (searchOpen state):
                            #      search-panel-top row: SearchBar (keyword) OR ai-search-input
                            #        (AI mode) + AI toggle button
                            #      Keyword mode: availability / rating custom Select dropdowns + Clear
                            #        (genre filter also available via the genre pill strip below)
                            #      AI mode: natural-language input only; fires POST /api/books/ai-search
                            #        on Enter; no Search button — placeholder hints "(press Enter)"
                            #        3-second AbortController timeout — if request exceeds 3 s,
                            #        aiResults is set to [] which triggers the no-results state
                            #        state: aiMode, aiQuery, aiResults, aiLoading, aiError
                            #      Both modes show "No results found for this search." plus a
                            #        "Request that we add it" link (opens the Request a Book modal,
                            #        prefilled with the search/AI query as title — see "Book Request
                            #        System" below) when results are empty
                            #      animates in with fade+translateY
                            #   3. Filtered results card grid (shown only when filters active) —
                            #      same rec-card style as strips; trending books get inline badge
                            #   4. Genre pill strip — horizontally scrollable genre buttons; clicking
                            #      an already-active pill deselects it (toggles back to "All");
                            #      pill text uses --text so it adapts across all themes
                            #   5. Trending This Week strip — BookStrip with hover-reveal arrows;
                            #      cards identical in style to other strips
                            #   6. Recommended for you strip — content-based recs (BookStrip)
                            #   7. Readers like you also enjoyed strip — collab-filtered recs
                            #      (deduped against content-based strip client-side) (BookStrip)
                            #   8. All books grouped by genre — BookStrip per genre
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
                            #       BookActionButton: already-borrowed books show an active
                            #         "Return" button (closes this modal, opens the Return+Review
                            #         modal for that borrow) instead of a disabled "Borrowed" label
                            #       actionError (e.g. "Gold membership allows only 3 active borrows at
                            #         a time") renders inside this column, aligned under the action
                            #         buttons, not full-width; its colour is computed per-cover via
                            #         heroErrorColor — tries HERO_ERROR_REDS shades first, falls
                            #         back to the same guaranteed-safe black/white as coverPalette.text
                            #         so it always clears 4.5:1 against whatever the cover colour is
                            #     Below hero zone (default modal background):
                            #       Description + author bio (lazy-enriched)
                            #       Reviews list
                            #     ✕ close button in modal header (no bottom Close button)
                            #
                            # My Profile tab:
                            #   Avatar editor — 80px avatar circle; click to upload image file;
                            #     resized client-side via canvas (max 400×400, JPEG 0.88) before
                            #     PUT /api/auth/avatar; camera icon overlay on hover
                            #   Preferences section — Navigation Style picker (.nav-style-picker):
                            #     two cards, "Tab Bar" and "Dock", each with a small CSS-only preview
                            #     (mini tab strip / mini dock icons) and a label; clicking calls
                            #     ThemeContext's setNavStyle('tabs' | 'dock'), instantly swapping
                            #     NavTabs for Dock (see components/Dock.js) in both the header and
                            #     (were an admin viewing) the admin dashboard, since the preference
                            #     is stored globally the same way appearance/readerTheme are
                            #   Membership info card — tier badge, borrow limit, monthly rate,
                            #     family group members (family tier only)
                            #   Membership request — shown below the info card whenever there's no
                            #     pending request: a single custom Select dropdown (Silver/Gold/Family,
                            #     live pricing from GET /api/membership) — collapsed by default, so
                            #     the other tiers aren't always visible, unlike the always-shown
                            #     .tier-picker cards on the registration form (Login.js), which are
                            #     unchanged; selecting a tier reveals its .field-hint description
                            #     plus a Request Membership / Request Upgrade button
                            #     (POST /api/membership-requests); if a request is pending, a status
                            #     banner replaces the dropdown instead; if the last request was
                            #     rejected, the admin's reason is shown before the dropdown
                            #     reappears — see "Membership Request System" below
                            #   My Borrowed Books, My Reservations, and My Wishlist moved to the
                            #     Home tab (see above) — only My Fines and Donate a Book remain here
                            #   My Fines — fine amount and paid/unpaid status (still a .profile-table;
                            #     not book-card material)
                            #   Donate a Book section — Donate button opens modal; table of past
                            #     donations with status, estimated value, and credit earned;
                            #     total credits earned card (approved donations only)
                            # Return modal: optional 5-star picker, review text, anonymous toggle
                            # Donate modal: title, author, ISBN (optional), genre (optional),
                            #   condition — all dropdowns use the custom Select component
                            #   estimated value field with live credit preview (value/4);
                            #   success screen after submit
                            # Request a Book modal: title (required, prefilled from search query),
                            #   author/ISBN/genre (all optional, genre uses the custom Select),
                            #   notes textarea (optional) — POST /api/book-requests; success screen
                            #   after submit; see "Book Request System" below
                            # Toast notifications (useToast hook + Toast component) fire on:
                            #   borrow, return (with/without review), reserve, cancel reservation,
                            #   avatar upload, donation submit, book request submit, membership
                            #   request submit, join/leave community, create community, create post,
                            #   add to wishlist
                            #   Borrow, Reserve, and Add-to-wishlist toasts include a "View" action
                            #     link (toast(msg, "success", { label, onClick })) that closes the
                            #     Book Detail modal (if open) and switches to the My Profile tab
                            #
                            # Games tab (Gold members only; non-gold sees the same locked card
                            #   style as Community — shared .community-locked/-icon CSS, LockIcon
                            #   SVG instead of an emoji):
                            #   Menu view — .games-grid of 3 .game-card tiles (Book Title Hangman,
                            #     Word Scramble, Lit Wordle), each with an SVG icon (HangmanGameIcon/
                            #     ScrambleGameIcon/WordleGameIcon), name, and tagline; header shows
                            #     the caller's total XP (user.xp, "N XP", .games-xp-total)
                            #   Clicking a tile calls openGame(id) → sets gameView and starts that
                            #     game's state; "← Back to Games" (ChevronLeft icon) returns to the
                            #     menu without resetting scores already awarded
                            #
                            #   Book Title Hangman — pickHangmanWord() picks a random real book
                            #     title from the loaded `books` array (letters/digits/spaces/basic
                            #     punctuation only, 3–26 chars), falling back to a small curated
                            #     HANGMAN_FALLBACK_TITLES list of classics if the catalogue doesn't
                            #     have ≥5 eligible titles; 6 wrong guesses allowed; HangmanFigure
                            #     SVG (gallows always drawn, body parts revealed per wrong guess,
                            #     stroke="currentColor"); on-screen A–Z keyboard, letters recolour
                            #     correct/wrong once guessed; XP = max(10, 60 − wrong×10)
                            #   Word Scramble — random word from SCRAMBLE_WORDS (curated library/
                            #     literary vocabulary, 6–11 letters); shuffleWord() Fisher-Yates
                            #     shuffles until different from the original; Reshuffle re-shuffles
                            #     the same word, Hint reveals one more letter (uncapped attempts,
                            #     but each hint lowers the XP payout); XP = max(10, 50 − hints×15)
                            #   Lit Wordle — random 5-letter word from WORDLE_WORDS (literary-
                            #     themed); guesses are validated against WORDLE_VALID_WORDS (
                            #     WORDLE_WORDS ∪ a ~350-word COMMON_FIVE_LETTER_WORDS list) — an
                            #     invalid guess shows "Not a valid word" and does not consume an
                            #     attempt, same as real Wordle; wordleFeedback() does duplicate-
                            #     letter-safe correct/present/absent scoring; 6 rows; XP by guess
                            #     count: [100, 80, 60, 45, 30, 15]
                            #   All three games are client-side only (word banks, shuffling,
                            #     scoring logic all live in MemberDashboard.js — no new endpoints
                            #     for gameplay itself); only the XP award is a network call — see
                            #     "Gold Games & XP" below
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
    AdminDashboard.js       # Books · Borrowed · Fines · Members · Communities · Donations ·
                            #   Membership Requests · Book Requests tabs
                            # TopBar receives onReplayTour (reopens onboarding)
                            # navStyle (from useTheme()) picks NavTabs vs Dock for the tab bar,
                            #   same as MemberDashboard — see Dock.js and ThemeContext.js above
                            # showOnboarding state — set true on mount if
                            #   localStorage["onboarding_seen_<username>"] is unset; renders
                            #   <Onboarding role="admin" .../> as a sibling above .layout
                            # + Book Detail modal + Edit book modal + Inventory Logs modal
                            # + Member Records modal + Approve Donation modal + Reject Donation modal
                            # + Approve Community modal + Reject Community modal
                            # + AI Generate Field modal + Cover Upload modal
                            # + Refresh All Log modal — opens on "Refresh All"; calls
                            #   POST /books/:id/scrape for each book sequentially; appends
                            #   a log entry per book (✓ title — description, cover, author bio,
                            #   color  |  ✗ title — failed) with a live progress bar
                            #
                            # Books tab:
                            #   Card grid (same rec-card style as the member Books tab) — cover,
                            #     title, author, genre, rating, availability per book; a card
                            #     shows "Missing: description, author bio, cover" when any of
                            #     those enrichment fields are absent
                            #   Each card has an inline action row (stopPropagation'd so it
                            #     doesn't open the detail modal): Edit / Logs / Refresh / Delete
                            #   Clicking the card body opens the Book Detail modal — a
                            #     cover-colour-tinted hero (same wcagTextColor/coverPalette
                            #     derivation as MemberDashboard) with author/genre/ISBN/copies/
                            #     rating rows, description, author bio, and read-only reviews
                            #     (GET /books/:id/reviews)
                            #   Missing description/author bio show a "✨ Generate…" button in
                            #     the detail modal that opens the AI Generate Field modal
                            #     (POST /books/:id/generate-field, PUT .../patch-metadata); when
                            #     the field already has content, the same modal opens in "edit"
                            #     mode instead ("Edit" link, pre-filled, no AI call) so admins can
                            #     always overwrite description/author bio by hand, not just fill
                            #     gaps; missing cover shows "+ Add cover" opening the Cover Upload
                            #     modal (file or URL, PUT .../patch-metadata) — both modals
                            #     previously only reachable via the Refresh Log's "Fill missing"
                            #     section, now also directly accessible from the detail view
                            #   AI Generate Field modal — if Groq generation runs past 5 seconds
                            #     (aiGenSlow state, set by a setTimeout started when the call
                            #     begins), a "Write it yourself instead" button appears so the
                            #     admin isn't stuck waiting; clicking it drops out of the loading
                            #     state into the plain textarea. aiGenRequestIdRef guards every
                            #     generate call so a late Groq response — after a manual bail-out,
                            #     a Regenerate click, or closing the modal — is detected as stale
                            #     (request id no longer matches) and its result is discarded rather
                            #     than clobbering whatever the admin has since typed or closed
                            #   Detail modal's action row: Edit Book / Logs / Refresh metadata /
                            #     Delete — Edit, Logs, and Delete close the detail modal first;
                            #     Refresh keeps it open since `books` state updates reactively
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
                            #     family group, and inline tier-change custom Select
                            # Toast notifications fire on: add book, delete book, edit book,
                            #   refresh metadata, mark fine paid, save policy, save membership
                            #   pricing, change member tier, approve/reject donation,
                            #   approve/reject community, approve/reject membership request;
                            #   policy/pricing no longer use inline "Saved" state — toasts
                            #   replace those entirely
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
                            #
                            # Membership Requests tab:
                            #   Status filter buttons — Pending / Approved / Rejected / All
                            #   Table: member, requested tier (badge), member's optional note,
                            #     status badge, submitted date, Approve/Reject buttons (pending
                            #     only), admin notes preview
                            #   Approve modal: optional admin notes only (no credit field); on
                            #     confirm calls admin.py's apply_tier() so the tier is active
                            #     immediately (family requests auto-assigned to a group with room)
                            #   Reject modal: optional reason field (shown to the member)
                            #
                            # Book Requests tab:
                            #   Status filter buttons — Pending / Approved / Rejected / All
                            #   Table: member, book (title + author/genre sub-row), member's
                            #     optional note, status badge, submitted date, Approve/Reject
                            #     buttons (pending only), admin notes preview
                            #   Approve modal: title/author/ISBN/genre editable (pre-filled from
                            #     the request; genre uses the custom Select populated from the
                            #     live `genres` list), copies-to-add field (default 1), optional
                            #     admin notes; on confirm, PUT .../approve matches an existing book
                            #     by ISBN or case-insensitive title (adds copies) or creates a new
                            #     Book — same match-or-create logic as the Donations approve flow
                            #   Reject modal: optional reason field (shown to the member)
```

### Auth flow
`AuthContext` calls `GET /api/auth/me` on mount. A 401 sets `user = null`. Login/register calls set `user` via `login(userData)`. All protected pages use `useAuth()` — no prop drilling.

A global Axios response interceptor handles session drift: a 401 clears the user immediately; a 403 re-fetches `/auth/me` and updates React state to match the real Flask session (prevents stale "admin" UI after switching accounts in the same browser).

### Routing (`App.js`)
| Path | Logged out | Logged in |
|---|---|---|
| `/` | `LandingPage` (public marketing page) | `AdminDashboard` or `MemberDashboard` (by role) |
| `/login` | `Login` | redirects to `/` |
| `/*` (anything else) | redirects to `/` | `AdminDashboard` or `MemberDashboard` (by role) |

Unauthenticated visitors land on the public `LandingPage` at `/` rather than being sent straight to `/login`; `Login` is only reached via its CTAs or a direct `/login` visit.

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user (role selectable via payload); optional `requested_tier` (member role only) creates a pending `MembershipRequest` — does not grant the tier |
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

### Wishlist
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/my-wishlist` | member | Caller's saved books, newest first |
| POST | `/api/wishlist/:bookId` | member | Save a book; 409 if already saved |
| DELETE | `/api/wishlist/:bookId` | member | Remove a saved book; 404 if not saved |

### Genres
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/genres` | member+ | Full genre list |
| POST | `/api/genres` | admin | Add a genre; letters-only name, normalized to Title Case; 409 if it already exists |

### Games (Gold members only)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/games/xp` | gold | Award XP for a completed Gold Game; body `{ amount }` (1–100); returns `{ xp }` (new total) |

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
| GET | `/api/membership/pricing` | — | Public pricing read (`silver_rate`, `gold_rate`, `family_rate`) — used by the registration form before a session exists |

### Membership Requests
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/membership-requests` | member | Submit a tier request (`{ tier, notes? }`); 400 if the caller already has a pending request |
| GET | `/api/my-membership-requests` | member | Caller's own requests, newest first |
| GET | `/api/admin/membership-requests` | admin | All requests; optional `?status=pending\|approved\|rejected` filter |
| PUT | `/api/admin/membership-requests/:id/approve` | admin | Approve — grants the requested tier immediately via `apply_tier()` (family requests auto-assigned to a group with room) |
| PUT | `/api/admin/membership-requests/:id/reject` | admin | Reject with optional `admin_notes` |

### Donations
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/donations` | member | Submit a book donation (title, author, isbn?, genre?, condition, estimated_price) |
| GET | `/api/my-donations` | member | Caller's donation history |
| GET | `/api/admin/donations` | admin | All donations; optional `?status=pending\|approved\|rejected` filter |
| PUT | `/api/admin/donations/:id/approve` | admin | Approve donation — adds book to catalogue (or copy if title/ISBN already exists), sets credit_amount (default: estimated_price/4, admin-adjustable) |
| PUT | `/api/admin/donations/:id/reject` | admin | Reject donation with optional `admin_notes` |

### Book Requests
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/book-requests` | member | Submit a "please add this book" request (title required; author, isbn, genre, notes optional) |
| GET | `/api/my-book-requests` | member | Caller's own requests, newest first |
| PUT | `/api/book-requests/:id/dismiss` | member | Mark a reviewed request's outcome as seen (`notified=True`); clears its Home tab banner |
| GET | `/api/admin/book-requests` | admin | All requests; optional `?status=pending\|approved\|rejected` filter |
| PUT | `/api/admin/book-requests/:id/approve` | admin | Approve — admin can edit title/author/isbn/genre/total_copies before confirming; matches an existing book by ISBN or case-insensitive title (adds copies) or creates a new one |
| PUT | `/api/admin/book-requests/:id/reject` | admin | Reject with optional `admin_notes` |

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
| `gold` | 3 | Full community section access + Gold Games (Hangman/Scramble/Wordle) & XP |
| `family` | 1 per person | Up to 4 members share one plan; each has their own account |

**Borrow limit enforcement** is in `POST /api/borrow/:bookId`: before decrementing `available_copies` the endpoint counts `Borrow` records with `return_date = NULL` for the current user and compares against `Membership.borrow_limit()`. A 400 error is returned with a human-readable message (e.g. *"Silver membership allows 1 active borrow at a time"*). Users with no `Membership` record default to a limit of 1.

**Family plan grouping**: all `Membership` rows with the same non-null `family_group_id` integer belong to one family plan. Maximum 4 members per group. When an admin assigns `tier='family'` via the API, the backend auto-places the member in an existing group with room or creates a new group.

**Pricing** is stored in the `setting` table under keys `membership_silver_rate`, `membership_gold_rate`, `membership_family_rate`. Defaults: $9.99 / $19.99 / $29.99 per month. The admin can change these at runtime via the Memberships tab without restarting the server.

**How a member gets a tier**: real members no longer get a tier automatically — they pick one via the membership-request flow (see below) and an admin approves it. `_seed_memberships()` in `models/__init__.py` (random tier assignment, family members grouped sequentially in groups of 4) still exists but is **not called on server startup** — it's only invoked explicitly, once, by `seed_extra.py` to give demo accounts (alice/bob/carol/dave/member) realistic tiers.

---

## Membership Request System

Members choose their own tier — at registration, or anytime later from My Profile — rather than having one assigned. Payment is currently handled offline (in person); online payment is a possible future addition. Mirrors the Donation System's `pending → approved/rejected` shape almost exactly.

**Member flow:**
1. **At registration**: the register form (`Login.js`) shows a `.tier-picker` with live pricing (from the public `GET /api/membership/pricing`); picking a tier is optional (default is "decide later"). If a tier is selected, a `MembershipRequest` is created with `status='pending'` in the same call that creates the account — the account is **not** granted the tier yet.
2. **Later, from My Profile**: if the member has no pending request, a `.tier-picker` (Silver/Gold/Family, live pricing from `GET /api/membership`) appears below the membership info card, with a **Request Membership** (no tier yet) or **Request Upgrade** (already has a tier) button. Submitting calls `POST /api/membership-requests`.
3. While a request is `pending`, the picker is replaced by a status banner ("Requested — awaiting admin approval") — the 400 guard on the backend also prevents submitting a second request in the meantime.
4. If the most recent request was `rejected`, the admin's reason (if any) is shown once, then the picker reappears so the member can submit a new request.

**Admin flow:**
1. Admin opens the **Membership Requests** tab (defaults to Pending view) and sees a table of submitted requests — member, requested tier, the member's optional note, status, submitted date.
2. **Approve**: optional admin notes, then confirms. Calls the same `apply_tier()` helper used by the direct admin tier-change endpoint (`admin.py`) — the tier is granted immediately; a `family` request is auto-assigned to an existing group with room (< 4 members) or a new group, exactly like the direct admin flow.
3. **Reject**: admin optionally provides a reason, shown to the member on their next visit to My Profile.

**`MembershipRequest` model fields:** `id`, `user_id`, `requested_tier` (silver/gold/family), `notes` (nullable — member's optional note), `status` (pending/approved/rejected), `admin_notes` (nullable), `submitted_at`, `reviewed_at` (nullable).

**Shared tier logic**: `apply_tier(user_id, tier, family_group_id=None)` in `routes/admin.py` is the single place that sets/clears a `Membership` row and handles family-group auto-assignment. Both `PUT /api/admin/members/:id/membership` (direct admin override) and `PUT /api/admin/membership-requests/:id/approve` (request approval) call it, so the family-grouping logic exists in exactly one place.

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

## Book Request System

Lets a member ask the library to add a book that isn't in the catalogue, surfaced right where the need shows up: an empty search result. Mirrors the Donation/Membership Request systems' `pending → approved/rejected` shape.

**Member flow:**
1. A keyword or AI search that returns no results shows "No results found for this search." plus a **Request that we add it** link, prefilled with the search query as the title.
2. The Request a Book modal collects title (required), author/ISBN/genre (optional), and a free-text notes field. Submitting creates a `BookRequest` with `status = 'pending'`.
3. Once an admin reviews it, the outcome appears as a banner on the Home tab (not buried in a table the member has to go check): approved requests show *"'Title' — the book you requested was approved and is now in the catalogue!"* with a **View book** link straight to the Book Detail modal; rejected requests show the admin's reason if one was given. Dismissing a banner (✕) calls `PUT /api/book-requests/:id/dismiss`, which sets `notified = True` server-side — so, unlike a `localStorage` flag, the "already seen" state follows the account across devices/sessions rather than resetting on a new browser.

**Admin flow:**
1. Admin opens the **Book Requests** tab (defaults to Pending view) and sees a table of submitted requests — member, book (title/author/genre), the member's optional note, status, submitted date.
2. **Approve**: opens a modal pre-filled from the request but every field (title, author, ISBN, genre, copies-to-add) is editable, since the member's info may be incomplete or need cleanup before it becomes a catalogue entry. Confirming matches an existing book by ISBN or case-insensitive title (and just adds copies) or creates a new `Book` — identical match-or-create logic to the Donations approve endpoint. A `BookLog` entry is written either way.
3. **Reject**: admin optionally provides a reason, shown to the member on their next Home tab visit.

**`BookRequest` model fields:** `id`, `user_id`, `title`, `author` (nullable), `isbn` (nullable), `genre` (nullable), `notes` (nullable), `status` (pending/approved/rejected), `admin_notes` (nullable), `submitted_at`, `reviewed_at` (nullable), `book_id` (nullable FK — set to the matched or newly created book on approval), `notified` (bool, default False — flips true once the member dismisses the Home tab banner).

---

## Community System

Gold members can create communities, which go through admin approval before becoming active. Once approved, other Gold members can join and participate.

**Lifecycle:** `pending` → `approved` | `rejected` (admin decision).

**Roles within a community:** `member` (default on join) · `moderator` (creator is auto-assigned on approval).

**Threaded comments:** `CommunityComment.parent_id` is a self-referential FK. The backend `to_dict()` recursively serialises replies at any depth. The frontend `CommentItem` component is recursive with a `depth` prop; visual indentation is capped at depth 4 (uses `replies-list-flat` CSS class for lighter styling) but nesting continues in data.

**Reactions:** Six types — `like`, `love`, `haha`, `wow`, `sad`, `angry`. Stored as VARCHAR string keys (not emoji characters) in `PostReaction.emoji` / `CommentReaction.emoji`. Each user can have at most one reaction per post or comment (unique constraint); submitting the same reaction again toggles it off. Frontend renders stroke-based inline SVG icons (no icon library), 12–15 px, via the `ReactionIcon` component.

**Notification badge:** A red number on the Community tab label showing unseen activity. Computed by `GET /api/communities/activity-count?since=<iso>` which counts new posts, comments, post reactions, and comment reactions (by others) across all communities the caller is a member of. The frontend polls every 60 seconds when not on the Community tab; `communityLastSeen` is persisted in `localStorage` and updated whenever the Community tab is opened.

---

## Gold Games & XP

A second Gold-only perk alongside Community: three classic word/vocabulary games (Book Title Hangman, Word Scramble, Lit Wordle) in their own **Games** tab, each awarding XP toward a single cumulative, server-authoritative score shown across the app.

**Gameplay is entirely client-side** — word banks, shuffling, letter/guess validation, and scoring all live in `MemberDashboard.js` (see the "Games tab" entry under Frontend Structure above for each game's rules). The backend is only involved in the one thing that must be tamper-resistant: the running total.

**XP awarding:** on a win, the frontend computes an amount from that game's own formula (Hangman: `max(10, 60 − wrong×10)`; Scramble: `max(10, 50 − hints×15)`; Wordle: `[100, 80, 60, 45, 30, 15]` indexed by guess count) and calls `POST /api/games/xp` with `{ amount }`. `routes/games.py` re-checks Gold membership server-side (`_gold_user()`) and rejects any non-integer or out-of-range amount (`0 < amount <= 100`), then does `user.xp += amount` and returns the new total, which the frontend syncs into React state via `updateUser({ xp })`. There is no per-game or historical XP breakdown stored — `User.xp` is a single running counter.

**Where XP is shown:** the Games tab menu header ("N XP") and the TopBar profile dropdown (Gold members only, next to the tier badge). Both read `user.xp` directly off the auth context — no separate fetch.

**Lit Wordle word validation:** unlike a typical "any 5 letters" placeholder implementation, guesses must be real words. `WORDLE_VALID_WORDS` is the union of the literary answer list (`WORDLE_WORDS`) and a ~350-word common-English list (`COMMON_FIVE_LETTER_WORDS`), both hardcoded client-side (no dictionary API/network call). A guess not in that set shows an inline "Not a valid word" message and is not counted as one of the 6 attempts.

---

## Landing Page

A public marketing page (`pages/LandingPage.js`) rendered at `/` for logged-out visitors — see the Routing table above. Monochrome, matches the rest of the site's fonts/CSS variables (no new dependencies).

**Sections (top → bottom):**
1. Nav — "Library" wordmark + Sign In / Get Started buttons
2. Hero — eyebrow, headline, subtext, dual CTA row
3. Feature photo grid — its own 6-card `SERVICES`-style array (Borrow Books, Reserve a Copy, AI Search, Personalised Picks, Reading Communities, Donate & Earn) using the same `/service_*.jpg` images the member Home tab's services strip used to; rendered with `filter: grayscale(1)` and a bottom gradient overlay (title + description) to keep the public page strictly monochrome. Independent of `MemberDashboard.js`, which removed its own services strip in favour of the colour-blocked Home tab sections — see Home tab notes above
4. "For Members" / "For Admins" two-column bullet cards (reuses `.onboarding-list` styling)
5. Inverted CTA banner — `background: var(--text); color: var(--bg)` so it flips correctly across all 10 theme combinations without hardcoded colours
6. Footer — product name + Sign In link

**Get Started → Register:** clicking "Get Started" calls `navigate('/login', { state: { register: true } })`; `Login.js` reads `useLocation().state?.register` to initialise `isRegister` as `true`, landing the visitor directly on the register form. Plain "Sign In" navigates with no state (defaults to sign-in mode). `Login.js` also has a "← Back to home" link (`Link to="/"`).

---

## Onboarding Tour

A role-aware, interactive tour (`components/Onboarding.js`) introduces new sessions to the feature set by spotlighting the real UI element each step talks about, rather than just describing it in a static modal. Rendered as its own fixed-position overlay (separate from `Modal.js` — no backdrop-click-to-dismiss; only Skip, Escape, or finishing the last step closes it).

**Trigger & persistence:** Both `MemberDashboard.js` and `AdminDashboard.js` hold a `showOnboarding` boolean. On mount, if `localStorage["onboarding_seen_<username>"]` is unset, the tour is shown automatically; closing it (Skip or finishing) sets that key so it won't auto-show again for that user. It can be re-opened anytime via **Replay Tour** in the `TopBar` profile dropdown (passed down as `onReplayTour`).

**Step shape:** each step is either a spotlight step (has a `target` CSS selector like `[data-tour="member-search"]`, and optionally a `tab` to switch to first) or a bookend step (welcome/closing, no target — rendered as the original centered card). `role="member"` renders 6 steps (welcome → search/AI → borrowing & reservations → membership → donations → profile, closing); `role="admin"` renders 8 (welcome → Books → Borrowed Books → Fines → Members → Donations → Communities → closing), one step per admin tab.

**Spotlight mechanics:** on each step change, `Onboarding` calls the `onNavigate` prop (the dashboard's `handleTabChange`) if the step has a `tab`, then locates `document.querySelector(target)`, calls `scrollIntoView({ block: 'center' })`, and tracks the element's `getBoundingClientRect()` continuously via scroll/resize listeners (so the highlight stays correct if the page moves). The target elements are marked with plain `data-tour="…"` attributes in `MemberDashboard.js` / `AdminDashboard.js` (e.g. the search row, genre strip, membership card, Donate section header; each admin tab's `.section-header`) — no separate registry, the selector is just read off the DOM.

**Rendering:** `.tour-spotlight` is a `position: fixed` box sized to the target's rect (plus a few px padding) whose `box-shadow: 0 0 0 6000px var(--overlay)` dims the entire rest of the page in one element (no separate dimming layer needed) — an animated `::after` border pulses around it. A `.tour-tooltip` callout is positioned above or below the target (whichever has more room; `bottom` is used instead of `top` for the "above" case so no height measurement is needed) and horizontally clamped to stay on-screen. Both the spotlight box and the tooltip transition smoothly (CSS `transition` on position/size) between steps and as the page scrolls; the tooltip's content fades in per step via a `key={step}`-driven animation. Bookend steps (no target) fall back to the original fixed 420×480px `.onboarding-card` with the dimmed `.onboarding-overlay` background.

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
- **AI search is a frontend toggle, not a separate page** — the AI button lives inside the existing collapsible search panel so the feature is discoverable but not intrusive. Activating it clears normal filters (and vice-versa) so the two modes never conflict. Results use the same `books-grid` / `rec-card` layout as keyword results for visual consistency.
- **AI search submit is Enter-only, no button** — removing the Search button keeps the input row uncluttered; the placeholder hints `(press Enter)`. A 3-second `AbortController` timeout guards against slow Groq responses — if the request is aborted, the empty-results state renders instead of a hanging spinner.
- **Groq over OpenAI for AI search** — Groq's inference is significantly faster (sub-second for this catalogue size), which matters for a search-as-you-submit UX. `llama-3.1-8b-instant` is sufficient for semantic book matching; the prompt is constrained to return only IDs from the provided catalogue so hallucinated books are structurally impossible.
- **API key in `Config`, not hardcoded** — `GROQ_API_KEY` is read from the environment (`os.environ.get`) with the key as the fallback default, making it easy to rotate without a code change.
- **Custom Select replaces all native dropdowns** — `Select.js` parses `<option>` children via `React.Children.toArray` and fires a synthetic `{ target: { value } }` event so all existing onChange handlers work without modification. Two size variants: default (form-group, full-width) and `.filter-select` (compact inline). Fully theme-aware via CSS custom properties.
- **Toast system via `useToast` hook** — a module-level counter generates monotonic IDs so concurrent toasts each auto-dismiss independently after 2.8 s. Success toasts use `--text`/`--bg` (inverted, theme-safe); error toasts are hardcoded red. Both dashboards share the same hook; the `Toast` component is rendered once at the root of each page.
- **Genre pill deselect** — clicking an active genre pill toggles it off (sets `selectedGenre` to `""`) rather than requiring the user to click the "All" pill. Same behaviour as many filter UIs users already know.
- **Onboarding tracked per-username in `localStorage`, not the database** — a `seen`/`not seen` flag doesn't warrant a schema change or API round trip; `onboarding_seen_<username>` is simple, works offline, and is trivially resettable (Replay Tour, or clearing the key) without touching the backend.
- **Onboarding bookend card is fixed-size, not content-sized** — steps vary from a one-line paragraph to a 3-item bullet list; letting the card grow/shrink per step made the progress dots and footer buttons jump around between clicks. Fixing `.onboarding-card` at 420×480px and making only the inner content region (`flex: 1; overflow-y: auto`) flexible keeps navigation controls in a constant position. Only the welcome/closing steps use this card — spotlight steps use the smaller `.tour-tooltip` instead, sized to its content.
- **Spotlight dimming is one box-shadow, not a separate overlay layer** — `.tour-spotlight`'s `box-shadow: 0 0 0 6000px var(--overlay)` dims the whole page and cuts out the highlighted element in a single element, instead of a full-screen dim `<div>` plus a transparent cutout punched through it (e.g. via `clip-path` or an SVG mask). Simpler to position and animate.
- **Tooltip "above" placement uses CSS `bottom`, not a measured height** — computing `top = target.top - tooltipHeight - gap` would need a two-pass render (measure the tooltip, then position it) since content length varies per step. Anchoring with `bottom: window.innerHeight - target.top + gap` instead lets the browser handle the height, so placement is a single synchronous calculation from the target's `getBoundingClientRect()` alone.
- **Tour targets are plain `data-tour` attributes, not a central registry** — each step's `target` is just a CSS selector (`[data-tour="member-search"]`) matched against attributes already sitting on the relevant JSX elements in `MemberDashboard.js`/`AdminDashboard.js`. Adding a new step means adding one attribute at the element and one step object — no separate mapping table to keep in sync.
- **Membership requests mirror the Donation system's shape exactly** (`pending → approved/rejected`, admin reviews, member sees status in profile) — same lifecycle, same problem shape (member submits something that needs admin sign-off before it takes effect), so the same pattern was reused rather than inventing a new one.
- **Tier-apply logic centralized in `apply_tier()`** (`routes/admin.py`) — both the admin's direct tier-change endpoint and membership-request approval need to set a tier and handle family-group auto-assignment; extracting it once avoids the family-grouping logic (find a group with room, else start a new one) existing in two places that could drift apart.
- **Random tier auto-assignment removed from server startup** — `_seed_memberships()` used to run on every startup so any member missing a `Membership` row got a random tier. That's incompatible with a real request-based flow (a restart would silently grant a tier before the member ever asked for one), so it's now only ever called explicitly by `seed_extra.py`, once, for demo accounts.
- **Landing page reuses Home tab imagery in grayscale rather than new assets** — the public page needed to feel visually consistent with "clean monochrome" while still showing real product photography; applying `filter: grayscale(1)` to the existing `/service_*.jpg` files (already used by the member Home tab) avoided sourcing new images or adding an illustration system.
- **XP is a single server-side counter, not per-game/session state** — `User.xp` is the only source of truth; the frontend never trusts a locally-accumulated total. Each game POSTs one small, range-checked amount per win (`routes/games.py` clamps to `0 < amount <= 100`) rather than the client sending a cumulative score, so a stale tab or a replayed request can only ever add one more valid win's worth of XP, not an arbitrary total.
- **Lit Wordle guesses are validated against a hardcoded word list, not a dictionary API** — `WORDLE_VALID_WORDS` (the answer list ∪ ~350 common words) is bundled client-side like `SCRAMBLE_WORDS`/`HANGMAN_FALLBACK_TITLES`, keeping every Gold Game dependency-free and instant, at the cost of not accepting every valid English word (acceptable for a bonus feature, unlike the core catalogue).
- **"My stuff" grids reuse the Available Books tab's exact `rec-card` markup** — My Borrowed Books, My Reservations, and My Wishlist render as `.books-grid`/`.rec-card` divs (not the original one-off `.wishlist-card`/`.profile-table` styles) so a book looks identical whether it's being browsed or already yours; the per-row action (Return/Cancel/Remove) sits in a `stopPropagation`'d `.admin-card-actions` row reused from the admin book-card pattern, since a `rec-card` can't itself be a `<button>` once it needs a nested interactive action.
- **Toast action links reuse the existing toast infrastructure** — `useToast`'s `toast(msg, type, action)` takes an optional `{ label, onClick }` instead of introducing a separate "toast with CTA" component; every existing two-argument call site is unaffected, and Borrow/Reserve/Add-to-wishlist toasts just pass a third argument that closes the book modal and jumps to My Profile.
- **No emoji anywhere in the UI, by convention** — pictographic emoji (🔒🎉✨ etc.) were removed app-wide in favour of the existing inline stroke-SVG icon convention (`ReactionIcon`, `FilterIcon`, `LockIcon`, the Games icons, etc.) or plain text where no icon is needed. Established text/dingbat symbols already used as icons throughout (★/☆ ratings, ✕ close, ✓/✗, ♥/♡ wishlist) are a separate, pre-existing convention and were left as-is.
- **Hero-context error colour is computed, not a fixed red** — the borrow/reserve error banner inside the Book Detail modal's cover-tinted hero can't safely use the app's normal fixed `#c00` error red, since an arbitrary cover colour might not contrast with it. `heroErrorColor` tries a small ordered list of red shades (`HERO_ERROR_REDS`) and picks the first that clears 4.5:1 against the cover colour, falling back to the same guaranteed-safe black/white `coverPalette.text` already used for hero labels — no fixed hue can pass WCAG against literally any background, so the fallback is what keeps the "always" guarantee.
- **Landing page CTA banner inverts `--text`/`--bg` instead of a hardcoded dark colour** — since both are theme CSS variables, the "inverted" band automatically renders correctly (light-on-dark or dark-on-light) across all 10 theme combinations with zero per-theme overrides.
- **Navigation style is a third `ThemeContext` axis, not a separate context** — `navStyle` persists in `localStorage` and applies globally exactly like `appearance`/`readerTheme`, so Dock vs NavTabs "just works" on both dashboards without a second provider or prop-drilling a preference that's conceptually the same kind of thing (a persisted UI choice).
- **Book Request System reuses the Donation/Membership Request `pending → approved/rejected` shape** — same problem (member submits something that needs admin sign-off before it takes effect), so the same lifecycle, admin-tab-with-status-filter, and approve/reject-modal pattern was reused rather than inventing a new one.
- **Book request outcomes are tracked server-side (`notified` column), not in `localStorage`** — unlike onboarding's `seen`/`not seen` flag, an unacknowledged approval/rejection needs to survive a login from a different browser or device, so it's a real column the dismiss endpoint flips, not a client-only flag.
- **Home tab's vivid section colours reuse the existing WCAG helpers, not a new colour system** — `HOME_PALETTE` runs a small fixed set of hex colours through the same `wcagTextColor()` + `minAlphaForContrast()` functions already used to derive the Book Detail hero's `coverPalette` from a book's `cover_color`, so "pick black or white text, then alpha-tune secondary text tiers to guarantee 4.5:1" has one implementation shared by both a per-book dynamic colour and a fixed design palette.
- **AI generation bail-out uses a request-id ref, not `AbortController`** — Groq's Python SDK call happens server-side, so the frontend can't actually cancel the in-flight request; instead `aiGenRequestIdRef` is bumped on every new generate call, manual bail-out, or modal close, and any response is checked against the id it was issued under before touching state, so a slow response arriving after the admin has already moved on is silently discarded rather than overwriting their typed content.
- **Home tab sections overlap and collapse instead of stacking with whitespace** — `.home-tab` has `gap: 0` and each colour block has `margin-top: -40px`, so sections visually pile against each other (later DOM siblings paint over earlier ones automatically, no z-index needed); combined with the accordion (`openHomeSection`, one section expanded at a time), collapsed sections shrink to just their header bar and stack tightly under whichever section is open, rather than the page showing four always-expanded grids at once.
