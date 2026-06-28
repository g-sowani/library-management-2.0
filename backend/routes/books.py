from flask import Blueprint, request, jsonify, session
from extensions import db
from models import Book, Borrow, BookLog, User
from decorators import login_required, admin_required

books_bp = Blueprint('books', __name__, url_prefix='/api')


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
