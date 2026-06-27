from flask import Blueprint, jsonify, session
from sqlalchemy import update as sa_update
from extensions import db
from models import Book, Borrow
from models.reservation import Reservation
from decorators import login_required
from utils import lock_book

reservations_bp = Blueprint('reservations', __name__, url_prefix='/api')


@reservations_bp.route('/reserve/<int:book_id>', methods=['POST'])
@login_required
def reserve_book(book_id):
    # Lock the book row so no concurrent borrow can sneak in and make a copy
    # available between our check and the reservation insert.
    book = lock_book(book_id)
    if book is None:
        if db.session.get(Book, book_id) is None:
            return jsonify({'error': 'Book not found'}), 404
        return jsonify({'error': 'Another transaction is in progress, please try again'}), 409

    if book.available_copies > 0:
        return jsonify({'error': 'Book is available — borrow it directly'}), 400
    if Borrow.query.filter_by(user_id=session['user_id'], book_id=book_id, return_date=None).first():
        return jsonify({'error': 'You already have this book borrowed'}), 400
    if Reservation.query.filter_by(user_id=session['user_id'], book_id=book_id).first():
        return jsonify({'error': 'You already have a reservation for this book'}), 400

    reservation = Reservation(user_id=session['user_id'], book_id=book_id)
    db.session.add(reservation)
    db.session.commit()
    return jsonify(reservation.to_dict()), 201


@reservations_bp.route('/cancel-reservation/<int:reservation_id>', methods=['DELETE'])
@login_required
def cancel_reservation(reservation_id):
    reservation = db.session.get(Reservation, reservation_id)
    if not reservation or reservation.user_id != session['user_id']:
        return jsonify({'error': 'Reservation not found'}), 404

    # Lock the book row before promoting the next waiter or releasing the copy.
    book = lock_book(reservation.book_id)
    if book is None:
        return jsonify({'error': 'Another transaction is in progress, please try again'}), 409

    was_ready = reservation.status == 'ready'
    db.session.delete(reservation)
    db.session.flush()  # Remove reservation before querying for the next waiter.

    if was_ready:
        # A copy was held for this user; hand it to the next in queue or release it.
        next_pending = (Reservation.query
                        .filter_by(book_id=book.id, status='pending')
                        .order_by(Reservation.created_at)
                        .first())
        if next_pending:
            next_pending.status = 'ready'
        else:
            db.session.execute(
                sa_update(Book)
                .where(Book.id == book.id)
                .values(available_copies=Book.available_copies + 1)
                .execution_options(synchronize_session=False)
            )

    db.session.commit()
    return jsonify({'message': 'Reservation cancelled'})


@reservations_bp.route('/my-reservations')
@login_required
def my_reservations():
    reservations = Reservation.query.filter_by(user_id=session['user_id']).all()
    return jsonify([r.to_dict() for r in reservations])
