# Library Management System

Full-stack library management app built with Flask and React. Members browse books, borrow/return/reserve them, rate and review, save books to a wishlist, get personalised recommendations, request that a missing book be added to the catalogue, donate books to the library, and — as Gold members — participate in community spaces and play a set of book-themed word games for XP. Admins manage the catalogue, monitor borrows, configure fine policy, manage membership tiers, review donations and book-add requests, and approve community requests.

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

## Seed Accounts

Created automatically on first run — no setup needed.

| Role   | Username | Password  |
|--------|----------|-----------|
| Admin  | admin    | admin123  |
| Member | member   | member123 |

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Backend  | Python 3 · Flask 3 · SQLAlchemy · SQLite |
| Frontend | React 18 (Create React App) · Axios     |
| Auth     | Flask session cookies (`withCredentials`) |
| Metadata | Open Library API (scraping) · Pillow (image processing) |
| AI Search | Groq API · `llama-3.1-8b-instant` |

---

## Features

**Landing Page & Onboarding**
- Public landing page at `/` for logged-out visitors — hero, a grayscale feature photo grid, "For Members" / "For Admins" highlights, and an inverted CTA banner; "Get Started" opens the login form directly in register mode
- Registering as a member shows an optional membership tier picker with live pricing — pick now or decide later from My Profile (see **Membership Requests** below)
- A role-aware, **interactive** onboarding tour walks new sessions through the feature set by spotlighting the real UI element for each step (switching tabs and scrolling as needed) instead of just describing it in a static modal — 6 steps for members, 8 for admins; shown automatically on first login per account and re-runnable anytime via **Replay Tour** in the profile dropdown
- Spotlight steps dim the rest of the page around a highlighted element and show a small callout beside it; the welcome/closing steps still use the original centered card. All transitions animate smoothly as the tour moves between steps

**Member**
- **Home tab** (default landing page) — a bold, colour-blocked editorial layout instead of a plain page: an oversized-type hero banner, then four collapsible sections (My Borrowed Books, My Reservations, My Wishlist, and a "From the collection" 6-book preview) each in its own vivid, WCAG-verified background colour; only one section is expanded at a time (click its heading to open it) and the rest collapse to just their header bar and pile up underneath, with a few sections cut on a bold diagonal edge for visual rhythm
- Browse all books grouped by genre in horizontal scrollable card strips; bare chevron arrows appear on hover (only rendered when the strip actually overflows) and auto-hide 2 s after the last scroll click
- Search and filter via a collapsible panel (click the search icon to expand; text search + availability and rating dropdowns); results appear as a card grid; clicking an active genre pill deselects it to clear the genre filter
- **AI Search** *(optional)* — click the AI toggle inside the search panel to switch to natural-language search powered by Groq; describe a book in plain English (e.g. "boy with glasses at a magical school") and get semantically matched results from the library catalogue, each with a one-line AI-generated reason; press Enter to run (no separate Search button); times out after 3 s with a clear retry prompt; Clear returns to normal keyword mode
- **Request a Book** — if a keyword or AI search comes back empty, a "Request that we add it" link opens a short form (title, author, ISBN, genre, notes — only title required); once an admin approves or rejects it, a dismissible banner on the Home tab lets you know (with a straight link to the new book, if approved)
- Borrow and return books; borrow limits enforced by membership tier — an already-borrowed book shows an active **Return** button (opens the Return & Review modal directly) instead of a disabled label
- Reserve books when all copies are out; see your queue position
- Save books to a **wishlist** for later; remove anytime
- Rate (1–5 stars) and optionally review books at return time; post anonymously
- Book detail modal: the top section (title, cover, meta, action button) is tinted with the book cover's dominant colour; text colours (including the borrow-limit error message, if shown) are computed to stay WCAG AA-compliant against that background no matter the cover colour; description, author bio, average rating, and reviews appear below in the default modal background
- Trending This Week strip — top 8 books by borrow count in the last 7 days
- Personalised recommendations — content-based (genre/author preference profile)
- Collaborative recommendations — users with similar reading history
- **My Profile tab** — a Preferences section lets you switch navigation between the classic tab bar and a Mac-style floating icon **Dock**; plus a membership info card, My Fines, and donation history (My Borrowed Books, My Reservations, and My Wishlist now live on the Home tab — see above)
- **Membership Requests** — pick a tier from a collapsed dropdown (Silver/Gold/Family) at registration or anytime from My Profile; the request stays pending until an admin approves it, at which point the tier activates immediately — membership fees are currently handled offline (online payment may be added later)
- **Profile photo** — upload and change a profile avatar from the My Profile tab; avatar shown in the top-bar dropdown and resized/compressed client-side before upload
- **Donate a Book** — submit a physical book for the library; earn 1/4 of its estimated value as library credit upon admin approval
- **Community tab** *(Gold members only)* — create and join member communities, make posts, comment with unlimited reply threading, and react with SVG reaction icons (like / love / haha / wow / sad / angry); red badge on the tab title shows new activity since your last visit
- **Games tab** *(Gold members only)* — three word/vocabulary games with a literary twist: Book Title Hangman (guess a real title from the catalogue), Word Scramble (unscramble library vocabulary, with reshuffle/hint), and Lit Wordle (5-letter literary word, 6 tries, guesses validated against a word list so you can't just mash letters); each win adds to a single running **XP** total shown in the Games tab and the profile dropdown
- **Toast notifications** — brief bottom-right confirmations appear after every key action (borrow, return, reserve, cancel, donate, avatar upload, wishlist, community actions); Borrow, Reserve, and Add-to-wishlist toasts include a **View** link straight to My Profile

**Admin**
- **Books tab** shows the catalogue as a card grid (cover, title, author, genre, rating, availability — same card style as the member Books tab); a "Missing: …" tag flags any book lacking description, author bio, or cover
- Clicking a card opens a Book Detail modal (cover-colour-tinted hero, author/genre/ISBN/copies/rating, description, author bio, reviews) with Edit / Logs / Refresh metadata / Delete actions; description and author bio always have an **Edit** (if filled) or **✨ Generate** (if missing) action right in the modal, so gaps can be filled — or existing text rewritten — without leaving the view; if AI generation runs past 5 seconds, a "Write it yourself instead" option appears so you're never stuck waiting on Groq
- Add / edit / delete books; ISBN uniqueness enforced
- Inventory change log per book with reason tracking
- Monitor all active borrows and overdue items
- **Fines tab** — pending fines table with status badge and **Mark Paid** button per row, running total; fine policy (fine-per-day rate and loan duration) in one place
- **Members tab** — member list with borrow history, membership pricing cards, and per-member tier management in one place
- **Refresh** (per book) — re-scrapes Open Library for description, author bio, cover URL, and dominant cover colour; result shown inline
- **Refresh All** — scrapes every book in the catalogue sequentially; a live progress log modal opens showing each book's outcome as it completes (e.g. "Harry Potter — description, cover, author bio, color") with a progress bar
- **Communities tab** — review pending community requests; approve (auto-joins creator as moderator) or reject; filter by status
- **Donations tab** — review pending donations; approve (adds book to catalogue and credits member) or reject with an optional reason; filter by status
- **Membership Requests tab** — review tier requests submitted by members (at registration or later from their profile); approve to grant the tier immediately (family requests auto-assigned to a group with room) or reject with an optional reason; filter by status
- **Book Requests tab** — review "please add this book" requests submitted by members from an empty search; approve with editable title/author/ISBN/genre/copies before it's added to the catalogue, or reject with an optional reason; filter by status
- **Toast notifications** — confirmations appear after every admin action (add/edit/delete book, mark fine paid, save policy/pricing, change tier, approve/reject donations, communities, membership requests, and book requests)

**Membership Tiers**

| Tier | Borrow limit | Notes |
|------|-------------|-------|
| Silver | 1 book at a time | Standard access |
| Gold | 3 books at a time | Full community section access + Games tab (Hangman/Scramble/Wordle) & XP |
| Family | 1 book per person, up to 4 members | Shared plan at a group rate |

Rates are admin-configurable at runtime (defaults: Silver $9.99 · Gold $19.99 · Family $29.99/month). Members request a tier (at registration or later from My Profile) and it activates once an admin approves the request — payment is currently handled offline. The demo accounts created by `seed_extra.py` (see below) are given random tiers automatically so the app looks realistic out of the box; real accounts are not.

**Book Metadata (Open Library)**
- Description, author bio, and cover URL are scraped from Open Library when a book is added (background thread)
- **Dominant colour** is computed from the cover image server-side using Pillow (64×64 downsample → mid-tone colour bin → stored as `#rrggbb` in the database)
- The stored colour is served with every book in `/api/books` so member clients display it instantly on modal open — no client-side image processing
- First member view of any unscraped book triggers a one-time lazy scrape and caches the result in the database
- Admins can re-scrape any individual book or all books at once via the **Refresh** / **Refresh All** buttons in the Books tab

**UI / Theme**
- **10 theme combinations** — Light and Dark base modes plus 4 reader palettes (Sepia, Forest, Ocean, Rose), each available in both light and dark variants; all combinations are fully WCAG AA compliant (≥ 4.5:1 contrast for every text level against its background)
- Appearance (Light / System / Dark) and reader palette are independent controls in the profile dropdown; clicking an active reader theme toggles it off; preferences persisted in `localStorage`
- **Navigation style** — Tab Bar (default) or a Mac-style floating icon **Dock**, chosen from My Profile → Preferences; persisted in `localStorage` alongside appearance/reader theme and applies to both the member and admin dashboards
- **Sticky header** — the top bar and tab bar stay fixed at the top of the viewport while page content scrolls beneath them
- Profile dropdown: avatar, username, membership tier badge, XP total (Gold only), compact appearance row, compact reader themes row, sign out — all in one place
- **Global accent tinting** — the entire member layout is subtly tinted with the cover colour (`--accent` CSS variable) of the user's most recently active borrowed book; WCAG-safe text colour is auto-computed so contrast is always maintained
- **Animated book loader** — an open-book CSS animation (two page halves with text lines and a turning page) is shown while initial data is loading, replacing a plain spinner
- **Custom dropdowns** — all `<select>` elements are replaced by a theme-aware `Select` component; chevron rotates on open, closes on outside click, fully styled with CSS custom properties across all 10 theme combinations
- **Placeholder text** — all input and textarea placeholders use `--text-5` so they adapt to every theme rather than using browser-default grey
- **Icon-only, no emoji** — every icon in the UI is an inline stroke-SVG (reactions, filters, lock/close/chevrons, the Games icons, etc.); no pictographic emoji anywhere

## Seed Data Script

`backend/seed_extra.py` is a one-shot helper script (run manually once, not auto-executed):

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
