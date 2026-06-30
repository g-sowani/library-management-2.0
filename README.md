# Library Management System

Full-stack library management app built with Flask and React. Members browse books, borrow/return/reserve them, rate and review, get personalised recommendations, donate books to the library, and participate in Gold-tier community spaces. Admins manage the catalogue, monitor borrows, configure fine policy, manage membership tiers, review donations, and approve community requests.

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

**Member**
- **Home tab** (default landing page) — time-aware greeting, a horizontally scrollable "What we offer" services strip (6 feature cards with background photos: Borrow Books, Reserve a Copy, AI Search, Personalised Picks, Reading Communities, Donate & Earn), and a 6-book preview grid ("From the collection") with a "View all →" link to the Available Books tab; strip navigation arrows float over the cards and auto-hide 2 s after last use
- Browse all books grouped by genre in horizontal scrollable card strips; bare chevron arrows appear on hover (only rendered when the strip actually overflows) and auto-hide 2 s after the last scroll click
- Search and filter via a collapsible panel (click the search icon to expand; text search + availability and rating dropdowns); results appear as a card grid; clicking an active genre pill deselects it to clear the genre filter
- **AI Search** *(optional)* — click the AI toggle inside the search panel to switch to natural-language search powered by Groq; describe a book in plain English (e.g. "boy with glasses at a magical school") and get semantically matched results from the library catalogue, each with a one-line AI-generated reason; press Enter to run (no separate Search button); times out after 3 s with a clear retry prompt; Clear returns to normal keyword mode
- Borrow and return books; borrow limits enforced by membership tier
- Reserve books when all copies are out; see your queue position
- Rate (1–5 stars) and optionally review books at return time; post anonymously
- Book detail modal: the top section (title, cover, meta, action button) is tinted with the book cover's dominant colour; text colours are WCAG AA-compliant against that background; description, author bio, average rating, and reviews appear below in the default modal background
- Trending This Week strip — top 8 books by borrow count in the last 7 days
- Personalised recommendations — content-based (genre/author preference profile)
- Collaborative recommendations — users with similar reading history
- **My Profile tab** — membership info card, active borrows, reservations, fines, and donation history in one place; borrow/reservation/fines tables are center-aligned
- **Profile photo** — upload and change a profile avatar from the My Profile tab; avatar shown in the top-bar dropdown and resized/compressed client-side before upload
- **Donate a Book** — submit a physical book for the library; earn 1/4 of its estimated value as library credit upon admin approval
- **Community tab** *(Gold members only)* — create and join member communities, make posts, comment with unlimited reply threading, and react with SVG reaction icons (like / love / haha / wow / sad / angry); red badge on the tab title shows new activity since your last visit
- **Toast notifications** — brief bottom-right confirmations appear after every key action (borrow, return, reserve, cancel, donate, avatar upload, community actions)

**Admin**
- Add / edit / delete books; ISBN uniqueness enforced
- Inventory change log per book with reason tracking
- Monitor all active borrows and overdue items
- **Fines tab** — pending fines table with status badge and **Mark Paid** button per row, running total; fine policy (fine-per-day rate and loan duration) in one place
- **Members tab** — member list with borrow history, membership pricing cards, and per-member tier management in one place
- **Refresh** (per book) — re-scrapes Open Library for description, author bio, cover URL, and dominant cover colour; result shown inline
- **Refresh All** — scrapes every book in the catalogue sequentially; a live progress log modal opens showing each book's outcome as it completes (e.g. "Harry Potter — description, cover, author bio, color") with a progress bar
- **Communities tab** — review pending community requests; approve (auto-joins creator as moderator) or reject; filter by status
- **Donations tab** — review pending donations; approve (adds book to catalogue and credits member) or reject with an optional reason; filter by status
- **Toast notifications** — confirmations appear after every admin action (add/edit/delete book, mark fine paid, save policy/pricing, change tier, approve/reject donations and communities)

**Membership Tiers**

| Tier | Borrow limit | Notes |
|------|-------------|-------|
| Silver | 1 book at a time | Standard access |
| Gold | 3 books at a time | Full community section access |
| Family | 1 book per person, up to 4 members | Shared plan at a group rate |

Rates are admin-configurable at runtime (defaults: Silver $9.99 · Gold $19.99 · Family $29.99/month). Existing users are randomly assigned a tier on first startup.

**Book Metadata (Open Library)**
- Description, author bio, and cover URL are scraped from Open Library when a book is added (background thread)
- **Dominant colour** is computed from the cover image server-side using Pillow (64×64 downsample → mid-tone colour bin → stored as `#rrggbb` in the database)
- The stored colour is served with every book in `/api/books` so member clients display it instantly on modal open — no client-side image processing
- First member view of any unscraped book triggers a one-time lazy scrape and caches the result in the database
- Admins can re-scrape any individual book or all books at once via the **Refresh** / **Refresh All** buttons in the Books tab

**UI / Theme**
- **10 theme combinations** — Light and Dark base modes plus 4 reader palettes (Sepia, Forest, Ocean, Rose), each available in both light and dark variants; all combinations are fully WCAG AA compliant (≥ 4.5:1 contrast for every text level against its background)
- Appearance (Light / System / Dark) and reader palette are independent controls in the profile dropdown; clicking an active reader theme toggles it off; preferences persisted in `localStorage`
- Profile dropdown: avatar, username, membership tier badge, compact appearance row, compact reader themes row, sign out — all in one place
- **Global accent tinting** — the entire member layout is subtly tinted with the cover colour (`--accent` CSS variable) of the user's most recently active borrowed book; WCAG-safe text colour is auto-computed so contrast is always maintained
- **Animated book loader** — an open-book CSS animation (two page halves with text lines and a turning page) is shown while initial data is loading, replacing a plain spinner
- **Custom dropdowns** — all `<select>` elements are replaced by a theme-aware `Select` component; chevron rotates on open, closes on outside click, fully styled with CSS custom properties across all 10 theme combinations
- **Placeholder text** — all input and textarea placeholders use `--text-5` so they adapt to every theme rather than using browser-default grey

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
