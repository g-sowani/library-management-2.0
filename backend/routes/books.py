import re
import threading
import urllib.request
import urllib.parse
import json as _json

from flask import Blueprint, request, jsonify, session, current_app
from extensions import db
from models import Book, Borrow, BookLog, User
from decorators import login_required, admin_required

books_bp = Blueprint('books', __name__, url_prefix='/api')


def _clean_markdown(text):
    """Strip Open Library markdown artifacts so plain text renders cleanly."""
    # Remove reference-style link definitions: [1]: http://...
    text = re.sub(r'^\s*\[\d+\]:.*$', '', text, flags=re.MULTILINE)
    # Convert inline links [label](url) → label
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Convert reference links [label][ref] → label
    text = re.sub(r'\[([^\]]+)\]\[[^\]]*\]', r'\1', text)
    # Strip bold/italic markers
    text = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', text)
    # Remove lines that are only dashes, backslashes, or whitespace
    text = re.sub(r'^\s*[\\/-]+\s*$', '', text, flags=re.MULTILINE)
    # Remove "Also contained in:" and "... PDF" trailing lines
    text = re.sub(r'\n*Also contained in:.*', '', text, flags=re.DOTALL)
    text = re.sub(r'\n.*?PDF\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
    # Collapse excess blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _scrape_book_data(isbn, title, author):
    """Fetch description, author bio, and cover URL from Open Library."""
    work_key = None
    author_key = None
    description = ''
    author_bio = ''
    cover_url = None

    # Step 1: ISBN-based lookup
    if isbn:
        try:
            url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
            req = urllib.request.Request(url, headers={'User-Agent': 'LibraryApp/1.0'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = _json.loads(resp.read())
            entry = data.get(f"ISBN:{isbn}", {})
            works = entry.get('works', [])
            if works:
                work_key = works[0].get('key', '')
            authors = entry.get('authors', [])
            if authors:
                author_key = authors[0].get('key', '')
        except Exception:
            pass

    # Step 2: Fallback — search by title + author
    if not work_key:
        try:
            q = urllib.parse.urlencode({'title': title, 'author': author, 'limit': 1})
            url = f"https://openlibrary.org/search.json?{q}"
            req = urllib.request.Request(url, headers={'User-Agent': 'LibraryApp/1.0'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = _json.loads(resp.read())
            docs = data.get('docs', [])
            if docs:
                doc = docs[0]
                work_key = doc.get('key', '')
                if not author_key:
                    akeys = doc.get('author_key', [])
                    if akeys:
                        author_key = f'/authors/{akeys[0]}'
                cover_i = doc.get('cover_i')
                if cover_i:
                    cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg"
        except Exception:
            pass

    # Step 3: Description + cover from work record
    if work_key:
        try:
            url = f"https://openlibrary.org{work_key}.json"
            req = urllib.request.Request(url, headers={'User-Agent': 'LibraryApp/1.0'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                work_data = _json.loads(resp.read())
            desc = work_data.get('description', '')
            if isinstance(desc, dict):
                desc = desc.get('value', '')
            description = str(desc).strip()
            if not author_key:
                wauthors = work_data.get('authors', [])
                if wauthors:
                    author_key = wauthors[0].get('author', {}).get('key', '')
            if not cover_url:
                covers = work_data.get('covers', [])
                if covers and covers[0] > 0:
                    cover_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-M.jpg"
        except Exception:
            pass

    # Step 4: Author bio
    if author_key:
        try:
            url = f"https://openlibrary.org{author_key}.json"
            req = urllib.request.Request(url, headers={'User-Agent': 'LibraryApp/1.0'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                author_data = _json.loads(resp.read())
            bio = author_data.get('bio', '')
            if isinstance(bio, dict):
                bio = bio.get('value', '')
            author_bio = str(bio).strip()
        except Exception:
            pass

    # Step 5: ISBN cover as last resort
    if not cover_url and isbn:
        candidate = f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false"
        try:
            req = urllib.request.Request(candidate, method='HEAD', headers={'User-Agent': 'LibraryApp/1.0'})
            with urllib.request.urlopen(req, timeout=5):
                cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg"
        except Exception:
            pass

    return {
        'description': _clean_markdown(description),
        'author_bio': _clean_markdown(author_bio),
        'cover_url': cover_url,
    }


def _extract_dominant_color(cover_url):
    """Download cover image and return the dominant mid-tone color as '#rrggbb'."""
    try:
        from PIL import Image
        import io
        req = urllib.request.Request(cover_url, headers={'User-Agent': 'LibraryApp/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            img_data = resp.read()
        img = Image.open(io.BytesIO(img_data)).convert('RGB')
        img = img.resize((64, 64), Image.LANCZOS)
        bins = {}
        for r, g, b in img.getdata():
            bright = (r + g + b) / 3
            if bright > 220 or bright < 35:
                continue
            k = (round(r / 32) * 32, round(g / 32) * 32, round(b / 32) * 32)
            bins[k] = bins.get(k, 0) + 1
        if not bins:
            return None
        r, g, b = max(bins, key=bins.get)
        return f'#{r:02x}{g:02x}{b:02x}'
    except Exception:
        return None


def _scrape_and_store(app, book_id, isbn, title, author):
    """Background thread: scrape Open Library and persist to DB."""
    with app.app_context():
        data = _scrape_book_data(isbn, title, author)
        try:
            book = db.session.get(Book, book_id)
            if book:
                # Store '' (not None) so NULL stays as the "never tried" sentinel.
                # Frontend checks None → lazy fetch; '' → tried, no data; text → show.
                book.description = data['description']   # '' if nothing found
                book.author_bio = data['author_bio']     # '' if nothing found
                book.cover_url = data['cover_url']
                if data['cover_url']:
                    book.cover_color = _extract_dominant_color(data['cover_url'])
                db.session.commit()
        except Exception:
            db.session.rollback()


def _spawn_scrape(book):
    app = current_app._get_current_object()
    t = threading.Thread(
        target=_scrape_and_store,
        args=(app, book.id, book.isbn, book.title, book.author),
        daemon=True,
    )
    t.start()


@books_bp.route('/books')
@login_required
def get_books():
    from models.reservation import Reservation
    from models.review import Review
    from sqlalchemy import func

    books = Book.query.all()
    counts = dict(
        db.session.query(Reservation.book_id, func.count(Reservation.id))
        .group_by(Reservation.book_id)
        .all()
    )
    rating_rows = (
        db.session.query(Review.book_id, func.avg(Review.rating), func.count(Review.id))
        .group_by(Review.book_id)
        .all()
    )
    rating_stats = {row[0]: (row[1], row[2]) for row in rating_rows}

    result = []
    for b in books:
        d = b.to_dict()
        d['reservation_count'] = counts.get(b.id, 0)
        stats = rating_stats.get(b.id)
        d['avg_rating'] = round(float(stats[0]), 1) if stats else None
        d['rating_count'] = stats[1] if stats else 0
        result.append(d)
    return jsonify(result)


@books_bp.route('/books/<int:book_id>/reviews')
@login_required
def book_reviews(book_id):
    if not db.session.get(Book, book_id):
        return jsonify({'error': 'Book not found'}), 404

    from models.review import Review
    from models.user import User
    from sqlalchemy import func

    rows = (
        db.session.query(Review, User.username)
        .join(User, Review.user_id == User.id)
        .filter(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    avg = db.session.query(func.avg(Review.rating)).filter(Review.book_id == book_id).scalar()
    count = db.session.query(func.count(Review.id)).filter(Review.book_id == book_id).scalar()

    return jsonify({
        'avg_rating': round(float(avg), 1) if avg else None,
        'rating_count': count,
        'reviews': [r.to_dict(username=u) for r, u in rows],
    })


@books_bp.route('/books/<int:book_id>/enrichment')
@login_required
def book_enrichment(book_id):
    """Return stored description/bio/cover from DB. Never triggers a scrape."""
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    return jsonify({
        'description': book.description or '',
        'author_bio': book.author_bio or '',
        'cover_url': book.cover_url or '',
    })


@books_bp.route('/books/scrape-all', methods=['POST'])
@admin_required
def scrape_all_books():
    """Scrape Open Library for every book sequentially and persist results."""
    books = Book.query.all()
    for book in books:
        data = _scrape_book_data(book.isbn, book.title, book.author)
        book.description = data['description']
        book.author_bio = data['author_bio']
        book.cover_url = data['cover_url']
        if data['cover_url']:
            book.cover_color = _extract_dominant_color(data['cover_url'])
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to save scraped data'}), 500
    return jsonify({'count': len(books)})


@books_bp.route('/books/<int:book_id>/scrape', methods=['POST'])
@admin_required
def scrape_book(book_id):
    """Scrape Open Library synchronously, persist, and return the updated data."""
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    data = _scrape_book_data(book.isbn, book.title, book.author)
    try:
        book.description = data['description']
        book.author_bio = data['author_bio']
        book.cover_url = data['cover_url']
        if data['cover_url']:
            book.cover_color = _extract_dominant_color(data['cover_url'])
        db.session.commit()
        db.session.refresh(book)
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to save scraped data'}), 500
    return jsonify({
        'description': book.description or '',
        'author_bio': book.author_bio or '',
        'cover_url': book.cover_url or '',
        'cover_color': book.cover_color or '',
    })


@books_bp.route('/books', methods=['POST'])
@admin_required
def add_book():
    data = request.json
    if Book.query.filter_by(isbn=data['isbn']).first():
        return jsonify({'error': 'Book with this ISBN already exists'}), 400
    admin = db.session.get(User, session['user_id'])
    book = Book(
        title=data['title'], author=data['author'], isbn=data['isbn'],
        total_copies=data.get('total_copies', 1),
        available_copies=data.get('total_copies', 1),
        genre=data.get('genre', ''),
    )
    db.session.add(book)
    db.session.flush()
    db.session.add(BookLog(
        book_id=book.id,
        action='Book Added',
        details=f'Added with {book.total_copies} {"copy" if book.total_copies == 1 else "copies"}',
        admin_username=admin.username,
    ))
    db.session.commit()
    _spawn_scrape(book)
    return jsonify(book.to_dict()), 201


@books_bp.route('/books/<int:book_id>', methods=['PUT'])
@admin_required
def edit_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    data = request.json
    admin = db.session.get(User, session['user_id'])
    logs = []

    # Validate ISBN uniqueness if it's changing
    new_isbn = data.get('isbn')
    if new_isbn and new_isbn != book.isbn:
        conflict = Book.query.filter_by(isbn=new_isbn).first()
        if conflict:
            return jsonify({'error': 'ISBN already used by another book'}), 400

    # Metadata changes
    meta_changes = []
    for field in ['title', 'author', 'isbn', 'genre']:
        if field not in data:
            continue
        old_val = getattr(book, field) or ''
        new_val = data[field] or ''
        if old_val != new_val:
            meta_changes.append(f'{field.capitalize()}: "{old_val}" → "{new_val}"')
            setattr(book, field, new_val)

    if meta_changes:
        logs.append(BookLog(
            book_id=book.id,
            action='Details Updated',
            details='; '.join(meta_changes),
            admin_username=admin.username,
        ))

    # Copy count changes
    if 'total_copies' in data:
        new_total = int(data['total_copies'])
        if new_total < 1:
            return jsonify({'error': 'Must have at least 1 copy'}), 400

        diff = new_total - book.total_copies
        borrowed = book.total_copies - book.available_copies

        if diff > 0:
            book.total_copies = new_total
            book.available_copies += diff
            n = diff
            logs.append(BookLog(
                book_id=book.id,
                action='Copies Added',
                details=f'Added {n} {"copy" if n == 1 else "copies"} (new total: {new_total})',
                admin_username=admin.username,
            ))
        elif diff < 0:
            reason = (data.get('discard_reason') or '').strip()
            if not reason:
                return jsonify({'error': 'A reason is required when discarding copies'}), 400
            if new_total < borrowed:
                unit = 'copy is' if borrowed == 1 else 'copies are'
                return jsonify({'error': f'Cannot discard: {borrowed} {unit} currently borrowed'}), 400
            book.total_copies = new_total
            book.available_copies = new_total - borrowed
            n = -diff
            logs.append(BookLog(
                book_id=book.id,
                action='Copies Discarded',
                details=f'Discarded {n} {"copy" if n == 1 else "copies"} (new total: {new_total}). Reason: {reason}',
                admin_username=admin.username,
            ))

    for log in logs:
        db.session.add(log)
    db.session.commit()
    return jsonify(book.to_dict())


@books_bp.route('/books/<int:book_id>', methods=['DELETE'])
@admin_required
def delete_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    if Borrow.query.filter_by(book_id=book_id, return_date=None).first():
        return jsonify({'error': 'Book has active borrows'}), 400
    db.session.delete(book)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@books_bp.route('/trending')
@login_required
def trending():
    from datetime import datetime, timedelta
    from models.borrow import Borrow
    from models.review import Review
    from models.reservation import Reservation
    from sqlalchemy import func

    since = datetime.utcnow() - timedelta(days=7)

    borrow_counts = dict(
        db.session.query(Borrow.book_id, func.count(Borrow.id))
        .filter(Borrow.borrow_date >= since)
        .group_by(Borrow.book_id)
        .all()
    )
    if not borrow_counts:
        return jsonify([])

    top_ids = sorted(borrow_counts, key=borrow_counts.__getitem__, reverse=True)[:8]

    books_q = Book.query.filter(Book.id.in_(top_ids)).all()

    rating_rows = (
        db.session.query(Review.book_id, func.avg(Review.rating), func.count(Review.id))
        .filter(Review.book_id.in_(top_ids))
        .group_by(Review.book_id).all()
    )
    rating_stats = {row[0]: (float(row[1]), row[2]) for row in rating_rows}

    res_counts = dict(
        db.session.query(Reservation.book_id, func.count(Reservation.id))
        .filter(Reservation.book_id.in_(top_ids))
        .group_by(Reservation.book_id).all()
    )

    result = []
    for book in books_q:
        avg_r, r_count = rating_stats.get(book.id, (None, 0))
        d = book.to_dict()
        d['avg_rating'] = round(avg_r, 1) if avg_r else None
        d['rating_count'] = r_count
        d['reservation_count'] = res_counts.get(book.id, 0)
        d['borrow_count_week'] = borrow_counts[book.id]
        result.append(d)

    result.sort(key=lambda x: x['borrow_count_week'], reverse=True)
    return jsonify(result)


@books_bp.route('/recommendations')
@login_required
def recommendations():
    from models.borrow import Borrow
    from models.review import Review
    from models.reservation import Reservation
    from sqlalchemy import func

    user_id = session['user_id']

    user_borrows = Borrow.query.filter_by(user_id=user_id).all()
    if not user_borrows:
        return jsonify([])

    user_ratings = {r.book_id: r.rating for r in Review.query.filter_by(user_id=user_id).all()}
    borrowed_ids = {b.book_id for b in user_borrows}

    # Build weighted genre / author preference profile.
    # Rated books use rating/5 as the weight so highly-rated reads
    # pull stronger than books the user never reviewed.
    genre_weights = {}
    author_weights = {}
    for borrow in user_borrows:
        book = borrow.book
        if not book:
            continue
        rating = user_ratings.get(book.id)
        weight = rating / 5.0 if rating else 0.6
        if book.genre:
            genre_weights[book.genre] = genre_weights.get(book.genre, 0) + weight
        author_weights[book.author] = author_weights.get(book.author, 0) + weight

    candidates = Book.query.filter(~Book.id.in_(borrowed_ids)).all()
    if not candidates:
        return jsonify([])

    rating_rows = (
        db.session.query(Review.book_id, func.avg(Review.rating), func.count(Review.id))
        .group_by(Review.book_id).all()
    )
    rating_stats = {row[0]: (float(row[1]), row[2]) for row in rating_rows}

    res_counts = dict(
        db.session.query(Reservation.book_id, func.count(Reservation.id))
        .group_by(Reservation.book_id).all()
    )

    max_genre = max(genre_weights.values(), default=1)
    max_author = max(author_weights.values(), default=1)

    scored = []
    for book in candidates:
        g_score = genre_weights.get(book.genre, 0) / max_genre if book.genre else 0
        a_score = author_weights.get(book.author, 0) / max_author
        avg_r, r_count = rating_stats.get(book.id, (None, 0))
        r_score = avg_r / 5.0 if avg_r else 0.3

        total = 0.5 * g_score + 0.3 * a_score + 0.2 * r_score
        if total <= 0.15:
            continue

        # Pick the most informative reason to show the user.
        if a_score >= g_score and a_score > 0:
            reason = f'More by {book.author}'
        elif g_score > 0 and book.genre:
            reason = f'Because you read {book.genre}'
        elif avg_r and avg_r >= 4.0:
            reason = 'Highly rated'
        else:
            reason = 'You might enjoy this'

        d = book.to_dict()
        d['avg_rating'] = round(avg_r, 1) if avg_r else None
        d['rating_count'] = r_count
        d['reservation_count'] = res_counts.get(book.id, 0)
        d['reason'] = reason
        d['_score'] = total
        scored.append(d)

    scored.sort(key=lambda x: x.pop('_score'), reverse=True)
    return jsonify(scored[:8])


@books_bp.route('/collaborative-recommendations')
@login_required
def collaborative_recommendations():
    from models.borrow import Borrow
    from models.review import Review
    from models.reservation import Reservation
    from sqlalchemy import func
    import math

    user_id = session['user_id']

    # Load all borrows and reviews in two bulk queries.
    all_borrows = Borrow.query.all()
    all_reviews = {(r.user_id, r.book_id): r.rating for r in Review.query.all()}

    # Build implicit rating vectors: {uid: {book_id: weight}}
    # Rated borrow  → weight = rating / 5   (captures expressed preference)
    # Unrated borrow → weight = 0.6          (implicit positive signal)
    vectors = {}
    for b in all_borrows:
        rating = all_reviews.get((b.user_id, b.book_id))
        weight = rating / 5.0 if rating else 0.6
        vectors.setdefault(b.user_id, {})[b.book_id] = weight

    current_vec = vectors.get(user_id, {})
    if not current_vec:
        return jsonify([])

    # Precompute L2 norm for the current user once.
    current_norm = math.sqrt(sum(v * v for v in current_vec.values()))

    # Cosine similarity between current user and every other user.
    similarities = {}
    for uid, vec in vectors.items():
        if uid == user_id:
            continue
        shared = set(current_vec) & set(vec)
        if not shared:
            continue
        dot = sum(current_vec[b] * vec[b] for b in shared)
        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm == 0:
            continue
        similarities[uid] = dot / (current_norm * norm)

    if not similarities:
        return jsonify([])

    # Score each book the current user hasn't read.
    # score(book) = Σ sim(other) × other's weight for that book
    # reader_count(book) = number of similar users who borrowed it
    borrowed_ids = set(current_vec)
    book_scores = {}
    reader_counts = {}
    for uid, sim in similarities.items():
        for bid, weight in vectors[uid].items():
            if bid in borrowed_ids:
                continue
            book_scores[bid] = book_scores.get(bid, 0) + sim * weight
            reader_counts[bid] = reader_counts.get(bid, 0) + 1

    if not book_scores:
        return jsonify([])

    top_ids = sorted(book_scores, key=book_scores.__getitem__, reverse=True)[:20]

    books_q = Book.query.filter(Book.id.in_(top_ids)).all()

    rating_rows = (
        db.session.query(Review.book_id, func.avg(Review.rating), func.count(Review.id))
        .filter(Review.book_id.in_(top_ids))
        .group_by(Review.book_id).all()
    )
    rating_stats = {row[0]: (float(row[1]), row[2]) for row in rating_rows}

    res_counts = dict(
        db.session.query(Reservation.book_id, func.count(Reservation.id))
        .filter(Reservation.book_id.in_(top_ids))
        .group_by(Reservation.book_id).all()
    )

    result = []
    for book in books_q:
        avg_r, r_count = rating_stats.get(book.id, (None, 0))
        n = reader_counts.get(book.id, 1)
        reason = f'{n} reader{"s" if n != 1 else ""} like you read this'
        d = book.to_dict()
        d['avg_rating'] = round(avg_r, 1) if avg_r else None
        d['rating_count'] = r_count
        d['reservation_count'] = res_counts.get(book.id, 0)
        d['reason'] = reason
        d['_score'] = book_scores[book.id]
        result.append(d)

    result.sort(key=lambda x: x.pop('_score'), reverse=True)
    return jsonify(result[:8])


@books_bp.route('/books/ai-search', methods=['POST'])
@login_required
def ai_search():
    import json as _json_mod
    from groq import Groq
    from models.reservation import Reservation
    from models.review import Review
    from sqlalchemy import func

    query = (request.json or {}).get('query', '').strip()
    if not query:
        return jsonify({'error': 'Query is required'}), 400

    books = Book.query.all()
    if not books:
        return jsonify([])

    catalog_lines = '\n'.join(
        f'{b.id}. "{b.title}" by {b.author} [{b.genre or "Unknown genre"}]'
        for b in books
    )

    prompt = f"""You are a library search assistant. A user described a book using natural language.
Find the most relevant books from the library catalog below that match the description.

Library catalog:
{catalog_lines}

User's description: "{query}"

Return a JSON array of up to 8 matching books ordered by relevance. Each object must have:
- "id": the integer book ID from the catalog
- "reason": a concise one-line explanation of why it matches (e.g. "Boy wizard at a magical boarding school")

Only include books that genuinely match. If nothing matches well, return [].
Return ONLY the raw JSON array with no markdown, no code fences, no extra text."""

    try:
        client = Groq(api_key=current_app.config['GROQ_API_KEY'])
        response = client.chat.completions.create(
            model='llama-3.1-8b-instant',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.1,
            max_tokens=512,
        )
        raw = response.choices[0].message.content.strip()
        # Strip accidental code fences
        if '```' in raw:
            parts = raw.split('```')
            raw = parts[1] if len(parts) > 1 else parts[0]
            if raw.lower().startswith('json'):
                raw = raw[4:]
        matches = _json_mod.loads(raw.strip())
        if not isinstance(matches, list):
            matches = []
    except Exception as e:
        return jsonify({'error': f'AI search failed: {str(e)}'}), 500

    book_map = {b.id: b for b in books}
    valid_ids = [m['id'] for m in matches if isinstance(m, dict) and isinstance(m.get('id'), int)]

    rating_rows = (
        db.session.query(Review.book_id, func.avg(Review.rating), func.count(Review.id))
        .filter(Review.book_id.in_(valid_ids))
        .group_by(Review.book_id).all()
    )
    rating_stats = {row[0]: (float(row[1]), row[2]) for row in rating_rows}

    res_counts = dict(
        db.session.query(Reservation.book_id, func.count(Reservation.id))
        .filter(Reservation.book_id.in_(valid_ids))
        .group_by(Reservation.book_id).all()
    )

    result = []
    for m in matches:
        if not isinstance(m, dict) or not isinstance(m.get('id'), int):
            continue
        book = book_map.get(m['id'])
        if not book:
            continue
        avg_r, r_count = rating_stats.get(book.id, (None, 0))
        d = book.to_dict()
        d['avg_rating'] = round(avg_r, 1) if avg_r else None
        d['rating_count'] = r_count
        d['reservation_count'] = res_counts.get(book.id, 0)
        d['reason'] = m.get('reason', 'Matches your search')
        result.append(d)

    return jsonify(result)


@books_bp.route('/books/<int:book_id>/logs')
@admin_required
def book_logs(book_id):
    if not db.session.get(Book, book_id):
        return jsonify({'error': 'Book not found'}), 404
    logs = (BookLog.query
            .filter_by(book_id=book_id)
            .order_by(BookLog.timestamp.desc())
            .all())
    return jsonify([l.to_dict() for l in logs])
