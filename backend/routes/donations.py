from datetime import datetime

from flask import Blueprint, request, jsonify, session
from extensions import db
from models import Book, BookLog, User
from models.donation import Donation
from decorators import login_required, admin_required

donations_bp = Blueprint('donations', __name__, url_prefix='/api')

CONDITIONS = ('new', 'good', 'fair', 'poor')


@donations_bp.route('/donations', methods=['POST'])
@login_required
def submit_donation():
    data = request.json or {}
    for field in ('title', 'author', 'estimated_price', 'condition'):
        if not data.get(field) and data.get(field) != 0:
            return jsonify({'error': f'{field} is required'}), 400

    if data['condition'] not in CONDITIONS:
        return jsonify({'error': 'condition must be one of: new, good, fair, poor'}), 400

    try:
        price = float(data['estimated_price'])
        if price <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'estimated_price must be a positive number'}), 400

    donation = Donation(
        user_id=session['user_id'],
        title=data['title'].strip(),
        author=data['author'].strip(),
        isbn=data.get('isbn', '').strip() or None,
        genre=data.get('genre', '').strip() or None,
        condition=data['condition'],
        estimated_price=price,
        status='pending',
        submitted_at=datetime.utcnow(),
    )
    db.session.add(donation)
    db.session.commit()
    return jsonify(donation.to_dict()), 201


@donations_bp.route('/my-donations')
@login_required
def my_donations():
    donations = (
        Donation.query
        .filter_by(user_id=session['user_id'])
        .order_by(Donation.submitted_at.desc())
        .all()
    )
    return jsonify([d.to_dict() for d in donations])


@donations_bp.route('/admin/donations')
@admin_required
def admin_donations():
    status = request.args.get('status')
    q = Donation.query.order_by(Donation.submitted_at.desc())
    if status:
        q = q.filter_by(status=status)
    return jsonify([d.to_dict() for d in q.all()])


@donations_bp.route('/admin/donations/<int:donation_id>/approve', methods=['PUT'])
@admin_required
def approve_donation(donation_id):
    donation = db.session.get(Donation, donation_id)
    if not donation:
        return jsonify({'error': 'Donation not found'}), 404
    if donation.status != 'pending':
        return jsonify({'error': 'Donation is not pending'}), 400

    data = request.json or {}
    admin = db.session.get(User, session['user_id'])

    raw_credit = data.get('credit_amount')
    if raw_credit is not None:
        try:
            credit = float(raw_credit)
            if credit < 0:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({'error': 'credit_amount must be a non-negative number'}), 400
    else:
        credit = round(donation.estimated_price / 4, 2)

    # Match by ISBN first, then fall back to case-insensitive title match.
    from sqlalchemy import func as sqlfunc
    existing = None
    if donation.isbn:
        existing = Book.query.filter_by(isbn=donation.isbn).first()
    if not existing:
        existing = Book.query.filter(sqlfunc.lower(Book.title) == donation.title.lower()).first()
    if existing:
        existing.total_copies += 1
        existing.available_copies += 1
        book = existing
        db.session.add(BookLog(
            book_id=book.id,
            action='Copies Added',
            details=f'Added 1 copy via donation from {donation.user.username} (condition: {donation.condition})',
            admin_username=admin.username,
        ))
    else:
        isbn = donation.isbn or f'DONATED-{donation_id}'
        book = Book(
            title=donation.title,
            author=donation.author,
            isbn=isbn,
            total_copies=1,
            available_copies=1,
            genre=donation.genre or '',
        )
        db.session.add(book)
        db.session.flush()
        db.session.add(BookLog(
            book_id=book.id,
            action='Book Added',
            details=f'Added via donation from {donation.user.username} (condition: {donation.condition})',
            admin_username=admin.username,
        ))

    donation.status = 'approved'
    donation.credit_amount = credit
    donation.admin_notes = (data.get('admin_notes') or '').strip() or None
    donation.reviewed_at = datetime.utcnow()
    donation.book_id = book.id

    db.session.commit()
    return jsonify(donation.to_dict())


@donations_bp.route('/admin/donations/<int:donation_id>/reject', methods=['PUT'])
@admin_required
def reject_donation(donation_id):
    donation = db.session.get(Donation, donation_id)
    if not donation:
        return jsonify({'error': 'Donation not found'}), 404
    if donation.status != 'pending':
        return jsonify({'error': 'Donation is not pending'}), 400

    data = request.json or {}
    donation.status = 'rejected'
    donation.admin_notes = (data.get('admin_notes') or '').strip() or None
    donation.reviewed_at = datetime.utcnow()

    db.session.commit()
    return jsonify(donation.to_dict())
