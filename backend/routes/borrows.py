from flask import Blueprint, jsonify, session
from datetime import datetime, timedelta
from sqlalchemy import update as sa_update
from extensions import db
from models import Book, Borrow
from models.setting import get_setting
from decorators import login_required
from utils import lock_book

borrows_bp = Blueprint('borrows', __name__, url_prefix='/api')


@borrows_bp.route('/borrow/<int:book_id>', methods=['POST'])
@login_required
def borrow_book(book_id):
    from models.reservation import Reservation

    # Lock the book row for this transaction.
    # On PostgreSQL SKIP LOCKED returns None when a peer holds the lock; on SQLite
    # this is a plain SELECT — the atomic UPDATE below handles SQLite TOCTOU.
    book = lock_book(book_id)
    if book is None:
        # Row was skipped (locked by a peer) — check whether the book actually exists.
        if db.session.get(Book, book_id) is None:
            return jsonify({'error': 'Book not found'}), 404
        return jsonify({'error': 'Another transaction is in progress, please try again'}), 409

    if Borrow.query.filter_by(user_id=session['user_id'], book_id=book_id, return_date=None).first():
        return jsonify({'error': 'You already borrowed this book'}), 400

    user_reservation = Reservation.query.filter_by(
        user_id=session['user_id'], book_id=book_id
    ).first()

    if book.available_copies < 1:
        # Only allow if a copy was held for this user (status='ready').
        if not user_reservation or user_reservation.status != 'ready':
            return jsonify({'error': 'No copies available'}), 400
        # The held copy transfers directly into this borrow; available_copies stays 0.
        db.session.delete(user_reservation)
    else:
        # Atomic conditional decrement — covers TOCTOU for SQLite and acts as a
        # double-check on PostgreSQL after the row lock is acquired.
        result = db.session.execute(
            sa_update(Book)
            .where(Book.id == book_id)
            .where(Book.available_copies > 0)
            .values(available_copies=Book.available_copies - 1)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 0:
            # A concurrent transaction decremented the last copy between our
            # SELECT and this UPDATE (possible on SQLite without FOR UPDATE).
            return jsonify({'error': 'No copies available, please try again'}), 409

        if user_reservation:
            db.session.delete(user_reservation)

    borrow_days = get_setting('borrow_days', default=14, cast=int)
    borrow = Borrow(
        user_id=session['user_id'], book_id=book_id,
        due_date=datetime.utcnow() + timedelta(days=borrow_days),
    )
    db.session.add(borrow)
    db.session.commit()
    return jsonify(borrow.to_dict()), 201


@borrows_bp.route('/return/<int:borrow_id>', methods=['POST'])
@login_required
def return_book(borrow_id):
    from models.reservation import Reservation

    borrow = db.session.get(Borrow, borrow_id)
    if not borrow or borrow.user_id != session['user_id']:
        return jsonify({'error': 'Borrow record not found'}), 404
    if borrow.return_date:
        return jsonify({'error': 'Already returned'}), 400

    # Lock the book row so no concurrent borrow or return races with the
    # available_copies increment / reservation promotion below.
    book = lock_book(borrow.book_id)
    if book is None:
        return jsonify({'error': 'Another transaction is in progress, please try again'}), 409

    borrow.return_date = datetime.utcnow()
    borrow.calculate_fine()

    next_pending = (Reservation.query
                    .filter_by(book_id=borrow.book_id, status='pending')
                    .order_by(Reservation.created_at)
                    .first())
    if next_pending:
        # Hold the returned copy for the next person in the queue.
        next_pending.status = 'ready'
    else:
        # No queue — release the copy atomically.
        db.session.execute(
            sa_update(Book)
            .where(Book.id == borrow.book_id)
            .values(available_copies=Book.available_copies + 1)
            .execution_options(synchronize_session=False)
        )

    db.session.commit()
    return jsonify(borrow.to_dict())


@borrows_bp.route('/my-borrows')
@login_required
def my_borrows():
    borrows = Borrow.query.filter_by(user_id=session['user_id']).all()
    return jsonify([b.to_dict() for b in borrows])


@borrows_bp.route('/my-fines')
@login_required
def my_fines():
    borrows = Borrow.query.filter_by(user_id=session['user_id']).all()
    fines = [
        b.to_dict() for b in borrows
        if b.fine > 0 or (not b.return_date and datetime.utcnow() > b.due_date)
    ]
    return jsonify(fines)
