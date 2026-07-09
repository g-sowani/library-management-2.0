# Library Management System

Full-stack, **multi-library** management app built with Flask and React — one deployment can host any number of independent libraries, each with its own catalogue, genres, members/admins, fine policy, and membership pricing. Admins register by creating a brand-new library (getting a shareable join code back) or joining an existing one via that code; members join an existing library the same way.

Members browse books, borrow/return/reserve them, rate and review, save books to a wishlist, get personalised recommendations, request that a missing book be added to the catalogue, donate books to the library, and — as Gold members — participate in community spaces and play a set of book-themed word games for XP. Admins manage the catalogue, monitor borrows, configure fine policy, manage membership tiers, review donations and book-add requests, and approve community requests.

**Live app:** [library-management-2-0.vercel.app](https://library-management-2-0.vercel.app) · **API:** [library-management-2-0-1.onrender.com](https://library-management-2-0-1.onrender.com)

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Seed Accounts](#seed-accounts)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Features](#features)
- [Seed Data Script](#seed-data-script)

---

## Tech Stack

| Layer     | Technology                                                |
|-----------|------------------------------------------------------------|
| Backend   | Python 3 · Flask 3 · SQLAlchemy · Gunicorn                 |
| Database  | SQLite (dev) · PostgreSQL (production, Render)              |
| Frontend  | React 18 (Create React App) · Axios                        |
| Auth      | Flask session cookies (`withCredentials`) · optional Google Sign-In |
| Metadata  | Open Library API (scraping) · Pillow (image processing)     |
| AI Search | Groq API · `llama-3.1-8b-instant`                          |
| Hosting   | Vercel (frontend) · Render (backend + Postgres)             |

---

## Architecture

```
Browser ── Vercel (React static build)
              │  same-origin /api/* requests
              ▼
         vercel.json rewrite
              │
              ▼
        Render (Flask + gunicorn)
              │
              ▼
        Render Postgres
```

The frontend never calls the Render backend's URL directly — `frontend/vercel.json` rewrites `/api/*` to the Render service, so the browser only ever sees the Vercel origin. This keeps session cookies same-origin (`withCredentials`) without cross-site cookie/CORS complications on the client. Flask still sets `CORS_ORIGINS` for the cases (local dev, direct API calls) where the two origins do differ.

---

## Running Locally

You need two terminal windows — one for the backend, one for the frontend.

### 1 — Backend

```bash
cd backend
python3 -m venv .venv          # first time only
source .venv/bin/activate      # Mac / Linux
# .venv\Scripts\activate       # Windows

pip install -r requirements.txt   # first time only

python app.py
# → http://localhost:5027
```

No database setup needed — with no `DATABASE_URL` set, the app falls back to a local SQLite file (`backend/instance/library.db`), created automatically on first run.

### 2 — Frontend

```bash
cd frontend
npm install      # first time only
npm start
# → http://localhost:3000
```

Open **http://localhost:3000** in your browser. The React dev server proxies all `/api/*` requests to the Flask backend on port 5027 automatically.

> **Note:** always start the backend before the frontend, otherwise the initial data fetch will fail.

---

## Environment Variables

Create `backend/.env` (all optional except where noted):

| Variable          | Required | Description |
|-------------------|----------|-------------|
| `DATABASE_URL`     | No       | Postgres connection string. Omit for local dev (falls back to SQLite). Render provides this as `postgres://…`; the app normalizes it to `postgresql://` for SQLAlchemy. |
| `SECRET_KEY`       | No       | Flask session-signing key. Defaults to a dev key locally; set a real random value in production. |
| `CORS_ORIGINS`     | No       | Comma-separated list of allowed origins. Defaults to `http://localhost:3000`. |
| `GROQ_API_KEY`     | No       | Enables AI natural-language book search. Omit to disable the feature gracefully. |
| `GOOGLE_CLIENT_ID` | No       | Enables the "Continue with Google" button. Get one from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth client, Web application) — add your frontend origin(s) under **Authorized JavaScript origins** (this app uses the client-side Google Identity Services button, not a server-side redirect, so no **Authorized redirect URI** is needed). |

---

## Seed Accounts

Created automatically on first run — no setup needed. Both accounts belong to an auto-created "Default Library".

| Role   | Username | Password  |
|--------|----------|-----------|
| Admin  | admin    | admin123  |
| Member | member   | member123 |

Registering a new account requires an email address (unique, validated) plus a library: admins pick "Create a new library" (get a fresh join code) or "Join an existing library" (search by name or code); members always join an existing library. See **Multi-Library** under Features below.

**Google Sign-In** *(optional)* — set `GOOGLE_CLIENT_ID` (see Environment Variables above) to enable a "Continue with Google" button on both the sign-in and register forms. Signing in matches an existing account by verified email (linking it automatically); registering fills in username/role/library first, then creates the account from the verified Google email — no password is ever collected for a Google-only account.

---

## Deployment

The live app is split across two platforms:

**Frontend — Vercel**
- Deploys `frontend/` on every push to `main`.
- `frontend/vercel.json` rewrites `/api/:path*` to the Render backend, so the app talks to itself same-origin in production too.

**Backend — Render (Web Service)**
| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn app:app` |
| Auto-Deploy | On push to `main` |

Set the environment variables from the table above in the Render dashboard, using `DATABASE_URL` = your Postgres instance's **Internal Database URL** (same region, no egress cost).

**Database — Render Postgres**
Provision a Postgres instance in Render, then point the web service's `DATABASE_URL` at it. `psycopg2-binary` (already in `requirements.txt`) provides the driver. On first boot against an empty database, the app creates its full schema automatically (`db.create_all()`) — no manual migration step needed for a fresh deploy.

> A `render.yaml` Blueprint exists in the repo root for reference, but the live service was provisioned manually via **New → Web Service** rather than **New → Blueprint**, so the Blueprint isn't guaranteed to match the live service's exact settings.

---

## Project Structure

```
library-management-2.0/
├── backend/
│   ├── app.py              # App factory, startup migrations
│   ├── config.py           # Env-driven configuration
│   ├── extensions.py       # SQLAlchemy instance
│   ├── models/             # One file per SQLAlchemy model
│   ├── routes/             # Blueprints, one per resource
│   ├── decorators.py       # @login_required, @admin_required, etc.
│   ├── utils.py
│   ├── requirements.txt
│   └── seed_extra.py       # Optional demo-data script (see below)
├── frontend/
│   ├── src/
│   │   ├── api.js          # Axios instance (baseURL: /api)
│   │   ├── components/
│   │   └── pages/
│   └── vercel.json         # /api/* rewrite to the Render backend
├── render.yaml              # Reference Blueprint (see Deployment)
└── context.md                # Detailed architecture / design-decision log
```

For a much deeper dive into the data model, API routes, and the reasoning behind specific implementation choices, see [`context.md`](./context.md).

---

## Features

**Multi-Library**
- One deployment, many independent libraries — each has its own catalogue, genres, members/admins, fine policy, and membership pricing; nothing (books, borrows, donations, communities, etc.) is ever visible across libraries
- Admins choose **Create a new library** (name it, get back a shareable join code) or **Join an existing library** (search by name or code) when registering; members always join an existing library
- A searchable directory (`GET /api/libraries`) backs the registration form's library picker — reuses the app's existing type-to-filter Select component, so you can search by either the library's name or its code
- Admins can see (and share) their library's join code from the profile dropdown in the top bar
- Library join codes are a public directory by design, not a private invite secret — anyone registering can search and join any library shown

**Landing Page & Onboarding**
- Public landing page at `/` for logged-out visitors — hero, a grayscale feature photo grid, a 3-column **Membership Tiers** pricing section (Silver/Gold/Family, live rates for the default pricing template), "For Members" / "For Admins" highlights, and an inverted CTA banner; "Get Started" opens the login form directly in register mode
- Registration requires a username, a unique email address, a password, and a library (create or join, for admins); membership tier is no longer offered at signup — pick one anytime afterward from My Profile (see **Membership Requests** below)
- A role-aware, **interactive** onboarding tour walks new sessions through the feature set by spotlighting the real UI element for each step (switching tabs and scrolling as needed) instead of just describing it in a static modal — 6 steps for members, 8 for admins; shown automatically on first login per account and re-runnable anytime via **Replay Tour** in the profile dropdown
- Spotlight steps dim the rest of the page around a highlighted element and show a small callout beside it; the welcome/closing steps still use the original centered card. All transitions animate smoothly as the tour moves between steps

**Member**
- **Home tab** (default landing page) — themed identically to the rest of the app (no bespoke colours): an oversized-type hero banner, a warning banner (with a direct "Return this book" link) whenever you have an overdue borrow or an unpaid fine, and five collapsible sections (My Borrowed Books, Past Borrows, My Reservations, My Wishlist, and a "From the collection" 6-book preview); only one section is expanded at a time (click its heading to open it) and the rest collapse to just their header bar
- Browse all books grouped by genre in horizontal scrollable card strips; bare chevron arrows appear on hover (only rendered when the strip actually overflows) and auto-hide 2 s after the last scroll click
- Search and filter via a collapsible panel (click the search icon to expand; text search + availability and rating dropdowns); results appear as a card grid; clicking an active genre pill deselects it to clear the genre filter
- **AI Search** *(optional)* — click the AI toggle inside the search panel to switch to natural-language search powered by Groq; describe a book in plain English (e.g. "boy with glasses at a magical school") and get semantically matched results from the library catalogue, each with a one-line AI-generated reason; press Enter to run (no separate Search button); times out after 3 s with a clear retry prompt; Clear returns to normal keyword mode
- **Request a Book** — if a keyword or AI search comes back empty, a "Request that we add it" link opens a short form (title, author, ISBN, genre, notes — only title required); once an admin approves or rejects it, a dismissible banner on the Home tab lets you know (with a straight link to the new book, if approved)
- Borrow books; borrow limits enforced by membership tier — an already-borrowed book shows an active **Return** button (opens the Return & Review modal directly) instead of a disabled label. Submitting a return **requests** it rather than finalizing it immediately — the book shows "Return Requested" until an admin approves; an overdue book with an unpaid fine can only be requested for return if you also check "I'm paying this fine now," bundling the fine payment into the same request for the admin to verify and approve together
- Reserve books when all copies are out; see your queue position
- Save books to a **wishlist** for later; remove anytime
- Rate (1–5 stars) and optionally review books at return time; post anonymously
- Book detail modal: the top section (title, cover, meta, action button) is tinted with the book cover's dominant colour; text colours (including the borrow-limit error message, if shown) are computed to stay WCAG AA-compliant against that background no matter the cover colour; description, author bio, average rating, and reviews appear below in the default modal background
- Trending This Week strip — top 8 books by borrow count in the last 7 days
- Personalised recommendations — content-based (genre/author preference profile)
- Collaborative recommendations — users with similar reading history
- **My Profile tab** — a Preferences section lets you switch navigation between the classic tab bar and a Mac-style floating icon **Dock**; plus a membership info card, My Fines, and donation history (My Borrowed Books, My Reservations, and My Wishlist now live on the Home tab — see above)
- **Membership Requests** — pick a tier from a collapsed dropdown (Silver/Gold/Family) anytime from My Profile; the request stays pending until an admin approves it, at which point the tier activates immediately — membership fees are currently handled offline (online payment may be added later)
- **Profile photo** — upload and change a profile avatar from the My Profile tab; avatar shown in the top-bar dropdown and resized/compressed client-side before upload
- **Donate a Book** — submit a physical book for the library; earn 1/4 of its estimated value as library credit upon admin approval
- **Community tab** *(Gold members only)* — create and join member communities, each shown as a card with an optional icon and banner image (set at creation, editable later by the creator or a moderator), make posts, comment with unlimited reply threading, and react with SVG reaction icons (like / love / haha / wow / sad / angry); red badge on the tab title shows new activity since your last visit
- **Games tab** *(Gold members only)* — three word/vocabulary games with a literary twist: Book Title Hangman (guess a real title from the catalogue), Word Scramble (unscramble library vocabulary, with reshuffle/hint), and Lit Wordle (5-letter literary word, 6 tries, guesses validated against a word list so you can't just mash letters); each win adds to a single running **XP** total shown in the Games tab and the profile dropdown
- **Toast notifications** — brief bottom-right confirmations appear after every key action (borrow, return, reserve, cancel, donate, avatar upload, wishlist, community actions); Borrow, Reserve, and Add-to-wishlist toasts include a **View** link straight to My Profile

**Admin**
- Every tab that can have something awaiting review (Books, Borrowed Books, Fines, Members, Communities, Donations) shows a small dot next to its tab label/icon whenever it does — a quick "something here needs you" signal, not a count
- **Books tab** shows the catalogue as either a card grid or a compact list (toggle button, preference remembered) — cover, title, author, genre, rating, availability; incomplete books get a subtle "Incomplete" badge on the cover (grid) or a small corner dot (list) instead of a warning-coloured text line, with the missing fields in a hover tooltip; new books show up first (sorted newest-added first by default)
- A **Book Requests** section sits at the top of the Books tab and only appears when there's at least one pending "please add this book" request from a member; approve it with editable title/author/ISBN/genre/copies before it's added to the catalogue, or reject with an optional reason. Past decisions live in a collapsed **Book Request History** at the very end of the tab (Approved/Rejected/All)
- Search bar with a collapsible **Availability** / **Metadata completeness** filter panel (funnel icon), plus a genre pill strip
- Each card/row has a borderless Edit (pencil) button and a "⋯" menu for Logs / Refresh metadata / Delete, so the two secondary buttons don't compete visually with Edit
- Clicking a card/row opens a Book Detail modal (cover-colour-tinted hero, author/genre/ISBN/copies/rating, description, author bio — long bios collapse with a **Read more** toggle — reviews) with the same Edit + "⋯" actions; a missing description or author bio offers **Write manually** and **Generate with AI** as two separate buttons from the start, so filling a gap by hand never spends an AI call you didn't ask for; the manual-edit view still has its own "Generate with AI" button if you change your mind. If AI generation runs past 5 seconds, a "Write it yourself instead" option appears so you're never stuck waiting on Groq
- Add / edit / delete books; ISBN uniqueness enforced
- Inventory change log per book, now paired with a **Borrow History** table (borrower, dates, fine, paid status) for that book in the same Logs modal
- **Borrowed Books tab** — Book, Borrower, Tags, Borrow Date, and Due Date columns, each of Book/Borrower/Tags filterable via a searchable popover (click the small arrow/tag icon in its header); the Tags column shows a "Due in N days"/"Overdue" pill, plus an amber "Return Requested" pill (and a "Fine Payment $X Pending" pill, if one was bundled in) once a member asks to return it. Rows with a pending request sort to the top of the table. Members can no longer finalize their own return — every return needs an **Approve**/**Reject** here; approving a return with a bundled fine payment also marks that fine paid in the same click
- **Fines tab** — pending fines table with a status pill and a theme-aware **Mark Paid** checkbox per row (instead of a button), running total; a **Fine History** table below it lists every fine already paid; fine policy (fine-per-day rate and loan duration) in one place
- **Members tab** — a pending-only **Membership Requests** section up top (hidden when empty; approve grants the tier immediately, family requests auto-assigned to a group with room, or reject with an optional reason), Membership Pricing cards, a **Member Overview** KPI/graphs dashboard (total members, currently borrowed, fines pending/collected, a Members-by-Tier bar chart, and a Top Borrowers bar chart), the Member Records table (Username/Tier columns are filterable the same way as Borrowed Books), and a collapsed **Membership Request History** at the very end
- **Refresh** (per book) — re-scrapes Open Library for description, author bio, cover URL, and dominant cover colour; result shown inline
- **Refresh All** — scrapes every book in the catalogue sequentially; a live progress log modal opens showing each book's outcome as it completes (e.g. "Harry Potter — description, cover, author bio, color") with a progress bar
- **Communities tab** — a Kanban board (Pending / Approved / Rejected columns, each with a card count) instead of a filtered table; approve a pending card (auto-joins creator as moderator) or reject it
- **Donations tab** — same Kanban board layout as Communities; approve a pending donation (adds book to catalogue and credits member) or reject with an optional reason
- **Toast notifications** — confirmations appear after every admin action (add/edit/delete book, mark fine paid, save policy/pricing, change tier, approve/reject donations, communities, membership requests, book requests, and return requests)

**Membership Tiers**

| Tier | Borrow limit | Notes |
|------|-------------|-------|
| Silver | 1 book at a time | Standard access |
| Gold | 3 books at a time | Full community section access + Games tab (Hangman/Scramble/Wordle) & XP |
| Family | 1 book per person, up to 4 members | Shared plan at a group rate |

Rates are admin-configurable at runtime per library (defaults: Silver $9.99 · Gold $19.99 · Family $29.99/month — every new library starts with these, then an admin can change them). Members request a tier anytime from My Profile and it activates once an admin approves the request — payment is currently handled offline. The demo accounts created by `seed_extra.py` (see below) are given random tiers automatically so the app looks realistic out of the box; real accounts are not.

**Book Metadata (Open Library)**
- Description, author bio, and cover URL are scraped from Open Library when a book is added (background thread)
- **Dominant colour** is computed from the cover image server-side using Pillow (64×64 downsample → mid-tone colour bin → stored as `#rrggbb` in the database)
- The stored colour is served with every book in `/api/books` so member clients display it instantly on modal open — no client-side image processing
- First member view of any unscraped book triggers a one-time lazy scrape and caches the result in the database
- Admins can re-scrape any individual book or all books at once via the **Refresh** / **Refresh All** buttons in the Books tab

**UI / Theme**
- **10 theme combinations** — Light and Dark base modes plus 4 reader palettes (Sepia, Forest, Ocean, Rose), each available in both light and dark variants; all combinations are fully WCAG AA compliant (≥ 4.5:1 contrast for every text level against its background)
- Appearance (Light / System / Dark) and reader palette are independent controls in the profile dropdown; clicking an active reader theme toggles it off; preferences persisted in `localStorage`
- **Navigation style** — Tab Bar (default) or a Mac-style floating icon **Dock**, chosen from My Profile → Preferences or from the profile dropdown in the top bar (the only place to set it on the admin dashboard, which has no Profile tab of its own); persisted in `localStorage` alongside appearance/reader theme and applies to both the member and admin dashboards
- **Sticky header** — the top bar and tab bar stay fixed at the top of the viewport while page content scrolls beneath them
- **Responsive layout** — the app shell (top bar, nav tabs, the floating Dock nav), modals, tables, and every major page (landing, login/register, both dashboards) adapt down to mobile widths; nav tabs and the Dock scroll horizontally rather than clipping, tables scroll internally instead of squeezing columns illegibly, and modals/forms clamp to the viewport and reflow to a single column
- Profile dropdown: avatar, username, membership tier badge, XP total (Gold only), compact appearance row, compact reader themes row, compact navigation-style row (Tab Bar/Dock), sign out — all in one place
- **Global accent tinting** — the entire member layout is subtly tinted with the cover colour (`--accent` CSS variable) of the user's most recently active borrowed book; WCAG-safe text colour is auto-computed so contrast is always maintained
- **Animated book loader** — an open-book CSS animation (two page halves with text lines and a turning page) is shown while initial data is loading, replacing a plain spinner
- **Custom dropdowns** — all `<select>` elements are replaced by a theme-aware `Select` component with a built-in type-to-filter search box (auto-focused on open, filters options as you type); chevron rotates on open, closes on outside click, fully styled with CSS custom properties across all 10 theme combinations
- **Placeholder text** — all input and textarea placeholders, and any dropdown's "unselected" option, use `--text-5` so they adapt to every theme rather than using browser-default grey
- **Focused modals** — opening any modal blurs the page behind it and locks background scrolling until it's closed
- **Icon-only, no emoji** — every icon in the UI is an inline stroke-SVG (reactions, filters, lock/close/chevrons, the Games icons, etc.); no pictographic emoji anywhere

---

## Seed Data Script

`backend/seed_extra.py` is a one-shot helper script (run manually once, not auto-executed). It targets the auto-created "Default Library" (resolved via the seed `member` account) — run it before creating other libraries if you want the demo data to land in the right place:

```bash
cd backend
source .venv/bin/activate
python seed_extra.py
```

Adds 45 books across 11 genres and 4 extra member accounts with rich borrow histories:

| Username | Password  | Notes |
|----------|-----------|-------|
| alice    | alice123  | Heavy reader — on-time returns, some paid fines, 2 active borrows |
| bob      | bob123    | Few borrows — unpaid fines, one overdue unreturned book |
| carol    | carol123  | Consistent reader — no fines |
| dave     | dave123   | Occasional reader — one overdue unreturned book |

Also assigns each of these accounts (plus the original seed `member` account) a random membership tier, so the Membership Tiers features have realistic demo data out of the box.
