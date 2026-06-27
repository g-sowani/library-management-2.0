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
