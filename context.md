# Library Management System — Project Context

## Overview
A full-stack library management app. Admins manage the book catalogue, monitor borrows, configure fines, track inventory changes, and review incoming book donations. Members browse books, borrow/return them, reserve books when all copies are out, view their fines, leave optional ratings and reviews when returning a book, and donate books to the library in exchange for credit. The Books tab surfaces personalised recommendations and trending content to help members discover what to read next.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 · Flask 3 · SQLAlchemy · SQLite |
| Frontend | React 18 (Create React App) · Axios · lucide-react (icons, dock nav only — see SidebarNav.js) |
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
                      #        description, author_bio, cover_url, cover_color,
                      #        gutenberg_id, gutenberg_text)
                      #   description/author_bio: NULL = never scraped, '' = tried/no data, text = data
                      #   cover_color: VARCHAR(7) nullable — dominant mid-tone hex colour of cover image
                      #     (e.g. '#a83c2e'); NULL = not yet extracted; set during scrape via Pillow
                      #   gutenberg_id: NULL = never checked against Project Gutenberg, 0 = checked/
                      #     no public-domain match, positive int = Gutenberg book id (free full text
                      #     available); gutenberg_text: cached plain-text body once fetched (nullable)
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
    wishlist.py       # Wishlist (user_id FK, book_id FK, added_at) — unique on (user_id, book_id);
                      #   to_dict() denormalizes book_title/author/cover/cover_color/available
                      #   so the My Library tab never needs a second lookup against `books` state
    community.py      # 6 models for the Gold-member community feature:
                      #   Community (id, name, description, creator_id FK, status: pending|approved|rejected,
                      #     admin_notes, created_at, banner_image, icon_image)
                      #     banner_image/icon_image: base64 data URLs, nullable — None = not set
                      #   CommunityMembership (community_id, user_id, role: member|moderator, joined_at)
                      #   CommunityPost (community_id, author_id, title, content, images, created_at)
                      #     images: db.JSON column, list of up to 3 base64 data URLs; None/[] = no images
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
                      #   + GET gutenberg (lazy Project Gutenberg match) + GET read (full text)
                      #   book list includes reservation_count, avg_rating, rating_count,
                      #   description, author_bio, cover_url, cover_color, gutenberg_id per book
                      #   _scrape_book_data() — Open Library scraper (description, bio, cover)
                      #   _extract_dominant_color(cover_url) — downloads cover image, resizes to
                      #     64×64 via Pillow, bins mid-tone pixels (skips near-white/near-black),
                      #     returns most-frequent bin as '#rrggbb'; called after every scrape
                      #   _scrape_and_store() — background thread helper (called on add_book)
                      #   _gutendex_lookup(title, author) — searches gutendex.com by title only
                      #     (combined title+author queries perform poorly); trusts an exact
                      #     normalized-title match on its own, otherwise requires the author's
                      #     surname (accent-stripped) to appear in the result's author list —
                      #     prevents a still-copyrighted book with a similar title (e.g. "1984",
                      #     "Dune") from being mistaken for a public-domain match
                      #   _fetch_gutenberg_text() / _strip_gutenberg_boilerplate() — downloads the
                      #     plain-text format and trims the standard PG license header/footer
    borrows.py        # /api/borrow/, /api/return/, /api/my-borrows, /api/my-fines
                      #   borrow enforces per-tier active-borrow limit (Silver 1, Gold 3, Family 1)
                      #   return accepts optional JSON body with rating/review
    reservations.py   # /api/reserve/, /api/cancel-reservation/, /api/my-reservations
    wishlist.py       # /api/my-wishlist GET — caller's wishlist, newest first
                      # /api/wishlist/:bookId POST — add (409 if already in list)
                      # /api/wishlist/:bookId DELETE — remove (404 if not in list)
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
                      #   body may include banner_image/icon_image (base64 data URLs, validated by
                      #   _validate_image() — same data:image/ prefix + ~2MB rules as the avatar route)
                      # PUT  /api/communities/:id          — moderator-only; updates description/
                      #   banner_image/icon_image (name is immutable via this endpoint)
                      # GET  /api/my-communities           — communities the caller has joined
                      # POST /api/communities/:id/join     — join an approved community
                      # DEL  /api/communities/:id/leave    — leave a community
                      # GET  /api/communities/:id/posts    — list posts (members only); each post
                      #   includes its top-level comments inline (_post_with_comments() helper,
                      #   shared with the single-post endpoint) since the member UI renders every
                      #   post as a full feed item, not a summary-then-detail flow
                      # POST /api/communities/:id/posts    — create post; body may include
                      #   images: [] (up to 3 base64 data URLs, each validated via _validate_image())
                      # GET  /api/communities/:id/posts/:pid — single post with threaded comments
                      #   (used to refresh one feed item after a comment/reply/reaction, not for
                      #   navigation — there is no separate post detail page)
                      # POST /api/communities/:id/posts/:pid/comments — add comment or reply
                      #   (parent_id in body = reply to that comment, any depth)
                      # POST /api/communities/:id/posts/:pid/react — toggle post reaction
                      # POST /api/communities/:id/posts/:pid/comments/:cid/react — toggle comment reaction
                      # GET  /api/communities/activity-count?since= — count new activity
                      #   (posts + comments + reactions by others) for badge polling
                      # GET  /api/admin/communities        — all communities for admin review
                      # PUT  /api/admin/communities/:id/approve — approve + auto-join creator as moderator
                      # PUT  /api/admin/communities/:id/reject  — reject with optional reason
                      # DEL  /api/admin/communities/:id    — permanently delete a community (cascades
                      #   to its memberships/posts/comments/reactions via SQLAlchemy relationships)
    __init__.py       # register_blueprints()
```

### DB migrations
`app.py` runs `_migrate_db()` on every startup. It uses a reusable `add_missing_cols(table, additions)` helper that calls `ALTER TABLE` for any column in models not yet present in the SQLite file. New tables (e.g. `community`, `community_membership`) are created automatically by `db.create_all()`. `_seed_memberships()` runs on every startup and silently no-ops when all members already have a tier.

Tables currently patched by `_migrate_db()`: `book` (genre, description, author_bio, cover_url, cover_color, gutenberg_id, gutenberg_text), `user` (avatar), `post_reaction` (created_at), `comment_reaction` (created_at), `community` (banner_image, icon_image), `community_post` (images).

### Fine calculation
`Borrow.calculate_fine()` reads `fine_per_day` live from the `setting` table. `borrow_days` (loan duration) is also read from `setting` at borrow time. Both are configurable by the admin at runtime.

---

## Frontend Structure

```
frontend/src/
  api.js                    # Axios instance — baseURL: /api, withCredentials: true
  constants.js              # GENRES list (shared across add/edit forms and filters)
  styles/
    fonts.css               # @import for Instrument Serif (display) + Inter (body) from Google Fonts;
                            #   exposes --font-display / --font-body custom properties; used only by
                            #   the public LandingPage, not the authenticated app (which keeps the
                            #   system font stack defined in App.css)
    theme.css               # fade-rise / fade-rise-delay / fade-rise-delay-2 entrance-animation
                            #   classes (opacity 0→1, translateY 20px→0) used by the landing page hero
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
  hooks/
    useToast.js             # Toast notification hook — returns { toasts, toast(msg, type?, action?) }
                            #   toast(msg) defaults type to 'success'; pass 'error' for red variant
                            #   optional action = { label, onClick } renders a clickable link inside
                            #     the toast (e.g. borrow toast's "View in My Library")
                            #   each toast auto-expires after 2.8 s; IDs are monotonic so stacked
                            #   toasts each dismiss independently
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
                            #   Optional per-toast action renders a .toast-action underlined button
                            #     (.toast-stack has pointer-events:none; .toast itself re-enables
                            #     pointer-events:auto so the action button stays clickable)
    ProfileMenu.js          # Avatar button + dropdown (appearance, reader themes, sign out);
                            #   Props: username, avatar, tier, onLogout, wrapperClassName
                            #   Rendered fixed top-right on both dashboards (Admin's TopBar renders
                            #   it internally; MemberDashboard renders it directly, positioned via
                            #   the .topbar-standalone-profile wrapperClassName) so the dropdown
                            #   logic (icons, theme wiring, outside-click close) isn't duplicated
    SidebarNav.js           # Primary member nav — a macOS-style floating "dock": a horizontal
                            #   pill fixed to the bottom-center of the viewport, icons only
                            #   (lucide-react: Home/BookOpen/Library/Users/UserCircle keyed by tab
                            #   id), hover-lift + scale animation per item, active tab shown via a
                            #   small dot beneath its icon (no persistent label — label appears in
                            #   a tooltip bubble above the icon on hover/focus)
                            #   Props: tabs, active, onChange, badges — same shape NavTabs takes;
                            #   badges renders a small red count pill on the icon's corner
                            #   Auto-hide: a window `mousemove` listener toggles a `visible` state
                            #   on/off based on distance from the bottom edge (REVEAL_ZONE = 110px);
                            #   .dock-nav slides down (translateY) and fades out when not visible.
                            #   Starts visible on mount so first-time users see the nav immediately.
                            #   .dock-nav:focus-within forces it visible for keyboard tabbing, and
                            #   an `(hover: none)` media query forces it always-visible on touch
                            #   devices, since cursor-proximity has no touch equivalent
                            #   This is the one place in the app that uses an icon library — every
                            #   other icon (ReactionIcon, BookStrip's chevrons, etc.) is a hand-
                            #   rolled inline SVG; lucide-react was added specifically for this dock
  pages/
    LandingPage.js           # Public marketing landing page, served at "/" for logged-out visitors
                            #   (logged-in visitors hitting "/" are redirected to /dashboard, which
                            #     the "/*" wildcard resolves into the right dashboard by role)
                            #   Fullscreen hero with a looping fade-in/fade-out background video —
                            #     custom useEffect + useRef + requestAnimationFrame loop (fades 0.5s
                            #     in/out around the video's currentTime/duration, then on `ended`
                            #     drops opacity to 0, waits 100ms, resets currentTime, plays again);
                            #     NOT the native `loop` attribute, so the loop point is invisible
                            #   Video layer is `position: fixed` (not absolute) so it stays pinned to
                            #     the viewport while the hero/catalogue/about sections scroll over it —
                            #     the "3D" parallax effect; a white→transparent→white gradient overlay
                            #     keeps hero text legible against it
                            #   Nav: logo "The Athenaeum", Home / About / Community / Catalogue /
                            #     Reach Us anchor links, in the same order as the sections appear on
                            #     the page (only Home/About/Community/Catalogue have matching sections);
                            #     no nav CTA button (removed per design pass)
                            #   Hero: headline + description + "Start Reading" CTA → navigate('/login')
                            #   Section order (top to bottom): Hero → About → Community → Catalogue
                            #   About section (#about) — a one-at-a-time "roller" carousel of the 6
                            #     member-facing services (Borrow/Reserve/AI Search/Personalised Picks/
                            #     Communities/Donate), reusing the existing /service_*.jpg images from
                            #     public/ with landing-page-flavoured copy; the active card is flanked
                            #     by full-size "peek" cards (same width/height, `flex: none` so they
                            #     can't be squeezed, dimmed + scaled to 0.92, deliberately left to
                            #     overflow off-screen rather than being cropped/masked) — clicking a
                            #     peek advances/reverses, dot indicators below allow jumping directly;
                            #     only the inner content re-keys on change (not the card shell), so the
                            #     frame/blur/shadow never flicker — just the image+title slide in from
                            #     whichever side triggered the change; all 6 images are preloaded on
                            #     mount so switching never shows a blank flash
                            #   Community section (#community) — a TOONHUB-style character carousel
                            #     over a grain-textured overlay (SVG fractalNoise data URI, opacity 0.2)
                            #     layered above the shared fixed video; no background of its own — the
                            #     video shows straight through, same mechanism as the catalogue section
                            #     "COMMUNITY" section label (top-left) replaces the original spec's
                            #     "TOONHUB" label; the giant Instrument Serif ghost text ("THE CIRCLE")
                            #     is implemented but currently commented out in JSX
                            #     4 character images (COMMUNITY_IMAGES) from public/characters/1-4.png,
                            #     preloaded via `new Image()` on mount; each rendered with a computed
                            #     role — center/left/right/back — derived from `communityIndex` via
                            #     communityRoleOf(i); center gets no blur + a large scale, left/right
                            #     get a small blur + mid scale, back gets the heaviest blur; positions
                            #     and role sizing differ between desktop and the ≤640px media query
                            #     (not a JS isMobile flag — pure CSS, unlike the original spec, since
                            #     every other responsive rule on this page is media-query driven)
                            #     navigateCommunity('next'|'prev') bumps communityIndex mod 4 and locks
                            #     via `communityAnimating` for 650ms (matches the 650ms cubic-bezier
                            #     transition on transform/filter/opacity/left in the CSS)
                            #     `.landing-community-item-center`'s height/scale product must stay
                            #     ≤ 100 (of the section's 100vh) or the character gets clipped top and/
                            #     or bottom by the section's `overflow: hidden` — current desktop values
                            #     (height 50%, scale 1.68 ⇒ ~84%) were chosen to satisfy that, replacing
                            #     the original spec's height 92%/scale 1.68 (~155%, guaranteed clipping)
                            #     each COMMUNITY_IMAGES entry may carry an optional `scale` field applied
                            #     as an extra `transform: scale()` (transform-origin: bottom center) on
                            #     just that `<img>`, independent of and multiplied with the role's own
                            #     scale — added because `object-fit: contain` against the carousel's
                            #     fixed 0.6:1 box ratio renders each PNG at a different effective height
                            #     depending on its own aspect ratio (a square image like 1.png renders at
                            #     only ~51% of box height, a tall image at up to ~100%), so images with
                            #     very different intrinsic proportions need a per-image correction to
                            #     look the same size; public/characters/2.png was separately fixed by
                            #     cropping its transparent padding down to the content bounding box
                            #     (source-file fix) rather than a scale correction, since the mismatch
                            #     there was from padding, not aspect ratio
                            #     Arrow icons are hand-rolled inline SVGs (ArrowLeftIcon/ArrowRightIcon),
                            #     not lucide-react, matching the rest of the app's icons (ReactionIcon,
                            #     BookStrip's chevrons, …) — SidebarNav's dock is the sole exception,
                            #     see components/SidebarNav.js above
                            #     Bottom-left: "Find Your Circle" heading + description (hidden ≤640px)
                            #     + two circular arrow buttons driving navigateCommunity
                            #     Bottom-right: "Join a Community" link — like every other CTA on this
                            #     page, it navigates to /login rather than an in-page destination, since
                            #     actually joining a community is a gated (Gold-tier) authenticated
                            #     feature
                            #   Catalogue section (#catalogue) — glimpse of the real catalogue via the
                            #     public GET /api/books/preview endpoint (no auth, ≤10 books); shows 10
                            #     shimmering skeleton cards while the request is in flight, then swaps
                            #     to real cards that fade/rise into view via IntersectionObserver as the
                            #     user scrolls; the whole section renders nothing if the fetch fails or
                            #     returns zero books (no empty shell)
    LandingPage.css          # All landing-page styles — plain CSS custom to this page (see Key
                            #   Design Decisions re: no Tailwind), not App.css
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
                            # Home tab (not the default on login — see Available Books tab below):
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
                            # Available Books tab (top → bottom) — the default tab on login
                            # (`useState("books")`; Home is reachable via the dock but isn't shown first):
                            #   1. Search trigger row — magnifying-glass icon button + book count
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
                            #      Both modes show "No results found for this search. Try again"
                            #        (with inline Clear button) when results are empty
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
                            #     Below hero zone (default modal background):
                            #       Description + author bio (lazy-enriched)
                            #       Reviews list
                            #     ✕ close button in modal header (no bottom Close button)
                            #
                            # My Library tab (top → bottom): My Borrowed Books, My Reservations,
                            #   My Wishlist — each section is a card grid or horizontal strip
                            #   (libraryView state: 'grid' default | 'strip', toggled via an icon
                            #   button top-right of the tab, persisted in localStorage as
                            #   'libraryCardView')
                            #   Cards reuse the exact same .rec-card markup/classes as the
                            #   Available Books tab (cover bleed, title/author/meta/avail rows) —
                            #   'grid' view renders .rec-card-large inside .library-grid (the same
                            #   grid the Available Books large-card view uses); 'strip' view renders
                            #   compact .rec-card inside a BookStrip/.rec-strip — so cards in this
                            #   tab are pixel-identical to the Available Books tab at each size.
                            #   A .rec-card-actions row (View + a second contextual button) is
                            #   appended below the card text, since these cards need actions the
                            #   Available Books cards don't (the cover is its own clickable button
                            #   here rather than the whole card, so nested buttons stay valid HTML)
                            #   My Borrowed Books — Badge (Overdue/Active) + due date; View opens
                            #     the Borrowed Book Card, Return opens the Return+Review modal
                            #   My Reservations — Badge (Ready to borrow / Queue #N); View opens
                            #     the Book Detail modal, Cancel deletes the reservation
                            #   My Wishlist — "Available" badge when in stock; View opens the Book
                            #     Detail modal, Remove calls DELETE /api/wishlist/:bookId; items are
                            #     added via a ♡/♥ toggle button in the Book Detail modal's action
                            #     row (POST/DELETE /api/wishlist/:bookId), independent of borrow state
                            #
                            # My Profile tab:
                            #   Avatar editor — 80px avatar circle; click to upload image file;
                            #     resized client-side via canvas (max 400×400, JPEG 0.88) before
                            #     PUT /api/auth/avatar; camera icon overlay on hover
                            #   Membership info card — tier badge, borrow limit, monthly rate,
                            #     family group members (family tier only)
                            #   My Fines — .profile-table, center-aligned columns; fine amount and
                            #     paid/unpaid status (active borrows and reservations live on the
                            #     My Library tab instead, as card grids — see above)
                            #   Donate a Book section — Donate button opens modal; table of past
                            #     donations with status, estimated value, and credit earned;
                            #     total credits earned card (approved donations only)
                            #
                            # Borrowed Book Card (opened from a My Borrowed Books card in the My
                            #   Library tab):
                            #   Same hero-modal styling as the catalogue Book Detail modal — cover,
                            #     cover-colour-tinted hero via computeCoverPalette() (factored out of
                            #     the original inline useMemo so both modals share the same palette
                            #     derivation and WCAG-safe text/label colours)
                            #   Hero rows: Author, Genre, Borrowed on, Due date, Status badge, and
                            #     (if overdue) Fine so far; description below the hero as in the
                            #     catalogue modal
                            #   Action row: Return (closes the card, opens the Return+Review modal)
                            #     and — only once GET /books/:id/gutenberg resolves gutenberg_id > 0 —
                            #     a "Read Online" button; a muted note explains when a book was
                            #     checked and found unavailable (gutenberg_id === 0)
                            #   Gutenberg availability is resolved lazily the first time a card opens
                            #     for a book whose gutenberg_id is still null (mirrors the description/
                            #     cover_url lazy-scrape pattern) and is cached onto the `books` state
                            #     entry so re-opening the same book's card never re-checks
                            #
                            # Online reader (Read Online button): full-screen overlay
                            #   (.reader-overlay/.reader-panel, z-index above the standard modal)
                            #   fetching GET /books/:id/read on open; shows the cached/cleaned
                            #   Gutenberg plain text in a serif, pre-wrapped .reader-text pane;
                            #   3 inline "A" buttons switch font size (sm/md/lg); relies entirely on
                            #   existing --bg/--text CSS custom properties so it follows whatever
                            #   appearance + reader theme is currently active, with no extra wiring
                            # Return modal: optional 5-star picker, review text, anonymous toggle
                            # Donate modal: title, author, ISBN (optional), genre (optional),
                            #   condition — all dropdowns use the custom Select component
                            #   estimated value field with live credit preview (value/4);
                            #   success screen after submit
                            # Toast notifications (useToast hook + Toast component) fire on:
                            #   borrow, return (with/without review), reserve, cancel reservation,
                            #   avatar upload, donation submit, add to wishlist (not on remove),
                            #   join/leave community, create community, create post
                            #   the borrow toast carries an action = { label: "View in My
                            #     Library", onClick } that closes the book detail modal and
                            #     switches to the My Library tab
                            #
                            # Community tab (Gold members only; non-gold sees a locked card):
                            #   2-level view: list → community (no separate post-detail level —
                            #     see "Post feed" below)
                            #   List view (communityView='list'): community cards in a responsive
                            #     .community-grid (renderCommunityCard, shared by both the "Your
                            #     pending requests" section and the main approved-communities grid)
                            #     Each card: banner image (or gradient fallback) on top, the
                            #     UserAvatar icon absolutely positioned inside the banner's bottom-
                            #     left corner (in front of, not below, the banner — .community-card
                            #     keeps overflow:hidden so the icon can never get clipped or become
                            #     non-circular), name, description, member/post counts, Moderator
                            #     tag, Join/Leave button. Cards for communities the caller has
                            #     joined are themselves the click target (.community-card-clickable,
                            #     onClick=openCommunity) — there's no separate "View" button; the
                            #     Leave/Join buttons stopPropagation so they don't also navigate.
                            #     Pending/rejected request cards and not-yet-joined approved cards
                            #     are not clickable (nothing to view without joining first)
                            #   Create Community button → modal (name, CommunityImageFields for
                            #     banner_image/icon_image, description); submitted as pending until
                            #     admin approves
                            #   Community view (communityView='community'): banner hero image (if
                            #     set) above a .community-nav row — Back button, icon avatar,
                            #     name/member-count/Moderator tag, and (moderator only) an Edit
                            #     button opening the Edit Community modal (same CommunityImageFields
                            #     + description, PUT /api/communities/:id), plus + New Post
                            #   Post feed: every post in communityPosts renders fully expanded
                            #     inline (title, content, up to 3 images in a .post-detail-images
                            #     grid, reaction bar, comment form, threaded comments) — clicking a
                            #     post to open a detail page was removed; the backend now returns
                            #     each post's comments inline with the list so this needs no
                            #     per-post fetch on load. Reaction/comment state (commentDrafts,
                            #     commentErrors) is keyed by post id since multiple posts' comment
                            #     boxes are visible at once instead of one at a time; after a
                            #     comment/reply/reaction, only that one post is refetched
                            #     (GET .../posts/:pid) and patched into the communityPosts array
                            #   Create Post modal: title, content, PostImagesField (up to 3 images,
                            #     thumbnail grid with per-image remove + a disabled-at-3 add button)
                            #   Threaded comments: unlimited depth (visual indent capped at depth
                            #     4), reply-to-reply at any level
                            #   Notification badge: red number on the Community tab title showing
                            #     new posts + comments + reactions since last visit; polled every 60 s;
                            #     count stored in localStorage (communityLastSeen); badge clears on tab open
                            #   Reaction icons: stroke-based inline SVGs (no icon library),
                            #     keys: like | love | haha | wow | sad | angry
    AdminDashboard.js       # Books · Borrowed · Fines · Members · Communities · Donations tabs
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
                            #     (POST /books/:id/generate-field, PUT .../patch-metadata);
                            #     missing cover shows "+ Add cover" opening the Cover Upload
                            #     modal (file or URL, PUT .../patch-metadata) — both modals
                            #     previously only reachable via the Refresh Log's "Fill missing"
                            #     section, now also directly accessible from the detail view
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
                            #   approve/reject community; policy/pricing no longer use inline
                            #   "Saved" state — toasts replace those entirely
                            #
                            # Communities tab:
                            #   Status filter buttons — Pending / Approved / Rejected / All
                            #   Table: icon avatar + community name, description, creator, member
                            #     count, post count, status badge, created date, action buttons —
                            #     Approve/Reject (pending only) + Delete (always, any status);
                            #     Delete is gated behind a window.confirm (higher blast radius than
                            #     most admin deletes — wipes every member's posts/comments too) and
                            #     calls DELETE /api/admin/communities/:id
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
`AuthContext` calls `GET /api/auth/me` on mount. A 401 sets `user = null`. Login/register calls set `user` via `login(userData)`. All protected pages use `useAuth()` — no prop drilling.

**Routing** (`App.js`): `"/"` shows the public `LandingPage` to logged-out visitors (logged-in visitors are redirected to `/dashboard`); `"/login"` shows `Login` to logged-out visitors (logged-in visitors redirected to `/dashboard`); the `"/*"` wildcard renders `AdminDashboard`/`MemberDashboard` by role when logged in, and redirects to `"/"` (not straight to `/login`) when logged out — so the landing page, not the login form, is the actual entry point for anonymous traffic.

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
| GET | `/api/books/preview` | — (public) | Up to 10 books (id, title, author, genre, cover_url, cover_color only — no copies/ISBN/description) for the public landing page's catalogue glimpse; no session required |
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
| GET | `/api/books/:id/gutenberg` | member+ | Lazily resolves (and caches) whether the book has a free full text on Project Gutenberg; returns `{ available, gutenberg_id }` |
| GET | `/api/books/:id/read` | member (must have borrowed the book) | Returns the full Gutenberg plain text for online reading — `{ text, title, author }`; 403 if never borrowed, 404 if not on Gutenberg |

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
| GET | `/api/my-wishlist` | member | Caller's wishlist, newest first; each entry denormalizes book title/author/cover/availability |
| POST | `/api/wishlist/:bookId` | member | Add a book to the wishlist (409 if already present) |
| DELETE | `/api/wishlist/:bookId` | member | Remove a book from the wishlist (404 if not present) |

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
| POST | `/api/communities` | gold | Create a community (status = pending until admin approves); optional `banner_image`/`icon_image` (base64 data URLs) |
| PUT | `/api/communities/:id` | gold+moderator | Update `description`/`banner_image`/`icon_image` for a community the caller moderates |
| GET | `/api/my-communities` | gold | Communities the caller has joined |
| POST | `/api/communities/:id/join` | gold | Join an approved community |
| DELETE | `/api/communities/:id/leave` | gold | Leave a community |
| GET | `/api/communities/:id/posts` | gold+member | List posts (caller must be a member); each post includes its top-level comments inline |
| POST | `/api/communities/:id/posts` | gold+member | Create a post; optional `images: []` (up to 3 base64 data URLs) |
| GET | `/api/communities/:id/posts/:pid` | gold+member | Single post with nested comment tree (used to refresh one feed item, not for navigation) |
| POST | `/api/communities/:id/posts/:pid/comments` | gold+member | Add top-level comment or reply (`parent_id` in body for replies at any depth) |
| POST | `/api/communities/:id/posts/:pid/react` | gold+member | Toggle post reaction (`emoji`: like\|love\|haha\|wow\|sad\|angry) |
| POST | `/api/communities/:id/posts/:pid/comments/:cid/react` | gold+member | Toggle comment reaction |
| GET | `/api/communities/activity-count?since=` | gold | Count new posts+comments+reactions since ISO timestamp (for badge polling) |
| GET | `/api/admin/communities` | admin | All communities for admin review |
| PUT | `/api/admin/communities/:id/approve` | admin | Approve community; auto-joins creator as moderator |
| PUT | `/api/admin/communities/:id/reject` | admin | Reject with optional reason |
| DELETE | `/api/admin/communities/:id` | admin | Permanently delete a community and all its posts/comments/memberships |

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

**Branding:** Communities may optionally have a `banner_image` and `icon_image` (base64 data URLs, same size/format validation as the user avatar route — `data:image/` prefix, ~2 MB cap). Set at creation via `CommunityImageFields` in the Create Community modal; a moderator can change either (or the description) afterward via `PUT /api/communities/:id` and the Edit Community modal. Neither is required — cards and the community header fall back to a gradient banner and initial-letter icon (`UserAvatar`) when unset.

**Post images:** Posts may optionally carry up to 3 images (`CommunityPost.images`, a `db.JSON` list of base64 data URLs), validated the same way as community banners/icons. Enforced server-side in `create_post` (400 if more than 3, or if any entry fails validation).

**Post feed, not detail pages:** Opening a community shows every post fully expanded in a single scrolling feed (`communityView` only has `'list'`/`'community'` — there is no third "post detail" level). `GET /communities/:id/posts` returns each post's top-level comments inline via a shared `_post_with_comments()` helper (also used by the single-post endpoint), so the whole feed renders from one request with no per-post fetch on load. After a comment, reply, or reaction, only that one post is refetched and patched into the `communityPosts` array in place.

**Admin deletion:** `DELETE /api/admin/communities/:id` permanently removes a community. Cascades to its memberships, posts, comments, and reactions via SQLAlchemy `cascade='all, delete-orphan'` relationships on `Community.memberships`/`Community.posts` (and further down the chain on `CommunityPost.comments`/`.reactions`, `CommunityComment.reactions`) — no manual cleanup needed. Available for a community in any status, not just pending, since an admin may want to remove an already-approved community.

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
- **SVG reaction icons inline, no icon library** — avoids adding a dependency; the `ReactionIcon` component renders stroke-based 24×24 viewBox SVGs sized via a `size` prop (default 13). Icons are feather-style paths for visual consistency. (This convention holds everywhere except the member dock nav — see the `lucide-react` decision below.)
- **Notification badge via polling, not WebSockets** — 60-second polling via `setInterval` is simple and stateless. The activity-count endpoint is a single aggregating query; polling only runs when the Community tab is not active (to avoid counting events the user is already seeing).
- **Admin tab merging (Fines + Members)** — Pending Fines and Fine Policy share a tab; All Members, Membership Pricing, and Member Tiers share a tab. Reduces nav clutter without hiding functionality.
- **Comment depth capped visually at 4, not structurally** — nesting in data is unlimited; only the CSS indentation class switches at depth 4. This prevents the UI from becoming too narrow on deep threads while preserving full reply history.
- **AI search is a frontend toggle, not a separate page** — the AI button lives inside the existing collapsible search panel so the feature is discoverable but not intrusive. Activating it clears normal filters (and vice-versa) so the two modes never conflict. Results use the same `books-grid` / `rec-card` layout as keyword results for visual consistency.
- **AI search submit is Enter-only, no button** — removing the Search button keeps the input row uncluttered; the placeholder hints `(press Enter)`. A 3-second `AbortController` timeout guards against slow Groq responses — if the request is aborted, the empty-results state renders instead of a hanging spinner.
- **Groq over OpenAI for AI search** — Groq's inference is significantly faster (sub-second for this catalogue size), which matters for a search-as-you-submit UX. `llama-3.1-8b-instant` is sufficient for semantic book matching; the prompt is constrained to return only IDs from the provided catalogue so hallucinated books are structurally impossible.
- **API key in `Config`, not hardcoded** — `GROQ_API_KEY` is read from the environment (`os.environ.get`) with the key as the fallback default, making it easy to rotate without a code change.
- **Custom Select replaces all native dropdowns** — `Select.js` parses `<option>` children via `React.Children.toArray` and fires a synthetic `{ target: { value } }` event so all existing onChange handlers work without modification. Two size variants: default (form-group, full-width) and `.filter-select` (compact inline). Fully theme-aware via CSS custom properties.
- **Toast system via `useToast` hook** — a module-level counter generates monotonic IDs so concurrent toasts each auto-dismiss independently after 2.8 s. Success toasts use `--text`/`--bg` (inverted, theme-safe); error toasts are hardcoded red. Both dashboards share the same hook; the `Toast` component is rendered once at the root of each page.
- **Toast actions are optional, not a new component** — `toast(msg, type, { label, onClick })` keeps every existing call site (which only ever passed `msg`/`type`) working unchanged. `.toast-stack` stays `pointer-events: none` so it never blocks clicks over the page; only the individual `.toast` re-enables pointer events, so the action link is clickable without the invisible stack container intercepting clicks elsewhere.
- **Genre pill deselect** — clicking an active genre pill toggles it off (sets `selectedGenre` to `""`) rather than requiring the user to click the "All" pill. Same behaviour as many filter UIs users already know.
- **Shared `--radius` scale over per-component values** — `App.css` defines `--radius` (10px) plus derived `--radius-sm/md/lg/xl` (6/8/10/16px) in `:root` and every bordered surface (buttons, inputs, cards, modals, badges, dropdowns) references one of these instead of a hardcoded pixel value. Keeps corner rounding visually consistent across all 10 theme combinations and makes a future global radius change a one-line edit.
- **Gutenberg matching is title-first, author-confirmed** — searching Gutendex with a combined "title author" query performs badly (diacritics like "Brontë" vs "Bronte", or "Dostoevsky" vs "Dostoyevsky" in the query itself return zero results), so the search call uses the title alone. A normalized exact-title match is trusted on its own; anything weaker (partial/substring title match) additionally requires the book's author surname (accent-stripped) to appear in the candidate's author list. This reliably found free texts for classics already in the catalogue (Pride and Prejudice, Dracula, Anna Karenina, Jane Eyre, Wuthering Heights, Crime and Punishment, The Great Gatsby) while correctly rejecting still-copyrighted titles (1984, Dune, The Hobbit) with no false positives observed.
- **Gutenberg availability and text are cached on the `Book` row, not re-fetched per request** — `gutenberg_id` (None/0/id) and `gutenberg_text` follow the same nullable-sentinel lazy-fetch pattern already used for `description`/`author_bio`/`cover_url`, so Gutendex/gutenberg.org are only ever called once per book, on demand, the first time a member opens that book's Borrowed Book Card.
- **Reading access is gated on having ever borrowed the book** — `GET /books/:id/read` checks for any `Borrow` row for `(user_id, book_id)`, not just an active one, so a member retains online-reading access to a public-domain book after returning it.
- **Reader pane reuses the app's existing theme CSS variables** — the full-screen reader overlay (`.reader-overlay`/`.reader-panel`/`.reader-text`) is styled entirely with `var(--bg)`/`var(--text)` etc. rather than its own theme, so it automatically renders in whichever of the 10 appearance/reader-theme combinations (sepia, forest, ocean, rose, light/dark) the member currently has active, with zero extra wiring.
- **`computeCoverPalette`/`heroStylesFor` factored out of the Book Detail modal** — the cover-colour-derived hero palette and its WCAG-safe label/subtle/faint/row style computation were originally an inline `useMemo` scoped to `selectedBook`; both were extracted to module-level functions so the new Borrowed Book Card modal (keyed on a different selected item, `selectedBorrowBook`) can produce an identical hero treatment without duplicating the contrast-ratio math.
- **Landing page uses plain CSS, not Tailwind** — the original design brief for the landing page was written against Vite + TypeScript + Tailwind, but this project is CRA + plain JS with hand-written CSS custom properties (`App.css`). Rather than introduce a second styling system for one page, `LandingPage.css` follows the existing project convention (BEM-ish class names, CSS custom properties for shared values like `--radius-lg`).
- **Landing page background video is `position: fixed`, not `absolute`** — pinning the video to the viewport (rather than letting it scroll with the page) is what makes the catalogue and about sections feel like they're scrolling over a persistent backdrop instead of the video just being one more element that scrolls out of view; it's the entire mechanism behind the requested "3D"/parallax impression.
- **`/api/books/preview` is a separate, deliberately minimal public endpoint** — rather than relaxing `@login_required` on the real `/api/books`, the landing page gets its own unauthenticated route that returns only display-safe fields (id, title, author, genre, cover_url, cover_color) for a handful of books. This keeps copy counts, ISBNs, and descriptions out of anonymous responses while still letting the marketing page show real catalogue covers.
- **Landing "about" roller keeps the card shell mounted across transitions** — only the inner content div re-keys (and slides in from the direction of travel) on each change; the outer card (blur, border, shadow, size) never remounts, so the frame doesn't flicker. The flanking "peek" cards are full-size (`flex: none`, matching the active card's width/height) rather than cropped or masked, and are intentionally left to overflow off-screen — the containing `.landing-page` already clips horizontal overflow, so the peeks just read as the neighbouring card bleeding off the edge.
- **Landing "community" section shares the page's video/nav/gradient rather than duplicating them** — the original design brief for this section was written as if it were a standalone page with its own copy of the video background, nav bar, and gradient overlay (as four separate "pages"). Since `LandingPage` is actually one continuously scrolling page, those elements already exist once at the top; the Community section only adds what's genuinely new to it (grain overlay, section label, character carousel, bottom copy/link). This keeps there being exactly one video element and one nav on the page, avoiding duplicate `<video>` tags fighting over playback state.
- **Landing "community" carousel sizing is derived from `object-fit: contain` math, not eyeballed** — the four character images in `public/characters/` have different intrinsic aspect ratios, and each one renders at a different effective height inside the carousel's fixed `0.6:1` box under `object-fit: contain` (a square image is width-constrained and renders far shorter than a tall, narrow one). Rather than resizing every source image to a common canvas, mismatches are corrected per-image: `2.png` was cropped to its transparent-content bounding box (its problem was baked-in padding, not aspect ratio), while `4.png` gets a `scale` field applied as an extra `transform: scale()` on just that `<img>` (the mismatch there was purely aspect-ratio-driven letterboxing, which cropping can't fix — cropping only ever makes an image render *larger*, never smaller). The center role's own `height`/`scale` were also tuned so their product stays ≤ 100% of the section height, since anything above that is guaranteed to clip against the section's `overflow: hidden` regardless of vertical positioning.
- **Member primary nav is a macOS-dock-style floating bar, not a collapsible sidebar** — `SidebarNav.js` was rewritten from a hamburger-triggered slide-in panel (fixed left, `transform: translateX`, pushed content via a `.content-shifted` margin) to an always-fixed bottom-center pill. This removed a piece of explicit UI state the user had to manage (open/close) in favor of a nav that's just always in the same place; `lucide-react` was added as a dependency specifically because a dock of bare icons reads far better with a consistent icon set than five more hand-rolled SVGs would.
- **Dock auto-hide is cursor-proximity-driven, not hover-on-self** — a single `window` `mousemove` listener compares `e.clientY` against the viewport height (`REVEAL_ZONE = 110px`) rather than relying on `:hover` on the dock element itself. This is necessary because the reveal has to trigger *before* the cursor reaches the (currently off-screen, `pointer-events: none`) dock — a self-hover rule can only fire once the cursor is already over an invisible target, which never happens. `:focus-within` and an `(hover: none)` media query force it permanently visible for keyboard and touch users respectively, since neither has a meaningful "cursor near the bottom edge" signal.
- **My Library cards reuse the Available Books tab's `.rec-card` classes verbatim** — rather than maintaining a parallel `.library-card` style that has to be kept in sync by hand, the borrowed/reservation/wishlist cards in the My Library tab render the same `rec-card`/`rec-card-cover`/`rec-card-title`/etc. markup used by `renderBookCard`, so both tabs get pixel-identical typography, glass styling, and hover behaviour automatically, including future edits to either. The one structural difference is that the cover is its own nested `<button className="rec-card-cover-btn">` instead of the whole card being a button — these cards need a second action button (Return/Cancel/Remove) alongside "View", and a `<button>` can't nest inside another `<button>`.
- **Available Books, not Home, is the default tab on login** — `MemberDashboard`'s `tab` state initializes to `"books"` rather than `"home"`. Home is still the first item in `TABS`/the dock and fully reachable, it's just no longer what a member lands on first.
- **Community card icon overlaps the banner via `overflow: hidden` + a bounded inset, not a protruding negative offset** — the icon (`.community-card-icon-wrap`) is positioned inside the banner's box (`bottom: 10px`, not a negative value), so `.community-card`'s `overflow: hidden` can safely clip everything to the card's `border-radius` on all four corners. An earlier version let the icon protrude below the banner edge for a more dramatic overlap, which required removing `overflow: hidden` from the card — that broke corner-rounding (nothing was left to clip the banner image's square bottom corners against the card's rounded shape) and made the icon's protruding half vulnerable to being clipped by ancestor overflow. Keeping the icon fully inside the banner's bounds gets the "icon in front of banner" look with none of that fragility.
- **Community cards are the click target themselves, with a narrower "clickable" condition than "has a Leave/Join button"** — `clickable = !statusBadge && c.is_member`. Pending/rejected request cards and approved-but-not-yet-joined cards intentionally render with `cursor: default` and no `onClick`, because `openCommunity()` calls an endpoint (`_community_for_member`) that 403s for non-members and 404s for non-approved communities — there's genuinely nothing to navigate to yet. The Leave/Join buttons still `stopPropagation()` defensively even though only member cards are ever click-bound.
- **Posts render as a full feed, not a list-then-detail flow** — clicking into a post used to fetch and show just that one post; now every post in `communityPosts` is rendered fully expanded (content, images, reactions, comments) directly on the community page, and `GET .../posts` returns comments inline for every post up front via a shared `_post_with_comments()` helper. This trades a heavier initial payload for zero additional round-trips as the member scrolls — appropriate here since community posts are a bounded, moderation-approved list, not an unbounded public timeline. Per-post interaction state that used to belong to a single `selectedPost` (comment drafts/errors) is now keyed by post id (`{ [postId]: value }`) since multiple posts' comment boxes coexist on screen.
- **Community/post image fields share one `_validate_image()` helper server-side** — banner, icon, and post images are all base64 data URLs subject to the same two rules (must start with `data:image/`, ~2 MB size cap) already established by the user avatar route; centralizing the check in `routes/communities.py` instead of re-deriving it per field keeps the three call sites (`create_community`, `update_community`, `create_post`) from drifting out of sync.
