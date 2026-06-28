# Library Management System

Full-stack library management app built with Flask and React. Members browse books, borrow/return/reserve them, rate and review, and get personalised recommendations. Admins manage the catalogue, monitor borrows, and configure fine policy.

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
| Metadata | Open Library API (scraping)             |

---

## Features

**Member**
- Browse all books with search, genre, availability, and rating filters
- Borrow and return books; view active borrows and due dates
- Reserve books when all copies are out; see your queue position
- Rate (1–5 stars) and optionally review books at return time; post anonymously
- Book detail modal: cover image, description, author bio, average rating, and all reviews
- Trending This Week strip — top 8 books by borrow count in the last 7 days
- Personalised recommendations — content-based (genre/author preference profile)
- Collaborative recommendations — users with similar reading history
- View and track unpaid fines

**Admin**
- Add / edit / delete books; ISBN uniqueness enforced
- Inventory change log per book with reason tracking
- Monitor all active borrows and overdue items
- View all unpaid fines
- Manage member records and full borrow history per member
- Configure fine-per-day rate and loan duration at runtime
- Refresh book metadata (description, author bio, cover) from Open Library

**Book Metadata (Open Library)**
- Description and author bio are scraped from Open Library when a book is added
- Cover images are fetched and stored by URL
- First member view of any unscraped book triggers a one-time lazy scrape and caches the result in the database
- Admins can re-scrape any book via the **Refresh** button in the Books tab
