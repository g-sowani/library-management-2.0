# Library Management System — Project Context

## Overview
A full-stack, **multi-library** management app — a single deployment hosts any number of independent libraries, each with its own catalogue, genres, members/admins, fine policy, and membership pricing. Admins register by creating a brand-new library (getting back a shareable join code) or joining an existing one via that code; members join an existing library the same way. Everything below (books, genres, borrows, fines, donations, communities, etc.) is scoped to the caller's own library — see "Multi-Library System" for details.

Admins manage the book catalogue, monitor borrows, configure fines, track inventory changes, review incoming book donations and book-add requests, and approve member membership-tier requests. Members browse books, borrow/return them, reserve books when all copies are out, save books to a wishlist, view their fines, leave optional ratings and reviews when returning a book, donate books to the library in exchange for credit, request that a missing book be added to the catalogue (and get notified on the Home tab once an admin reviews it), and request a membership tier from My Profile (any time after signing up) that activates once an admin approves it. The Books tab surfaces personalised recommendations and trending content to help members discover what to read next. The Home tab is a bold, colour-blocked collapsible dashboard of the member's own borrows/reservations/wishlist/collection highlights. Members can also switch between a classic tab bar and a Mac-style floating dock for navigation. Gold members additionally get community spaces and a set of book-themed word games (Hangman, Word Scramble, Wordle) that build toward a cumulative XP score.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 · Flask 3 · SQLAlchemy · SQLite |
| Frontend | React 18 (Create React App) · Axios |
| Auth | Flask session cookies (signed, `withCredentials`); optional Google Sign-In (Google Identity Services + `google-auth` ID-token verification) |
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

**Seed accounts** (created automatically on first run, both in an auto-created "Default Library"):
- `admin / admin123` — role: admin
- `member / member123` — role: member

Registering a new account requires an email address (unique, validated) in addition to username/password, plus a library — admins choose "Create a new library" (get a fresh join code back) or "Join an existing library" (enter/search its code); members always join an existing library. See "Multi-Library System" below.

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
  config.py           # Config class — ports, CORS origin, secret key, GOOGLE_CLIENT_ID
                      #   (read from the GOOGLE_CLIENT_ID env var / .env; not a secret, but
                      #     kept server-side so the frontend fetches it via one endpoint
                      #     instead of duplicating it in a build-time env var)
  extensions.py       # db = SQLAlchemy() singleton
  decorators.py       # @login_required, @admin_required — both load the session's User once and
                      #   stash it as `g.current_user` / `g.library_id` so route handlers never
                      #   need to re-query it just to get the caller's library
  utils.py            # lock_book() — dialect-aware SELECT FOR UPDATE SKIP LOCKED helper
  models/
    library.py        # Library (id, name, code unique) — one row per tenant; every book/genre/
                      #   setting/community/user belongs to exactly one Library via library_id
                      #   generate_library_code() — 6-char uppercase alphanumeric (excludes
                      #     ambiguous O/0, I/1), retried against existing codes until unique
                      #   see "Multi-Library System" below
    user.py           # User (id, username unique, email unique nullable, password_hash, role,
                      #   avatar, xp, library_id FK, google_sub unique nullable)
                      #   google_sub: TEXT nullable — the Google account's stable subject id;
                      #     set the first time a user logs in or registers via Google, or the
                      #     first time an existing password account signs in with a Google
                      #     account sharing the same verified email (account linking by email,
                      #     safe since Google verifies email ownership); unique index is a
                      #     partial index (`WHERE google_sub IS NOT NULL`) so any number of
                      #     password-only accounts can keep it NULL
                      #   password_hash is never NULL even for Google-only accounts — a random
                      #     unusable password (`secrets.token_hex(32)`, hashed) is stored instead,
                      #     so the column keeps its NOT NULL constraint and no schema/migration
                      #     change was needed for Google accounts
                      #   avatar: TEXT nullable — base64 data-URL stored in DB; NULL = no photo
                      #   xp: INTEGER default 0 — cumulative Gold Games score, server-authoritative
                      #     (see "Gold Games & XP" below); included in to_dict() and /auth/me
                      #   email: nullable (pre-existing accounts may not have one — see the
                      #     username/email-split migration below) but unique when set (SQLite
                      #     allows multiple NULLs under a unique index); required for new registrations
                      #   username stays globally unique across all libraries (not per-library) —
                      #     login is just username+password, no library selector needed
                      #   has a joined-load `membership` relationship → Membership, and a
                      #     `library` relationship → Library (to_dict() nests library as {id,name,code})
    wishlist.py       # Wishlist (user_id FK, book_id FK, added_at) — one row per saved book;
                      #   unique per (user_id, book_id); to_dict() includes book title/author/
                      #     cover_url/availability so the frontend can render a card without a
                      #     second lookup
    genre.py          # Genre (id, name, library_id FK; UNIQUE(library_id, name) — same genre
                      #   name can exist independently in different libraries) — admin-extensible
                      #   genre list backing the book add/edit forms' genre dropdown, in addition
                      #   to the static constants.js GENRES list
    book.py           # Book (id, title, author, isbn, genre, total/available_copies,
                      #        description, author_bio, cover_url, cover_color, library_id FK;
                      #        UNIQUE(library_id, isbn) — two libraries can each stock a copy of
                      #        the same ISBN, but not twice within one library)
                      #   description/author_bio: NULL = never scraped, '' = tried/no data, text = data
                      #   cover_color: VARCHAR(7) nullable — dominant mid-tone hex colour of cover image
                      #     (e.g. '#a83c2e'); NULL = not yet extracted; set during scrape via Pillow
    borrow.py         # Borrow (user↔book, borrow/due/return dates, fine, fine_paid,
                      #   return_requested_at nullable DateTime — set when a member requests a
                      #   return, cleared on admin reject; return_date stays NULL until an admin
                      #   approves — see "Return Approval Workflow" below)
    reservation.py    # Reservation (user↔book, created_at, status: pending|ready)
    book_log.py       # BookLog (audit log per book — action, details, admin, timestamp)
    setting.py        # Setting (id, library_id FK, key, value; UNIQUE(library_id, key)) — every
                      #   fine-policy/pricing key is per-library now; `key` used to be the bare
                      #   primary key (one global row per key) before the multi-library migration
                      #   get_setting(key, library_id, default, cast) / set_setting(key, library_id, value)
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
                      #   Community (id, name, description, creator_id FK, library_id FK,
                      #     status: pending|approved|rejected, admin_notes, created_at)
                      #     UNIQUE(library_id, name) — communities are scoped per library, so two
                      #     libraries can each have their own "Book Club"
                      #   CommunityMembership (community_id, user_id, role: member|moderator, joined_at)
                      #   CommunityPost (community_id, author_id, title, content, created_at)
                      #   CommunityComment (post_id, author_id, parent_id FK→self, content, created_at)
                      #     — self-referential for unlimited reply depth
                      #   PostReaction (post_id, user_id, emoji VARCHAR, created_at)
                      #     — emoji column stores string keys: like|love|haha|wow|sad|angry
                      #   CommentReaction (comment_id, user_id, emoji VARCHAR, created_at)
                      #   VALID_REACTIONS = {'like','love','haha','wow','sad','angry'}
    __init__.py       # re-exports all models + seed_data() + _seed_settings()/_seed_genres()
                      #     (both take a library_id and are called both from seed_data() for the
                      #     one auto-created default library, and from auth.py's register() every
                      #     time an admin creates a brand-new library) + _seed_memberships()
                      #   seed_data() — only runs its full body if no User exists yet (fresh DB):
                      #     creates the default Library, seed admin/member accounts + 5 books in
                      #     it, then seeds its settings/genres. On an existing DB it's a no-op —
                      #     backfilling library_id onto pre-existing rows is the migration's job
                      #     (see "DB migrations" below), not seed_data()'s
                      #   _seed_memberships(db, library_id=None) — randomly assigns tiers to any
                      #     unassigned members (optionally scoped to one library); groups family
                      #     members by family_group_id (max 4), scoped per-library so group numbers
                      #     never collide across libraries. No longer called automatically on
                      #     startup (real members choose a tier via the membership-request flow
                      #     instead) — only seed_extra.py calls it now, once, to give demo accounts
                      #     realistic tiers
  routes/
    auth.py           # /api/auth/  — register, login, logout, me, avatar (PUT),
                      #   google/config, google-login, google-register (see "Google Sign-In" below)
                      #   /me now includes membership dict if user has one, plus library_id and
                      #     a nested library {id, name, code}
                      #   register requires email (validated format, globally unique) in addition
                      #     to username/password; role='admin' additionally requires
                      #     library_action: 'create' (+ library_name — makes a new Library, seeds
                      #     its default settings/genres) or 'join' (+ library_code); role='member'
                      #     always requires library_code. Login/username uniqueness are unaffected
                      #     (global, unchanged) — only registration gained these fields
                      #   also defines libraries_bp (registered separately, see below)
                      #   NOTE: membership tier is no longer requested at registration — that
                      #     picker was removed from the signup form; members request a tier later
                      #     from My Profile only (see "Membership Request System")
                      #   _resolve_library(data, role) — the library-create-or-join branch shared
                      #     by register() and google_register(), extracted so both registration
                      #     paths keep identical library-creation/join-code logic in one place
                      #   _verify_google_credential(credential) — wraps
                      #     google.oauth2.id_token.verify_oauth2_token() against
                      #     config['GOOGLE_CLIENT_ID']; returns (idinfo, None) or (None, error_msg)
                      #   GET  /api/auth/google/config — returns {client_id} so the frontend never
                      #     needs its own copy of the (non-secret) client id
                      #   POST /api/auth/google-login — body {credential}; verifies the ID token,
                      #     looks up the user by google_sub then by verified email (auto-links
                      #     google_sub onto a matching password account on first Google login);
                      #     404 with {code:'no_account'} if no match — frontend then offers to
                      #     register instead
                      #   POST /api/auth/google-register — body {credential, username, role,
                      #     library_action, library_name|library_code}; verifies the token, 400s if
                      #     the verified email or google_sub already has an account, otherwise
                      #     creates the User via the same _resolve_library() flow as register()
                      #     (password_hash gets a random unusable value — see models/user.py above)
    (libraries_bp, same file) # GET /api/libraries — unauthenticated directory of every library
                      #   {id, name, code}, sorted by name — powers Login.js's searchable
                      #   name/code picker (reuses the Select component's built-in type-to-filter)
                      #   GET /api/libraries/lookup?code= — unauthenticated single-library lookup
                      #     by exact code, 404 if not found
    books.py          # /api/books/ — CRUD + PUT edit + GET logs + GET borrows + GET reviews
                      #   every endpoint scoped by the caller's `g.library_id` (set by the
                      #   decorators — see decorators.py above): list/add/edit/delete/trending/
                      #   recommendations/collaborative-recommendations/ai-search all filter by
                      #   library; ISBN-uniqueness checks and cross-library borrow signals
                      #   (trending counts, collaborative similarity) never leak across libraries;
                      #   every by-ID lookup (logs, borrows, reviews, enrichment, scrape,
                      #   generate-field, patch-metadata) 404s if the book belongs to another
                      #   library, not just if it doesn't exist
                      #   GET /books/:id/borrows — admin-only, all Borrow records for a book
                      #     (Borrow.to_dict(), newest first) — powers the admin Logs modal's
                      #     "Borrow History" table alongside the existing inventory log
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
                      #   borrow_book() verifies the target book belongs to the caller's own
                      #     library (404 otherwise) — defense in depth against borrowing a book
                      #     ID that belongs to a different library; borrow_days read from
                      #     per-library Setting
                      #   return (POST /api/return/:id) no longer finalizes anything itself — it
                      #     only files a return request (sets return_requested_at, still accepts
                      #     the optional rating/review body, applied immediately regardless of
                      #     approval since a review doesn't touch book availability). 400s if a
                      #     request is already pending, or if the borrow has an unpaid fine
                      #     (checks `fine > 0 and not fine_paid` after a fresh calculate_fine() —
                      #     blocks the request outright rather than letting it sit pending
                      #     unapprovable). See "Return Approval Workflow" below for the admin side
    reservations.py   # /api/reserve/, /api/cancel-reservation/, /api/my-reservations
                      #   reserve_book() verifies the target book belongs to the caller's library
    wishlist.py       # GET /api/my-wishlist — caller's saved books, newest first
                      #   POST /api/wishlist/:bookId — save a book; 409 if already saved; 404 if
                      #     the book doesn't exist OR belongs to another library
                      #   DELETE /api/wishlist/:bookId — remove a saved book; 404 if not saved
                      #   all three now go through @login_required (were raw session checks
                      #     before) so `g.library_id` is available for the ownership check
    genres.py         # GET /api/genres — genre list scoped to the caller's library
                      #   POST /api/genres — admin adds a new genre to their own library;
                      #     letters-only name, normalized to Title Case, 409 if it already exists
                      #     in that library (case-insensitive) — the same name can exist in a
                      #     different library without conflict
    games.py          # POST /api/games/xp — Gold-only; body {amount}; adds amount (1–100,
                      #   MAX_XP_PER_AWARD) to the caller's User.xp and returns the new total;
                      #   _gold_user() (local copy of communities.py's helper) enforces tier —
                      #   see "Gold Games & XP" below
    admin.py          # /api/admin/ — borrows, fines, policy GET/PUT, members GET/POST,
                      #   memberships/pricing GET/PUT, members/<id>/membership PUT
                      #   All scoped to the admin's own library: admin_members filters
                      #     User.library_id; admin_borrows/admin_fines join Borrow→User and
                      #     filter by library (Borrow has no library_id of its own); policy and
                      #     membership pricing read/write per-library Setting rows via
                      #     get_setting()/set_setting()(key, library_id, ...)
                      #   PUT /api/admin/fines/<borrow_id>/mark-paid — mark a fine as paid
                      #     (sets fine_paid=True); 400 if no fine or already paid; 404 if the
                      #     borrow's user belongs to a different library
                      #   GET /api/admin/fines/history — every *paid* fine (mirrors admin_fines()
                      #     but filters fine_paid=True instead of False), sorted by due_date desc;
                      #     backs the Fines tab's "Fine History" table
                      #   PUT /api/admin/returns/<borrow_id>/approve — finalizes a member's return
                      #     request: 400 if there isn't a pending one (return_requested_at unset or
                      #     return_date already set); locks the book row (lock_book()), sets
                      #     return_date = return_requested_at (frozen at request time, not now, so
                      #     the fine doesn't keep growing while the request sits waiting on the
                      #     admin), recalculates the fine, then either promotes the next pending
                      #     Reservation to 'ready' or increments available_copies — identical
                      #     copy-release logic to what the old member-facing return_book() used
                      #     to do inline before this became a two-step approval flow
                      #   PUT /api/admin/returns/<borrow_id>/reject — clears return_requested_at
                      #     (back to a normal active borrow) so the member can request again;
                      #     same 400/404 guards as approve
                      #   members list now includes membership_tier and family_group_id
                      #   update_member_tier / admin_member_borrows — 404 if the target member
                      #     belongs to a different library (not just role check) — an admin can't
                      #     act on another library's members by guessing a user id
                      #   apply_tier(user_id, tier, family_group_id=None) — shared helper that
                      #     sets/clears a member's tier and auto-assigns a family group with room,
                      #     scoped to that user's own library so group numbers never collide
                      #     across libraries; used by members/<id>/membership PUT and by
                      #     membership_requests.py's approve endpoint so the family-grouping
                      #     logic isn't duplicated
    membership.py     # GET /api/membership — current user's tier, pricing, family members list
                      #   (family lookup joins Membership→User filtered to the caller's library)
                      # GET /api/membership/pricing — unauthenticated pricing read; optional
                      #   ?library_code= resolves which library's rates to show (no session yet
                      #   to derive it from) — used by the registration form before a library has
                      #   even been picked/created
    membership_requests.py  # POST /api/membership-requests — member submits {tier, notes?};
                      #     400 if the caller already has a pending request
                      #   GET /api/my-membership-requests — caller's own requests, newest first
                      #   GET /api/admin/membership-requests — requests for the admin's own
                      #     library only (joins to User, filters by library_id), filterable by
                      #     ?status=
                      #   PUT /api/admin/membership-requests/:id/approve — calls admin.py's
                      #     apply_tier() to grant the tier immediately, sets status=approved;
                      #     404 if the request's member belongs to a different library
                      #   PUT /api/admin/membership-requests/:id/reject — sets status=rejected
                      #     with optional admin_notes; same cross-library 404 guard
    donations.py      # /api/donations POST — member submits a donation
                      # /api/my-donations GET — member's own donation history
                      # /api/admin/donations GET — donations for the admin's own library only
                      #   (joins to User, filters by library_id), filterable by ?status=
                      # /api/admin/donations/:id/approve PUT — approve: adds book (or copy) to
                      #   the admin's own catalogue (existing-book match is library-scoped),
                      #   sets credit_amount (default price/4, admin-adjustable); 404 if the
                      #   donation's member belongs to a different library
                      # /api/admin/donations/:id/reject PUT — reject with optional reason
    book_requests.py  # POST /api/book-requests — member submits {title, author?, isbn?,
                      #   genre?, notes?}; only title is required
                      # GET  /api/my-book-requests — caller's own requests, newest first
                      # PUT  /api/book-requests/:id/dismiss — member acknowledges a reviewed
                      #   request's outcome; sets notified=True so the Home tab banner clears
                      # GET  /api/admin/book-requests — requests for the admin's own library only
                      #   (joins to User, filters by library_id), filterable by ?status=
                      # PUT  /api/admin/book-requests/:id/approve — admin can edit title/author/
                      #   isbn/genre/total_copies before confirming; matches an existing book by
                      #   ISBN or case-insensitive title within the admin's own library (adds
                      #   copies) or creates a new Book there — same match-or-create logic as
                      #   donations.py's approve endpoint; 404 if the request's member belongs
                      #   to a different library
                      # PUT  /api/admin/book-requests/:id/reject — reject with optional admin_notes
    communities.py    # Gold-member community endpoints; _gold_user() enforces tier
                      #   Community now carries library_id — list/create/admin-list all scope
                      #     by the caller's library, and the name-uniqueness check for new
                      #     communities is per-library (two libraries can each have a "Book Club")
                      #   join_community / _community_for_member (used by posts, comments,
                      #     reactions) both verify the target community's library_id matches the
                      #     caller's before proceeding — 404 otherwise
                      # GET  /api/communities              — all approved communities in the
                      #   caller's own library
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
                      # GET  /api/admin/communities        — communities in the admin's own
                      #   library only, for admin review
                      # PUT  /api/admin/communities/:id/approve — approve + auto-join creator as
                      #   moderator; 404 if the community belongs to a different library
                      # PUT  /api/admin/communities/:id/reject  — reject with optional reason;
                      #   same cross-library 404 guard
    __init__.py       # register_blueprints()
```

### DB migrations
`app.py` runs `_migrate_db()` on every startup. It uses a reusable `add_missing_cols(table, additions)` helper that calls `ALTER TABLE` for any column in models not yet present in the SQLite file. New tables (e.g. `community`, `community_membership`, `membership_request`, `book_request`, `library`) are created automatically by `db.create_all()`. `_seed_memberships()` is no longer called automatically on startup — see "Membership Request System" below.

Tables currently patched via simple `ALTER TABLE ADD COLUMN` by `add_missing_cols`: `book` (genre, description, author_bio, cover_url, cover_color), `user` (avatar, xp, library_id, email, google_sub), `post_reaction` (created_at), `comment_reaction` (created_at), `borrow` (return_requested_at). A `CREATE UNIQUE INDEX IF NOT EXISTS` (partial, `WHERE google_sub IS NOT NULL`) backs `user.google_sub` on every startup, same pattern as the `email` index below.

**Multi-library migration** (`_migrate_to_multi_library()`) — four tables (`book`, `genre`, `community`, `setting`) each had a *global* unique constraint (or, for `setting`, a bare-string primary key) that had to become per-library, and SQLite can't `ALTER` a constraint in place. Each is rebuilt: rename the old table aside, `db.create_all()` recreates it fresh with the new schema (composite `UNIQUE(library_id, ...)`), copy every row across while backfilling `library_id`, drop the renamed original. A "Default Library" is created (or reused if one already exists) to backfill onto every pre-existing row. Detected via column-presence (`library_id` missing) so it's a no-op on both a fresh DB (already has the new schema from `db.create_all()`) and an already-migrated one (safe to run on every startup).

**Username/email split migration** (`_migrate_username_email_split()`) — for accounts created before `email` existed as its own column (when the username field itself was often filled in with an email address): any user whose `username` still contains `@` and has no `email` set yet gets that value moved into `email`, and `username` replaced with a clean handle derived from the address's local part (sanitized to `[a-z0-9_]`, deduplicated against every other username with a numeric suffix on collision). Already-clean usernames (`admin`, `alice`, …) are untouched. Naturally idempotent — once a row's `email` is set, it no longer matches the `email IS NULL` filter on a later run. A `UNIQUE` index on `email` (`ix_user_email`, via `CREATE UNIQUE INDEX IF NOT EXISTS`) is (re-)ensured on every startup regardless of whether any rows needed backfilling, so a fresh install still gets it.

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
                            #       pd-xp) + library name/join code (pd-library, "Name · Code: XXXXXX",
                            #       muted/small) — inline, not stretched
                            #     Appearance row — 3 compact pd-option buttons: Light / System / Dark
                            #     Reader Themes row — 4 compact pd-option buttons: Sepia / Forest /
                            #       Ocean / Rose; clicking an active theme toggles it off (back to base)
                            #     Replay Tour row (pd-item, only rendered if onReplayTour passed) —
                            #       re-opens the Onboarding tour on demand
                            #     Sign Out row
                            #   pd-options-row / pd-option / pd-option-active CSS for compact inline layout
                            #   Closes on outside click; fade+slide animation
                            #   Props: title, username, avatar, tier, xp, library ({id,name,code} from
                            #     user.library — lets an admin see/share their join code), onLogout,
                            #     onReplayTour (optional). Passed by both dashboards as `library={user.library}`
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
                            #   ICONS — a hardcoded map of tab id → inline stroke-SVG icon; every tab id
                            #     across both dashboards (home/books/community/games/profile/borrows/
                            #     fines/members/communities/donations/membership-requests/book-requests)
                            #     maps to its own distinct icon function — no two tabs share an SVG
                            #     (communities and book-requests previously fell through to a shared/
                            #     missing icon; fixed so every id is explicit); truly unrecognised ids
                            #     fall back to a dedicated FallbackIcon (plain dot-in-circle), never to
                            #     another tab's icon
                            #   Hover tooltip — `.dock-tooltip` fades in above the icon showing the
                            #     tab's label (native `title` attribute removed to avoid a second,
                            #     competing browser tooltip); `aria-label` still set for a11y
                            #   Active tab gets an accent-coloured icon + a small dot indicator;
                            #     hover lifts the icon slightly (translateY + scale)
                            #   Badge counts render as a small red circle on the icon's corner
                            #   Both dashboards add a `layout-nav-dock` class to `.layout` when active,
                            #     which pads `.content` at the bottom so page content never sits under
                            #     the fixed dock
    Badge.js                # Status chip — variants: active (green), overdue (red), returned (gray),
                            #   queue (yellow — used for reservation queue position)
    Modal.js                # Overlay modal; wide prop for 640px variant; xwide via className="modal-xwide"
                            #     (880px — used by the admin Logs modal so its Details column and the
                            #     Borrow History table aren't squeezed)
                            #   Props: title, subtitle (optional — rendered under the title in a
                            #     `.modal-header-text` column), onClose, children, wide, className
                            #     (passthrough — lets a caller layer on a width modifier like
                            #     modal-xwide without a new dedicated prop), heroBg, heroTextColor,
                            #     heroContent
                            #   Header row has title(+subtitle) on left and ✕ close button on right
                            #   Hero mode: heroBg + heroTextColor + heroContent props render a
                            #     full-width coloured zone (background set inline) that includes
                            #     the header; padding removed from .modal root; .modal-body
                            #     wraps the remaining children with restored padding
                            #   Body scroll lock — a module-level `openModalCount` reference count is
                            #     incremented/decremented in a mount/unmount `useEffect`; sets
                            #     `document.body.style.overflow = 'hidden'` while any Modal is mounted
                            #     and only restores it once the last one unmounts, so stacked/rapid
                            #     modal opens can't leave scrolling stuck off or on incorrectly
                            #   `.modal-overlay` also has `backdrop-filter: blur(4px)` so whatever is
                            #     behind an open modal reads as visually out-of-focus
    SearchBar.js            # Controlled search input; supports autoFocus prop
    Select.js               # Custom themed dropdown replacing all native <select> elements
                            #   Props: value, onChange, children (<option> elements), className, disabled
                            #   onChange fires a synthetic { target: { value } } event so all existing
                            #     handlers work unmodified
                            #   Parses <option> children via React.Children.toArray (handles dynamic lists)
                            #   Type-to-filter search — opening the dropdown auto-focuses a small
                            #     search input above the option list; typing filters options by a
                            #     case-insensitive substring match against each option's label; shows
                            #     "No matches" when the filter empties the list; Enter picks the sole
                            #     remaining match, Escape closes — applies to every Select in the app
                            #     (genre pickers, tier pickers, condition dropdowns, etc.) with no
                            #     per-usage changes needed
                            #   Placeholder options — an `<option value="">…</option>` (used across the
                            #     app as an "unselected"/prompt choice, e.g. "Select genre") renders in
                            #     muted `--text-5` both as the collapsed trigger value and in the open
                            #     list, via `custom-select-value-placeholder` / `-option-placeholder`
                            #   Closes on outside mousedown or Escape; chevron rotates 180° when open
                            #   Variants: default (form-group sizing, 10px padding) and .filter-select
                            #     (compact 6px padding) — applied via className prop
                            #   .form-group .custom-select stretches to full width automatically
    ActionMenu.js            # Portal-based "more actions" dropdown (kebab menu) — renders via
                            #   ReactDOM.createPortal into document.body as position:fixed, so it can
                            #   never be clipped by an ancestor's overflow:hidden or mispositioned by
                            #   an ancestor's CSS transform (e.g. `.rec-card:hover`'s translateY, which
                            #   would otherwise break a plain absolute-positioned dropdown's escape from
                            #   the card). Props: open, anchorRef (the trigger button), onClose, children
                            #   On open, measures the anchor's getBoundingClientRect() and clamps the
                            #   menu's position so it always stays within the viewport (8px margin);
                            #   flips above the anchor if there isn't room below. Owns its own
                            #   outside-mousedown-to-close listener (checks both the anchor and the
                            #   portaled menu node, since the menu is no longer a DOM descendant of the
                            #   trigger once portaled). Used by AdminDashboard.js for the book card/list
                            #   kebab menu (Logs/Refresh metadata/Delete) and the Book Detail modal's
                            #   kebab menu.
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
                            #   Membership Tiers pricing section, For Members / For Admins bullet
                            #   cards, inverted CTA banner, footer
                            #   Membership Tiers — 3-column card grid (Silver/Gold/Family), Gold
                            #     marked "Most Popular"; fetches live pricing from the unauthenticated
                            #     GET /api/membership/pricing on mount (same endpoint Login.js uses)
                            #     so rates shown here always match the real, admin-configurable prices
                            #   "Get Started" navigates to /login with { state: { register: true } };
                            #   "Sign In" navigates to /login with no state
    Login.js                # Sign-in / register form (role selector on register)
                            #   Reads useLocation().state?.register to open directly in register
                            #     mode when arriving from LandingPage's "Get Started" CTA
                            #   "← Back to home" link (react-router Link to "/") above the h1
                            #   Fixed-size box (520×660, see `.login-box` in App.css) — every
                            #     state (Sign In, Register as Member, Register as Admin ×
                            #     Create/Join) renders at the identical height so switching
                            #     between them never shifts the page; verified empirically
                            #     (Playwright) rather than guessed, since the tallest content
                            #     (Register-Admin-Join) sets the floor via `min-height` and
                            #     `.login-actions { margin-top: auto }` pins the submit/toggle
                            #     buttons to the bottom of the box regardless of how short the
                            #     content above them is
                            #   Fields laid out in a 2-column grid — reuses the existing
                            #     `.modal-form-grid`/`.form-group-full` classes from the admin
                            #     Add/Edit Book modal rather than inventing new ones: Username |
                            #     Email, Password | Role, with Library spanning both columns
                            #   Email (required, type="email") only shown/collected at
                            #     registration — see "Multi-Library System" above for backend
                            #     validation/uniqueness
                            #   Library field — for members, and for admins choosing "Join an
                            #     existing library": a searchable Select (reuses Select.js's
                            #     built-in type-to-filter) populated from GET /api/libraries,
                            #     each option "Name (CODE)"; picking one shows a "Joining X" hint.
                            #     For admins choosing "Create a new library": a
                            #     `.tier-picker.tier-picker-row` (new horizontal modifier —
                            #     `.tier-picker` is normally a vertical stack, but with only 2
                            #     options — Create vs Join — a side-by-side row reads better and
                            #     is more compact; the modifier is combined with `.tier-picker` via
                            #     `.tier-picker.tier-picker-row` selector specificity so it reliably
                            #     wins regardless of CSS source order) followed by a plain library
                            #     name input
                            #   No membership-tier picker at registration anymore — removed
                            #     entirely (was previously here, reusing the same tier-picker CSS)
                            #     to keep the form short; a `field-hint` under the Library section
                            #     tells the member they can pick a tier later from My Profile —
                            #     see "Membership Request System" below
                            #   Google Sign-In — see "Google Sign-In" section below for the full
                            #     flow. `public/index.html` loads the Google Identity Services
                            #     script; Login.js fetches the client id from
                            #     `GET /api/auth/google/config` (so the id doesn't need its own
                            #     `REACT_APP_*` env var — it isn't secret, but this avoids
                            #     duplicating it in two places and a frontend rebuild if it
                            #     changes), then `window.google.accounts.id.initialize()` +
                            #     `renderButton()` into a ref'd div, re-initializing (and clearing
                            #     the div first) whenever `isRegister` toggles so the button's
                            #     text switches between "Sign in with Google"/"Sign up with Google"
                            #   `formStateRef` mirrors every form field on each render so the
                            #     Google button's one-time-registered `callback` always reads
                            #     current values (username/role/library) without re-initializing
                            #     the button on every keystroke
                            #   On the register tab, a hint above the button tells the admin to
                            #     fill in username/library first; the callback validates those
                            #     client-side and shows an inline error instead of submitting if
                            #     they're missing (Google's OAuth flow already completed by then,
                            #     so nothing is lost — the same Google credential response could in
                            #     theory be resubmitted, but in practice the admin just fills the
                            #     fields and clicks the Google button again)
                            #   A `google-login` 404 with `code: 'no_account'` (email not found)
                            #     flips `isRegister` to true and shows a hint to fill in the form
                            #     and continue with Google again to register instead
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
                            #     the other tiers aren't always visible. This is now the *only* place
                            #     a member picks a tier at all — the registration form's tier picker
                            #     (Login.js) was removed entirely, see "Membership Request System"
                            #     below; selecting a tier reveals its .field-hint description
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
    AdminDashboard.js       # Books · Borrowed · Fines · Members · Communities · Donations tabs
                            #   (Membership Requests and Book Requests no longer have their own
                            #     tabs — folded into Members and Books respectively, see below)
                            # TopBar receives onReplayTour (reopens onboarding)
                            # navStyle (from useTheme()) picks NavTabs vs Dock for the tab bar,
                            #   same as MemberDashboard — see Dock.js and ThemeContext.js above
                            # showOnboarding state — set true on mount if
                            #   localStorage["onboarding_seen_<username>"] is unset; renders
                            #   <Onboarding role="admin" .../> as a sibling above .layout
                            # + Book Detail modal + Add/Edit book modal + Inventory Logs modal
                            # + Member Records modal + Approve Donation modal + Reject Donation modal
                            # + Approve Community modal + Reject Community modal
                            # + AI Generate Field modal + Cover Upload modal
                            # Modal titles are plain "X for Y" (no em dash) across the board —
                            #   "Editing {title}", "Inventory Logs for {title}",
                            #   "Records for {username}", "{Edit|Generate} {Field} for {title}"
                            # Add Book / Edit Book modals — `wide` + a `subtitle` describing the
                            #   action, fields laid out in a 2-column `.modal-form-grid` (Title, and
                            #   the discard-reason field, span both columns via `.form-group-full`;
                            #   Author/ISBN and Genre/Copies pair up) instead of one cramped stacked
                            #   column; the submit button is full-sized (not btn-sm) and
                            #   `.modal-actions` gets a top divider, so the form reads as the
                            #   modal's clear focus rather than one option among several small ones
                            # Inventory Logs modal — `wide` + `className="modal-xwide"` (880px, see
                            #   components/Modal.js above) so the log table's Details column isn't
                            #   squeezed; besides the existing per-book inventory log
                            #   (GET /books/:id/logs), now also fetches and renders a "Borrow
                            #   History" table (GET /books/:id/borrows — borrower, borrow/due/return
                            #   dates, Active/Overdue badge, fine, paid/unpaid status) below it, both
                            #   fetched in parallel via Promise.allSettled in openLogs(); the Borrow
                            #   History table has no inner `.modal-scroll` wrapper (that capped
                            #   height at 360px with its own scrollbar) — it renders at full height
                            #   and scrolls only as part of the modal's own overall scroll
                            # + Refresh All Log modal — opens on "Refresh All"; calls
                            #   POST /books/:id/scrape for each book sequentially; appends
                            #   a log entry per book (✓ title — description, cover, author bio,
                            #   color  |  ✗ title — failed) with a live progress bar
                            #
                            # Books tab:
                            #   Book Requests (first section, pending-only) — renders only when
                            #     `pendingBookRequests.length > 0` (whole header+table hidden
                            #     otherwise, no empty-state message); table: member, book
                            #     (title + author/genre sub-row), notes, submitted date,
                            #     Approve/Reject buttons — every row is pending so the Status
                            #     column is dropped entirely here
                            #   `filteredBooks` sorts by `id` descending after filtering, so a
                            #     newly added book (highest auto-increment id) always shows first
                            #     in both grid and list view
                            #   Book Request History — collapsed by default at the very end of
                            #     the Books tab (after the catalogue), behind a chevron
                            #     `.history-toggle` button; expanding reveals Approved/Rejected/All
                            #     pills and a read-only table (no actions) with a Status badge +
                            #     admin note; `bookRequestHistoryFilter` filters client-side over
                            #     the already-fetched `bookRequests` array (no extra request)
                            #   `loadBookRequests()` now always fetches every status (no
                            #     `?status=` param) — pending/history are both derived client-side
                            #     via `pendingBookRequests` / `historyBookRequests`. Since "books"
                            #     is the default tab, this fetch is kicked off directly in the
                            #     mount effect (every other lazily-loaded tab's data instead starts
                            #     from `handleTabChange` the first time the admin switches to it)
                            #   Grid/List view toggle — `booksView` state ('grid' | 'list'),
                            #     persisted in localStorage['adminBooksView']; a single icon button
                            #     (`.view-toggle`, between the search bar and its own row — see
                            #     search bar layout below) shows the icon of the view it will
                            #     switch *to* (list icon while in grid view, grid icon while in
                            #     list view) rather than the current view
                            #   Grid view — `.admin-books-grid` (CSS Grid,
                            #     repeat(auto-fill, minmax(210px, 1fr)), not flex-wrap) so every
                            #     row's last column always lines up with the search bar/genre strip
                            #     above it instead of leaving ragged trailing whitespace on a
                            #     partial row; cards are the same rec-card style as the member
                            #     Books tab (cover, title, author, genre, rating)
                            #   List view — `.admin-book-list` > `.admin-list-row`, a compact
                            #     full-width row per book (small 36×50 cover thumbnail, title +
                            #     author, genre, rating, availability, then actions) for scanning
                            #     more books per screen than the grid allows; genre/rating columns
                            #     hide under 900px
                            #   Incomplete-metadata indicator — no longer a "Missing: …" text line
                            #     at the bottom of the card. Grid view overlays a small rounded
                            #     "Incomplete" pill (`.admin-missing-badge`, translucent dark bg +
                            #     blur) in the cover's top-left corner; list view shows a plain
                            #     corner dot (`.admin-missing-dot`) on the tiny thumbnail instead
                            #     (not enough room there for readable text). Both carry the full
                            #     "Missing: description, author bio, cover" detail in a `title`
                            #     tooltip rather than spelling it out visually
                            #   Search bar row (`.search-top-bar`, `align-items: stretch` so every
                            #     button in it matches the search input's height): search input,
                            #     then a filter-icon button (funnel/✕, `.search-icon-btn`, same
                            #     component convention as the member Books tab's search-icon-btn —
                            #     shows a dot when filters are active and the panel is collapsed),
                            #     then the grid/list `.view-toggle` button — in that left-to-right
                            #     order
                            #   Availability / Metadata filters — hidden by default; clicking the
                            #     filter-icon button reveals two Selects (`availFilter`: All copies/
                            #     Available/Out of stock; `metaFilter`: All metadata/Complete/
                            #     Incomplete — "complete" = has description AND author_bio AND
                            #     cover_url) plus a Clear button shown only while a filter is active;
                            #     folded into the same `filteredBooks` useMemo as search/genre
                            #   Each card/row has an inline action area (stopPropagation'd so it
                            #     doesn't open the detail modal), right-aligned and — in grid view —
                            #     sitting on the same line as the "X / Y available" text rather than
                            #     its own bordered row below: a borderless icon-only Edit (pencil,
                            #     `.btn-icon-ghost` — no button box at rest, `--bg-muted` on hover)
                            #     plus a "⋯" button opening an `ActionMenu` (see components/
                            #     ActionMenu.js above) with Logs / Refresh metadata / Delete; both
                            #     the grid card and list row share one `renderBookActions(b)`
                            #     render-prop helper so the two views can never drift out of sync
                            #   Clicking the card/row body opens the Book Detail modal — a
                            #     cover-colour-tinted hero (same wcagTextColor/coverPalette
                            #     derivation as MemberDashboard) with author/genre/ISBN/copies/
                            #     rating rows, description, author bio, and read-only reviews
                            #     (GET /books/:id/reviews); its own action area (Edit pencil +
                            #     "⋯" ActionMenu for Logs/Refresh metadata/Delete) is right-aligned
                            #     the same way, via `justify-content: flex-end` on
                            #     `.book-detail-action`
                            #   Author bio — bios over 50 words are truncated with a "Read more" /
                            #     "Show less" toggle (`bioExpanded` state, `authorBioTruncated`
                            #     useMemo over `selectedBook.author_bio`); resets to collapsed
                            #     whenever a different book's detail is opened
                            #   Missing description/author bio show two separate buttons from the
                            #     start — "Write manually" (`openManualEdit()` — opens the AI
                            #     Generate Field modal in "edit" mode pre-filled with whatever
                            #     exists, empty string if nothing does; never calls Groq) and
                            #     "Generate with AI" (`openAiGen()` — calls Groq immediately since
                            #     the field is empty) — so filling a gap by hand never burns an AI
                            #     call the admin didn't ask for. Once a field has content, the
                            #     single "Edit" link (`openAiGen()`, which auto-detects existing
                            #     content and opens in "edit" mode with no AI call) covers rewriting
                            #     it by hand; that same edit-mode modal still has its own
                            #     "Generate with AI" button if the admin changes their mind mid-edit.
                            #     Missing cover shows "+ Add cover" opening the Cover Upload modal
                            #     (file or URL, PUT .../patch-metadata) — both modals previously only
                            #     reachable via the Refresh Log's "Fill missing" section (which also
                            #     now opens manual-edit mode, not auto-generate), now also directly
                            #     accessible from the detail view
                            #   AI Generate Field modal — if Groq generation runs past 5 seconds
                            #     (aiGenSlow state, set by a setTimeout started when the call
                            #     begins), a "Write it yourself instead" button appears so the
                            #     admin isn't stuck waiting; clicking it drops out of the loading
                            #     state into the plain textarea (placeholder reads "Type the content
                            #     here…" in edit mode vs "Generated content will appear here…" in
                            #     generate mode). aiGenRequestIdRef guards every generate call so a
                            #     late Groq response — after a manual bail-out, a Regenerate click,
                            #     or closing the modal — is detected as stale (request id no longer
                            #     matches) and its result is discarded rather than clobbering
                            #     whatever the admin has since typed or closed
                            #
                            # Borrowed Books tab:
                            #   Table: Book · Borrower · Tags · Borrow Date · Due Date (no plain
                            #     "Status" column — see Tags below)
                            #   Column filters — Book and Borrower headers each carry a
                            #     `ColumnFilterArrow` button; Tags carries a `TagIcon` button
                            #     instead (visually distinct from the two name filters). Clicking
                            #     any of them opens one shared `ActionMenu` popover (portal,
                            #     anchored to whichever button was clicked) with a search input
                            #     (`custom-select-search`) + option list; picking an option updates
                            #     `borrowBookFilter`/`borrowBorrowerFilter`/`borrowStatusFilter` and
                            #     `filteredBorrows` (a plain `.filter()`, all client-side) re-renders
                            #   Tags column — a `.status-tag` pill (green "Due in N day(s)"/"Due
                            #     today", or red "Overdue"; `dueInDaysLabel()` computes the day
                            #     count) plus, if a return is pending, a second amber
                            #     `.status-tag-queue` "Return Requested" pill
                            #   Return approval workflow (see "Return Approval Workflow" below for
                            #     the full backend spec) — a member's return no longer finalizes
                            #     anything; once `return_requested_at` is set on a Borrow, this
                            #     table's action column (`.col-action`) shows Approve/Reject
                            #     buttons (`approveReturn`/`rejectReturn`, disabled while
                            #     `processingReturnId` matches that row). Approve calls
                            #     `PUT /api/admin/returns/:id/approve` and removes the row from
                            #     `borrows` (it's no longer active); Reject calls .../reject and
                            #     just clears `return_requested_at` on that row in place
                            #   `table-layout: fixed` with per-column % widths (`.borrows-table`)
                            #     so column widths never reflow as filters change which rows show
                            #
                            # Fines tab (merged):
                            #   Pending Fines table — all unpaid fines with `.status-tag`
                            #     (Overdue / Returned Late) and a **checkbox** (`.mark-paid-checkbox`,
                            #     theme-aware via `accent-color: var(--text)`) instead of a primary
                            #     button — checking it calls `markFinePaid()`; the row disappears
                            #     from this table once paid (and is appended to Fine History below
                            #     without a full reload); header shows total count + total dollar amount
                            #   Fine History table (new) — every paid fine, newest due-date first;
                            #     same Book/User/Due Date/Fine columns plus a green "Paid"
                            #     `.status-tag`; backed by `GET /api/admin/fines/history`
                            #     (mirrors `admin_fines()` but filters `fine_paid=True` instead)
                            #   Fine Policy form — fine_per_day and borrow_days (live editable)
                            #
                            # Members tab (merged, in this order top to bottom):
                            #   Membership Requests (pending-only) — renders only when
                            #     `pendingMembershipRequests.length > 0`; table: member, requested
                            #     tier badge, notes, submitted date, Approve/Reject — no Status
                            #     column since every row here is pending
                            #   Membership Pricing cards — Silver / Gold / Family monthly rates (editable)
                            #   Member Overview — KPI/graphs dashboard over the member list
                            #     (`memberStats` useMemo over `members`, no extra API calls):
                            #     4 stat tiles (`.member-stats`, reused from the member-profile
                            #       modal) — Total members, Currently borrowed, Fines pending
                            #       (red `.fine-amount` when > 0), Fines collected (green
                            #       `.member-stat-value-good`)
                            #     "Members by tier" — horizontal bar chart (`.bar-chart`), one bar
                            #       per tier (None/Silver/Gold/Family), colored to match the
                            #       existing `.membership-badge-*` tier colors (light + dark
                            #       variants via `.bar-chart-fill-tier-*`), each bar direct-labeled
                            #       with its count and a hover `title` tooltip
                            #     "Top borrowers" — horizontal ranked bar chart, top 5 members by
                            #       `total_borrows`, single neutral `var(--text)` fill
                            #       (`.bar-chart-fill-accent`) since it's a magnitude encoding, not
                            #       an identity one
                            #   Member Records table — all members with current tier badge,
                            #     family group, borrow counts, fines, and inline tier-change
                            #     custom Select; Username and Tier column headers each carry a
                            #     `ColumnFilterArrow`/`TagIcon` trigger opening the same searchable
                            #     `ActionMenu` popover pattern used by the Borrowed Books tab
                            #     (`memberUsernameFilter`/`memberTierFilter`, filtered into
                            #     `filteredMembers`)
                            #   Membership Request History — collapsed by default at the very end
                            #     of the tab, behind a `.history-toggle` chevron; same
                            #     Approved/Rejected/All pattern as Book Request History above
                            #     (`membershipRequestHistoryFilter` over `membershipRequests`)
                            #   `loadMembershipRequests()` always fetches every status now;
                            #     pending/history are both derived client-side
                            # Toast notifications fire on: add book, delete book, edit book,
                            #   refresh metadata, mark fine paid, save policy, save membership
                            #   pricing, change member tier, approve/reject donation,
                            #   approve/reject community, approve/reject membership request,
                            #   approve/reject book request, approve/reject return request;
                            #   policy/pricing no longer use inline "Saved" state — toasts
                            #   replace those entirely
                            #
                            # Communities tab (Kanban board, not a table):
                            #   `loadAdminCommunities()` always fetches every status now (no
                            #     `?status=` param) since all three columns render at once
                            #   `.kanban-board` — 3 `.kanban-column`s (Pending / Approved /
                            #     Rejected), each with a colored `.kanban-column-dot` + card count
                            #     in its header; collapses to 1 column under 900px
                            #   Each `.kanban-card`: name, description (2-line clamp), creator /
                            #     member count / post count meta row, submitted date, admin note;
                            #     Approve/Reject buttons only render on cards in the Pending column
                            #   Approve modal: optional admin notes; auto-joins creator as moderator
                            #   Reject modal: optional reason
                            #
                            # Donations tab (Kanban board, same pattern as Communities):
                            #   `loadDonations()` always fetches every status now
                            #   Same 3-column `.kanban-board`; each card: title, author/genre/ISBN,
                            #     member, condition, estimated value, credit awarded (if approved),
                            #     submitted date, admin note; Approve/Reject only on Pending cards
                            #   Approve modal: credit field (defaults to price/4, editable),
                            #     optional admin notes; on confirm adds book to catalogue
                            #     (or increments copy count if title or ISBN already exists)
                            #   Reject modal: optional reason field
                            #
                            # Membership Requests and Book Requests no longer have their own tabs
                            #   or status-pill/table UI — see "Members tab" and "Books tab" above.
                            #   Their approve/reject modals (title/author/ISBN/genre edit for book
                            #   requests; admin-notes-only for membership requests) are unchanged.
                            #
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

Unless noted otherwise, every endpoint below is scoped to the caller's own library (`g.library_id`) — see "Multi-Library System" above.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user. Requires `username`, `email` (validated format, globally unique), `password`, `role`. Admin role additionally requires `library_action: 'create'` (+ `library_name`) or `'join'` (+ `library_code`); member role always requires `library_code`. `requested_tier` is still accepted but unused by the frontend (tier selection moved to My Profile — see "Membership Request System") |
| POST | `/api/auth/login` | — | Login (username + password only — unaffected by multi-library) |
| POST | `/api/auth/logout` | session | Logout |
| GET | `/api/auth/me` | session | Current user — includes `email`, `library_id`, and a nested `library: {id, name, code}` |
| GET | `/api/auth/google/config` | — | `{ client_id }` — the configured `GOOGLE_CLIENT_ID`, or `''` if unset |
| POST | `/api/auth/google-login` | — | Body `{ credential }` (Google ID token). Verifies it, matches by `google_sub` then verified email; 404 `{ code: 'no_account' }` if no match |
| POST | `/api/auth/google-register` | — | Body `{ credential, username, role, library_action, library_name\|library_code }`. Verifies the token and creates the account via the same library create/join logic as `register`; 400 if the verified email/`google_sub` already has an account |

### Libraries
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/libraries` | — | Directory of every library — `[{id, name, code}]`, sorted by name; powers the registration form's searchable picker |
| GET | `/api/libraries/lookup?code=` | — | Look up one library by exact code — `{id, name}`, 404 if not found |

### Books
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/books` | member+ | List books in the caller's library; each entry includes `reservation_count`, `avg_rating`, `rating_count` |
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
| POST | `/api/return/:borrowId` | member | **Files a return request** (doesn't finalize the return — see "Return Approval Workflow"); sets `return_requested_at`. Optional JSON body `{ rating, review_text, is_anonymous }` still submits a review immediately. 400 if already requested, or if there's an unpaid fine |
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
| GET | `/api/admin/fines/history` | admin | All *paid* fines, newest due-date first |
| PUT | `/api/admin/returns/:borrow_id/approve` | admin | Approve a pending return request — finalizes `return_date` (frozen at the original request time), releases the copy or promotes the next reservation |
| PUT | `/api/admin/returns/:borrow_id/reject` | admin | Reject a pending return request — clears `return_requested_at`, member can request again |
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
| GET | `/api/membership/pricing` | — | Public pricing read (`silver_rate`, `gold_rate`, `family_rate`); optional `?library_code=` selects which library's rates to show (no session yet to derive it from) |

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

Three independent signals are computed server-side and surfaced as horizontal scrollable card strips at the top of the Books tab. All three are fetched in parallel on mount; failures are silently swallowed so a slow query never breaks the page. All three (plus AI Search) are scoped to the caller's own library — borrow/review history and candidate books from other libraries never factor into any of them.

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

## Multi-Library System

A single deployment hosts any number of independent libraries. Every `User`, `Book`, `Genre`, `Setting`, and `Community` row belongs to exactly one `Library` via a `library_id` foreign key; everything else (`Borrow`, `Reservation`, `Review`, `Wishlist`, `Donation`, `BookRequest`, `MembershipRequest`, `Membership`, community posts/comments/reactions) is scoped **transitively** through the `user_id`/`book_id`/`community_id` it already carries — no extra column needed there, just a join in the query.

**`Library` model:** `id`, `name` (not unique — two libraries can share a display name), `code` (unique, 6-char uppercase alphanumeric excluding ambiguous `O`/`0`/`I`/`1`, generated by `models/library.generate_library_code()` with a uniqueness-retry loop).

**Registration flow** (`POST /api/auth/register`, see `routes/auth.py`):
- `role='admin'` + `library_action='create'` + `library_name` — creates a new `Library`, generates its code, seeds its default fine policy/pricing settings and the 13 default genres (same defaults every library starts with).
- `role='admin'` + `library_action='join'` + `library_code` — joins an existing library (any number of admins can share one library).
- `role='member'` — always joins via `library_code` (no create option).
- `GET /api/libraries` — unauthenticated directory of every library (`{id, name, code}`), and `GET /api/libraries/lookup?code=` for a single-code lookup — both power `Login.js`'s searchable picker. **Note:** this makes join codes a public, browsable directory rather than a secret invite mechanism — anyone registering can search and join any library. That was a deliberate choice for this app (see Login.js below); flip it back to "codes given out privately by an admin" by simply not showing `GET /api/libraries` results in the UI (the endpoint itself has no auth requirement either way).
- Username stays **globally** unique (not per-library) — login is unaffected, just username + password, no library selector.

**Request-scoping mechanics:** `decorators.py`'s `login_required`/`admin_required` load the session's `User` once and stash it as `g.current_user` / `g.library_id`, so every route reads `g.library_id` instead of re-querying the user. Nearly every list endpoint filters by it (directly via a `library_id` column, or via a join for transitively-scoped tables like `Borrow`/`Donation`/`BookRequest`/`MembershipRequest`).

**Cross-tenant ID-guessing defense** — the invariant that's easy to miss: scoping *list* endpoints isn't enough. Every endpoint that loads a record **by ID** (`db.session.get(Book, id)`, an admin approving a specific donation/book-request/membership-request, marking a specific fine paid, changing a specific member's tier, etc.) also re-checks that record's owning library against `g.library_id`, 404ing otherwise — so an admin in Library B can't act on Library A's data just by incrementing an ID in the URL, even though they'd never see it in a list.

**Migration** — see "DB migrations" above for the mechanics (table rebuilds for `book`/`genre`/`community`/`setting`'s constraint changes, backfill into an auto-created "Default Library").

**Not per-library:** `TIER_LIMITS` (Silver=1/Gold=3/Family=1 active-borrow caps, in `models/membership.py`) stays a single global Python constant — it's tier *semantics*, not pricing, so every library's Gold tier means the same thing even though the Gold *rate* is set independently per library via `Setting`.

---

## Google Sign-In

Optional OAuth login/registration alongside the existing username+password flow — members and admins can both sign in or register with a Google account, either linking it to an existing password account (matched by verified email) or creating a brand-new one.

**Setup:** set `GOOGLE_CLIENT_ID` in `backend/.env` (a Google OAuth 2.0 Web application client id) and add `http://localhost:3000` as an authorized JavaScript origin in the Google Cloud Console. Nothing else is required — the frontend fetches the client id from the backend rather than needing its own copy (see `GET /api/auth/google/config`).

**Why the ID token is verified server-side, not trusted from the client:** the frontend never decodes or trusts the Google credential itself — it POSTs the raw JWT to the backend, which verifies its signature and audience via `google.oauth2.id_token.verify_oauth2_token()` against the configured client id before trusting any claim (email, sub, name) inside it.

**Sign-in flow:** clicking the Google button (rendered by Google Identity Services into a ref'd div — see Login.js above) returns a credential to `handleGoogleCredential()`, which POSTs it to `/api/auth/google-login`. The backend matches the token's `sub` (Google's stable per-account id) against `User.google_sub`, falling back to a match on verified email for an account that hasn't linked Google yet — in which case `google_sub` is set on that account right then (account linking, safe because Google already verified the email). No match → 404 `{code: 'no_account'}`, and the frontend flips to the register tab with a hint to fill in the form and try the Google button again.

**Registration flow:** same button, but on the register tab the credential goes to `/api/auth/google-register` along with whatever the admin/member has already filled in (username, role, library create/join fields) — `formStateRef` (a ref kept in sync with every field on each render) lets the button's one-time-registered callback read current values without needing to re-initialize the Google button on every keystroke. The backend re-verifies the token, 400s if the email or `sub` already has an account (existing users should sign in, not register again), otherwise creates the `User` through the same `_resolve_library()` helper `register()` uses, with a random unusable `password_hash` (see `models/user.py` above — keeps the column's NOT NULL constraint without a schema change) and `google_sub` set from the token.

**Client-side validation before submit:** since Google's own OAuth popup has already completed by the time the credential callback fires, the frontend can't "cancel" the Google step if the admin forgot to fill in username/library — instead `handleGoogleCredential()` checks those fields itself and shows an inline error asking the admin to fill them in and click the Google button again, rather than sending an incomplete request to the backend.

---

## Return Approval Workflow

Members can no longer finalize their own returns — every return now goes through an admin approval step, and an overdue borrow with an unpaid fine can't even be *requested* for return until the fine is settled.

**Why:** returning a book has always released the copy back into circulation (or promoted the next reservation) and locked in the final fine amount — both are consequential, library-facing actions that shouldn't happen purely on a member's say-so with no verification the book was actually handed back.

**Member flow:**
1. Clicking **Return** on an active borrow calls `POST /api/return/:borrowId` as before (still accepts an optional rating/review, applied immediately regardless of what happens to the return itself).
2. If the borrow is overdue with an unpaid fine (`fine > 0 and not fine_paid`, checked via a fresh `calculate_fine()`), the request is rejected outright with an error telling the member to settle the fine first — no pending request is created. (An admin can mark the fine paid — `PUT /api/admin/fines/:id/mark-paid` — even before the book is returned, since fine calculation for an active overdue borrow is already live/read-only up to that point.)
3. Otherwise, `return_requested_at` is set and the borrow stays **active** (`return_date` still NULL) — the book remains unavailable, no copy is released yet. The member sees a disabled "Return Requested" state instead of the Return button (both in the borrowed-books card list and the book detail modal's action button).
4. If an admin rejects the request, `return_requested_at` is cleared and the member can request again.

**Admin flow (Borrowed Books tab):** a pending request shows an amber "Return Requested" `.status-tag` next to the book's normal due/overdue tag, plus Approve/Reject buttons in the row's action column. Approving calls `PUT /api/admin/returns/:id/approve`, which does everything the old member-facing `return_book()` used to do inline: lock the book row, set `return_date = return_requested_at` (frozen at the moment the member requested it, so the fine doesn't keep accruing while the request sits waiting on the admin), recalculate the fine, and either promote the next pending `Reservation` to `'ready'` or increment `available_copies`. Rejecting just clears `return_requested_at`.

**Schema:** `Borrow.return_requested_at` (nullable DateTime) — NULL means no pending request; set means pending; cleared again (by reject) or superseded by a real `return_date` (by approve).

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

Members choose their own tier entirely from My Profile after signing up — registration no longer offers a tier picker at all (see Login.js below; it was removed to keep the signup form short and its size consistent across Sign In/Register/admin/member). Payment is currently handled offline (in person); online payment is a possible future addition. Mirrors the Donation System's `pending → approved/rejected` shape almost exactly.

**Member flow:**
1. **From My Profile** (any time after signing up): if the member has no pending request, a `.tier-picker` (Silver/Gold/Family, live pricing from `GET /api/membership`) appears below the membership info card, with a **Request Membership** (no tier yet) or **Request Upgrade** (already has a tier) button. Submitting calls `POST /api/membership-requests`.
2. While a request is `pending`, the picker is replaced by a status banner ("Requested — awaiting admin approval") — the 400 guard on the backend also prevents submitting a second request in the meantime.
3. If the most recent request was `rejected`, the admin's reason (if any) is shown once, then the picker reappears so the member can submit a new request.

`POST /api/auth/register`'s `requested_tier` parameter still exists server-side (harmless if omitted — it's exactly what happens now, since the frontend never sends it) but is effectively dead: no UI path populates it anymore.

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
4. Membership Tiers — 3-column pricing grid (`.landing-tiers`), one card per tier (Silver/Gold/Family) with a tagline and a benefits checklist; Gold is visually featured (`.landing-tier-featured`, "Most Popular" tag). Price per tier is fetched from `GET /api/membership/pricing` on mount so it can never drift from the real, admin-configurable rate; renders "—" until that request resolves. **Since multi-library:** this page has no library context (a logged-out visitor hasn't picked one yet), so the call is made with no `library_code` — it shows the shared *default* rates every new library starts with (9.99/19.99/29.99), not any specific existing library's admin-customized pricing. Once signed in, My Profile's membership card shows the caller's actual library's rates.
5. "For Members" / "For Admins" two-column bullet cards (reuses `.onboarding-list` styling)
6. Inverted CTA banner — `background: var(--text); color: var(--bg)` so it flips correctly across all 10 theme combinations without hardcoded colours
7. Footer — product name + Sign In link

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
- **"More actions" dropdowns are portaled, not plain `position: absolute`** — a menu absolutely-positioned inside a small trigger wrapper only stays on-screen if that wrapper happens to sit at the true edge of its container, which isn't true for the admin book card (the kebab button sits mid-card, not at its right edge) or any menu inside `.rec-card:hover` (the hover `transform` there creates a new containing block, breaking `position: fixed` too). `ActionMenu` (`components/ActionMenu.js`) instead portals into `document.body` and computes/clamps its own `position: fixed` coordinates from the trigger's `getBoundingClientRect()`, so it's correct regardless of ancestor layout or transforms — a general fix rather than special-casing each menu's container.
- **Admin book grid uses CSS Grid, not flex-wrap, specifically for edge alignment** — `flex-wrap` with fixed-width cards leaves a ragged gap after the last card in a partial row, which reads as inconsistent against the full-width search bar and genre strip above it. `repeat(auto-fill, minmax(210px, 1fr))` makes every column stretch to fill the row exactly, so the last column's right edge always lines up with its siblings above. Scoped to `.admin-books-grid` rather than changing the shared `.books-grid` class, since the member dashboard's card grids don't have this same "everything above it is full-width" visual context.
- **Modal body-scroll lock uses a module-level reference count, not a single boolean** — if a second `Modal` ever mounts while one is already open (or one unmounts slightly out of order), a plain "set on mount / clear on unmount" would risk re-enabling scroll while a modal is still showing. Counting mounts and only clearing `overflow: hidden` when the count returns to zero makes the lock correct regardless of how many modals are open at once or the order they close in.
- **Card hover feedback is a shadow + lift, not a border/background swap** — swapping `border-color`/`background` on hover is a common pattern in this codebase (`.search-icon-btn`, `.genre-card`, etc.) but reads as a state *change* rather than elevation; for the book cover cards specifically, a soft `box-shadow` plus a small `translateY(-2px)` on hover reads as the card lifting toward the cursor, a more standard "hoverable card" affordance, without touching the card's border or background at rest.
- **Metadata edit and AI generation are separate entry points, not one action with an implicit fallback** — the previous single "Generate description" button for an empty field called Groq immediately, so there was no way to hand-write a field without spending an AI call first. `openManualEdit()` (edit mode, no Groq call) and `openAiGen()` (generate mode, calls Groq) are now offered as two distinct buttons from the start; `openAiGen()` still auto-detects existing content and reuses edit mode with no AI call for the ordinary "Edit" case, and the edit-mode modal still exposes its own "Generate with AI" button, so nothing that was previously possible was removed — the empty-field path just no longer forces AI as the only option.
- **Multi-tenancy via a denormalized `library_id` column, not a separate schema-per-tenant** — every mapped-once table (`User`, `Book`, `Genre`, `Setting`, `Community`) gets its own `library_id`; tables reachable only through those (`Borrow`, `Donation`, `Review`, etc.) stay unscoped and are filtered via a join instead. This keeps one shared SQLite file and one set of migrations rather than provisioning a database per library, appropriate for this app's scale.
- **SQLite constraint changes are handled via table rebuild, not left half-migrated** — `book.isbn`, `genre.name`, `community.name`, and `setting.key` each had a *global* uniqueness guarantee that had to loosen to per-library. SQLite has no `ALTER TABLE ... DROP CONSTRAINT`/`ADD CONSTRAINT`, so each table is renamed aside, recreated fresh via `db.create_all()` (which picks up the new composite `UNIQUE`), repopulated with `library_id` backfilled, and the old copy dropped — more invasive than the codebase's usual `ADD COLUMN`-only migrations, but the only way to actually loosen those constraints without losing existing rows.
- **Cross-tenant ownership is checked on every by-ID mutation, not just on list endpoints** — it's easy to scope `GET /api/admin/donations` correctly and forget that `PUT /api/admin/donations/:id/approve` is still reachable with *any* donation ID, including one from a different library. Every such endpoint re-verifies the target record's library before acting, treated as one deliberate cross-cutting rule rather than something to remember per-endpoint.
- **Library join codes are a public directory, not a private invite secret** — `GET /api/libraries` returns every library's name and code to anyone, unauthenticated, so the registration form can offer a searchable picker instead of requiring a code to be typed blind (an explicit product choice, not an oversight — see "Multi-Library System" above for how to reverse it).
- **`TIER_LIMITS` stays a global constant, not per-library `Setting` data** — it defines what a tier *means* (Gold = 3 concurrent borrows), which is app-wide semantics; only the tier's *price* varies per library, via `Setting`. Conflating the two would let one library's Gold silently mean something different from another's.
- **Username/email split done as a one-time migration, not a new required field left unbackfilled** — many pre-existing accounts had an email address sitting in the `username` column (from before `email` existed). Rather than just adding the column and leaving old rows with `email = NULL` forever, `_migrate_username_email_split()` detects username-shaped-like-an-email rows and splits them retroactively, so old and new accounts end up in the same shape.
- **Membership tier picker removed from registration, not just made optional** — it was already optional at signup, but keeping it there meant the registration form's height depended on which role/tier the user picked, fighting the "same size across all auth forms" requirement. Moving tier selection entirely to My Profile (where it already existed as a later option) both simplifies signup and removes the tallest, most variable section from the form.
- **Login form widened into a 2-column grid instead of one long column** — reusing `.modal-form-grid`/`.form-group-full` (already used by the admin Add/Edit Book modal) cut the tallest registration variant's natural height from ~993px to ~655px just by using width that was otherwise unused, before any fixed-height trick was even applied.
- **Login box height verified with a real headless browser, not computed by hand** — CSS box-model math (padding, line-heights, margins) is easy to get wrong by hundreds of pixels once conditional sections stack up; a small Playwright script actually rendered every Sign In/Register/role/library-action combination and read back `getBoundingClientRect()` to find the true tallest state before picking `min-height`, catching a real bug in the process (a `.form-group-full` div missing the base `.form-group` class, leaving its label unstyled) that would have been invisible from reading the code alone.
- **Google ID token verified server-side, never trusted from the client** — the frontend POSTs the raw credential JWT to the backend; `google.oauth2.id_token.verify_oauth2_token()` checks its signature and audience against `GOOGLE_CLIENT_ID` before any claim inside it (email, sub) is trusted for lookup or account creation.
- **Google accounts get a random unusable `password_hash`, not a nullable column** — making `password_hash` nullable would mean threading a null-check through every place that hashes/checks a password. Generating and hashing `secrets.token_hex(32)` instead keeps the column's existing NOT NULL constraint and every other code path unchanged; the value is cryptographically unguessable and never handed to the account holder.
- **Google account linking is by verified email, not a separate "link account" flow** — if a Google sign-in's verified email matches an existing password account with no `google_sub` yet, that `google_sub` is attached right then. This is safe specifically because Google already verified the email belongs to that person — the same shortcut would not be safe for an unverified claim.
- **Return finalization is a separate admin-approval step, not folded into the member's return call** — the old `return_book()` did everything (set `return_date`, recalc fine, release the copy/promote a reservation) in one member-initiated request. Splitting "member requests a return" (`return_requested_at`) from "admin approves it" (`return_date` + copy release) means a book only leaves circulation once someone on the library side has actually confirmed it came back, without adding a new model — one nullable timestamp on `Borrow` is enough to represent "pending."
- **A pending return freezes its fine at request time, not approval time** — `approve_return()` sets `return_date = return_requested_at` rather than `datetime.utcnow()`, so a member isn't penalized for however long their request happens to sit waiting on an admin.
- **Overdue-with-unpaid-fine blocks the return *request* itself, not just the admin's approval** — rejecting the request outright (rather than accepting it and leaving it un-approvable) means there's never a pending-but-stuck state sitting in the admin's queue for a reason the admin can't resolve from that screen; the member gets the actionable error immediately.
- **Communities and Donations moved from a status-pill-filtered table to a 3-column Kanban board** — both are `pending → approved/rejected` review queues where an admin's real question is usually "what's still pending," "what did I approve," and "what did I reject" simultaneously, not one status at a time. Seeing all three side by side removed the need for the pill filter entirely; both tabs' loaders now always fetch every status in one request instead of a `?status=` round-trip per pill click.
- **Membership Requests and Book Requests folded into Members/Books instead of keeping their own tabs** — both are a secondary, occasional-admin-attention concern about an entity (a member's tier, the catalogue) that already has its own primary tab; splitting pending-only (shown by default, hidden entirely when empty) from a collapsed History section (Approved/Rejected/All, opened on demand) keeps the common case — nothing pending — from cluttering either tab, without losing the ability to look up past decisions.
- **Pending vs. History for both request types is fetch-once-filter-client-side, not two separate API calls** — `loadBookRequests()`/`loadMembershipRequests()` now always fetch every status; `pendingBookRequests`/`historyBookRequests` (and the membership equivalents) are just `.filter()`s over the one array. Simpler than keeping two loading states in sync, and the dataset per library is small enough that filtering client-side has no real cost.
- **Admin's "All Books" defaults to newest-first via `id` descending, not a `created_at` column** — `Book` has no timestamp column, and `id` is an auto-incrementing primary key, so sorting `filteredBooks` by `b.id - a.id` after filtering gets "newly added shows first" without a migration.
- **Mark Paid is a checkbox, not a primary button** — marking a fine paid is a one-way, low-friction toggle (the row disappears from Pending Fines once checked), which a checkbox communicates more directly than a button styled as a primary call-to-action; `accent-color: var(--text)` recolors the native control to match whichever of the app's 10 theme combinations is active, without hand-building a custom checkbox.
- **Member Overview charts reuse the app's existing tier/status colors, not a new chart palette** — the tier bar chart's colors are the same hex values as `.membership-badge-silver/gold/family` (light + dark variants), and the KPI tiles reuse the existing green/red fine-amount convention, so the new dashboard reads as part of the same design system instead of introducing a second color vocabulary for the same concepts (tier, paid/pending) already shown elsewhere on the same tab.
- **"Top borrowers" bar chart uses `var(--text)`, not a new accent hue** — this app's theme variants set `--btn-bg` equal to `--text` in every one of its 10 combinations (ink-colored UI chrome, no separate brand hue), so a magnitude bar chart borrows that same ink tone rather than picking an arbitrary blue that would only match one theme.
- **Borrowed Books / Member Records column filters share one `ActionMenu` popover per table, not one per column** — a single `openBorrowFilter`/`openMemberFilter` state (holding which column, if any, is open) plus one shared trigger ref means only one popover instance is ever mounted per table; each column's header button just toggles which column that shared popover currently represents, instead of managing N independent open/closed states and N `ActionMenu` instances.
