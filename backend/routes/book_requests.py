from datetime import datetime

from flask import Blueprint, request, jsonify, session, g
from extensions import db
from models import Book, BookLog, User
from models.book_request import BookRequest
from decorators import login_required, admin_required

book_requests_bp = Blueprint('book_requests', __name__, url_prefix='/api')


@book_requests_bp.route('/book-requests', methods=['POST'])
@login_required
def submit_book_request():
    data = request.json or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    req = BookRequest(
        user_id=session['user_id'],
        title=title,
        author=(data.get('author') or '').strip() or None,
        isbn=(data.get('isbn') or '').strip() or None,
        genre=(data.get('genre') or '').strip() or None,
        notes=(data.get('notes') or '').strip() or None,
        status='pending',
        submitted_at=datetime.utcnow(),
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@book_requests_bp.route('/my-book-requests')
@login_required
def my_book_requests():
    reqs = (
        BookRequest.query
        .filter_by(user_id=session['user_id'])
        .order_by(BookRequest.submitted_at.desc())
        .all()
    )
    return jsonify([r.to_dict() for r in reqs])


@book_requests_bp.route('/book-requests/<int:request_id>/dismiss', methods=['PUT'])
@login_required
def dismiss_book_request(request_id):
    req = db.session.get(BookRequest, request_id)
    if not req or req.user_id != session['user_id']:
        return jsonify({'error': 'Book request not found'}), 404
    req.notified = True
    db.session.commit()
    return jsonify(req.to_dict())


@book_requests_bp.route('/admin/book-requests')
@admin_required
def admin_book_requests():
    status = request.args.get('status')
    q = (BookRequest.query
         .join(User, BookRequest.user_id == User.id)
         .filter(User.library_id == g.library_id)
         .order_by(BookRequest.submitted_at.desc()))
    if status:
        q = q.filter(BookRequest.status == status)
    return jsonify([r.to_dict() for r in q.all()])


@book_requests_bp.route('/admin/book-requests/<int:request_id>/approve', methods=['PUT'])
@admin_required
def approve_book_request(request_id):
    req = db.session.get(BookRequest, request_id)
    if not req or not req.user or req.user.library_id != g.library_id:
        return jsonify({'error': 'Book request not found'}), 404
    if req.status != 'pending':
        return jsonify({'error': 'Book request is not pending'}), 400

    data = request.json or {}
    admin = db.session.get(User, session['user_id'])

    title = (data.get('title') or req.title or '').strip()
    author = (data.get('author') or req.author or '').strip()
    isbn = (data.get('isbn') or req.isbn or '').strip()
    genre = (data.get('genre') or req.genre or '').strip()
    if not title or not author:
        return jsonify({'error': 'title and author are required'}), 400

    try:
        total_copies = int(data.get('total_copies', 1))
        if total_copies < 1:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'total_copies must be a positive integer'}), 400

    from sqlalchemy import func as sqlfunc
    existing = None
    if isbn:
        existing = Book.query.filter_by(isbn=isbn, library_id=g.library_id).first()
    if not existing:
        existing = Book.query.filter(
            Book.library_id == g.library_id, sqlfunc.lower(Book.title) == title.lower()
        ).first()
    if existing:
        existing.total_copies += total_copies
        existing.available_copies += total_copies
        book = existing
        db.session.add(BookLog(
            book_id=book.id,
            action='Copies Added',
            details=f'Added {total_copies} cop{"y" if total_copies == 1 else "ies"} via book request from {req.user.username}',
            admin_username=admin.username,
        ))
    else:
        book = Book(
            title=title,
            author=author,
            isbn=isbn or f'REQUESTED-{request_id}',
            total_copies=total_copies,
            available_copies=total_copies,
            genre=genre,
            library_id=g.library_id,
        )
        db.session.add(book)
        db.session.flush()
        db.session.add(BookLog(
            book_id=book.id,
            action='Book Added',
            details=f'Added via book request from {req.user.username}',
            admin_username=admin.username,
        ))

    req.status = 'approved'
    req.admin_notes = (data.get('admin_notes') or '').strip() or None
    req.reviewed_at = datetime.utcnow()
    req.book_id = book.id
    req.notified = False

    db.session.commit()
    return jsonify(req.to_dict())


@book_requests_bp.route('/admin/book-requests/<int:request_id>/reject', methods=['PUT'])
@admin_required
def reject_book_request(request_id):
    req = db.session.get(BookRequest, request_id)
    if not req or not req.user or req.user.library_id != g.library_id:
        return jsonify({'error': 'Book request not found'}), 404
    if req.status != 'pending':
        return jsonify({'error': 'Book request is not pending'}), 400

    data = request.json or {}
    req.status = 'rejected'
    req.admin_notes = (data.get('admin_notes') or '').strip() or None
    req.reviewed_at = datetime.utcnow()
    req.notified = False

    db.session.commit()
    return jsonify(req.to_dict())
