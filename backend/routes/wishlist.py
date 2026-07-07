from flask import Blueprint, jsonify, session, g
from extensions import db
from models.wishlist import Wishlist
from models.book import Book
from decorators import login_required

wishlist_bp = Blueprint('wishlist', __name__)


@wishlist_bp.get('/api/my-wishlist')
@login_required
def get_wishlist():
    uid = session['user_id']
    items = Wishlist.query.filter_by(user_id=uid).order_by(Wishlist.added_at.desc()).all()
    return jsonify([i.to_dict() for i in items])


@wishlist_bp.post('/api/wishlist/<int:book_id>')
@login_required
def add_to_wishlist(book_id):
    uid = session['user_id']
    book = Book.query.get(book_id)
    if not book or book.library_id != g.library_id:
        return jsonify({'error': 'Book not found'}), 404
    existing = Wishlist.query.filter_by(user_id=uid, book_id=book_id).first()
    if existing:
        return jsonify({'error': 'Already in wishlist'}), 409
    entry = Wishlist(user_id=uid, book_id=book_id)
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@wishlist_bp.delete('/api/wishlist/<int:book_id>')
@login_required
def remove_from_wishlist(book_id):
    uid = session['user_id']
    entry = Wishlist.query.filter_by(user_id=uid, book_id=book_id).first()
    if not entry:
        return jsonify({'error': 'Not in wishlist'}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'ok': True})
