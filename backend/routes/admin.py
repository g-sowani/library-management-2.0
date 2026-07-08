from flask import Blueprint, request, jsonify, session, g
from datetime import datetime
from sqlalchemy import update as sa_update
from werkzeug.security import check_password_hash
from extensions import db
from models import Borrow, Book, Reservation
from models.user import User
from models.membership import Membership
from models.setting import get_setting, set_setting
from decorators import admin_required
from utils import lock_book

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.route('/borrows')
@admin_required
def admin_borrows():
    borrows = (Borrow.query
               .join(User, Borrow.user_id == User.id)
               .filter(Borrow.return_date.is_(None), User.library_id == g.library_id)
               .all())
    return jsonify([b.to_dict() for b in borrows])


@admin_bp.route('/fines')
@admin_required
def admin_fines():
    fines = []
    borrows = (Borrow.query
               .join(User, Borrow.user_id == User.id)
               .filter(User.library_id == g.library_id)
               .all())
    for b in borrows:
        b.calculate_fine()
        if b.fine > 0 and not b.fine_paid:
            fines.append(b.to_dict())
    db.session.commit()
    return jsonify(fines)


@admin_bp.route('/fines/history')
@admin_required
def fine_history():
    history = []
    borrows = (Borrow.query
               .join(User, Borrow.user_id == User.id)
               .filter(User.library_id == g.library_id)
               .all())
    for b in borrows:
        b.calculate_fine()
        if b.fine > 0 and b.fine_paid:
            history.append(b.to_dict())
    db.session.commit()
    history.sort(key=lambda b: b['due_date'], reverse=True)
    return jsonify(history)


@admin_bp.route('/verify-password', methods=['POST'])
@admin_required
def verify_password():
    data = request.json or {}
    password = data.get('password', '')
    user = db.session.get(User, session['user_id'])
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Incorrect password'}), 401
    return jsonify({'ok': True})


@admin_bp.route('/policy')
@admin_required
def get_policy():
    return jsonify({
        'fine_per_day': get_setting('fine_per_day', g.library_id, default=1.0, cast=float),
        'borrow_days': get_setting('borrow_days', g.library_id, default=14, cast=int),
    })


@admin_bp.route('/members')
@admin_required
def admin_members():
    members = User.query.filter_by(role='member', library_id=g.library_id).order_by(User.username).all()
    result = []
    for m in members:
        for b in m.borrows:
            b.calculate_fine()
        result.append({
            'id': m.id,
            'username': m.username,
            'currently_borrowed': sum(1 for b in m.borrows if b.return_date is None),
            'total_borrows': len(m.borrows),
            'fines_paid': sum(b.fine for b in m.borrows if b.fine_paid),
            'fines_pending': sum(b.fine for b in m.borrows if not b.fine_paid and b.fine > 0),
            'membership_tier': m.membership.tier if m.membership else None,
            'family_group_id': m.membership.family_group_id if m.membership else None,
        })
    db.session.commit()
    return jsonify(result)


@admin_bp.route('/memberships/pricing')
@admin_required
def get_membership_pricing():
    return jsonify({
        'silver_rate': get_setting('membership_silver_rate', g.library_id, default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', g.library_id, default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', g.library_id, default=29.99, cast=float),
    })


@admin_bp.route('/memberships/pricing', methods=['PUT'])
@admin_required
def update_membership_pricing():
    data = request.json
    errors = {}
    fields = {
        'silver_rate': 'membership_silver_rate',
        'gold_rate': 'membership_gold_rate',
        'family_rate': 'membership_family_rate',
    }
    for field, key in fields.items():
        if field in data:
            try:
                val = float(data[field])
                if val < 0:
                    raise ValueError
                db.session.add(set_setting(key, g.library_id, f'{val:.2f}'))
            except (ValueError, TypeError):
                errors[field] = 'Must be a non-negative number'

    if errors:
        return jsonify({'errors': errors}), 400

    db.session.commit()
    return jsonify({
        'silver_rate': get_setting('membership_silver_rate', g.library_id, default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', g.library_id, default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', g.library_id, default=29.99, cast=float),
    })


def apply_tier(user_id, tier, family_group_id=None):
    """Set (or clear, if tier is None) a user's membership tier, auto-assigning
    a family group with room when tier == 'family' and no group id is given.
    Shared by the direct admin tier-change endpoint and membership-request approval.
    """
    from sqlalchemy import func

    membership = Membership.query.filter_by(user_id=user_id).first()

    if tier is None:
        if membership:
            db.session.delete(membership)
        db.session.commit()
        return None

    if not membership:
        membership = Membership(user_id=user_id)
        db.session.add(membership)

    membership.tier = tier
    if tier == 'family':
        target_user = db.session.get(User, user_id)
        library_id = target_user.library_id if target_user else None
        # Use provided group id or auto-assign to an existing group with room,
        # scoped to this user's own library so group numbers never collide/leak
        # across libraries.
        if family_group_id:
            membership.family_group_id = int(family_group_id)
        else:
            groups = (db.session.query(Membership.family_group_id,
                                       func.count(Membership.id).label('cnt'))
                      .join(User, Membership.user_id == User.id)
                      .filter(Membership.tier == 'family',
                              Membership.family_group_id.isnot(None),
                              Membership.user_id != user_id,
                              User.library_id == library_id)
                      .group_by(Membership.family_group_id)
                      .all())
            avail = next((g_.family_group_id for g_ in groups if g_.cnt < 4), None)
            if avail:
                membership.family_group_id = avail
            else:
                max_group = (db.session.query(func.max(Membership.family_group_id))
                             .join(User, Membership.user_id == User.id)
                             .filter(User.library_id == library_id)
                             .scalar() or 0)
                membership.family_group_id = max_group + 1
    else:
        membership.family_group_id = None

    db.session.commit()
    return membership


@admin_bp.route('/members/<int:user_id>/membership', methods=['PUT'])
@admin_required
def update_member_tier(user_id):
    m = db.session.get(User, user_id)
    if not m or m.role != 'member' or m.library_id != g.library_id:
        return jsonify({'error': 'Member not found'}), 404

    data = request.json
    tier = data.get('tier')
    if tier not in ('silver', 'gold', 'family', None):
        return jsonify({'error': 'Invalid tier'}), 400

    membership = apply_tier(user_id, tier, data.get('family_group_id'))
    return jsonify({'membership': membership.to_dict() if membership else None})


@admin_bp.route('/members/<int:user_id>/borrows')
@admin_required
def admin_member_borrows(user_id):
    m = db.session.get(User, user_id)
    if not m or m.role != 'member' or m.library_id != g.library_id:
        return jsonify({'error': 'Member not found'}), 404
    for b in m.borrows:
        b.calculate_fine()
    db.session.commit()
    return jsonify([b.to_dict() for b in sorted(m.borrows, key=lambda b: b.borrow_date, reverse=True)])


@admin_bp.route('/fines/<int:borrow_id>/mark-paid', methods=['PUT'])
@admin_required
def mark_fine_paid(borrow_id):
    borrow = db.session.get(Borrow, borrow_id)
    if not borrow or not borrow.user or borrow.user.library_id != g.library_id:
        return jsonify({'error': 'Borrow not found'}), 404
    if borrow.fine <= 0:
        return jsonify({'error': 'No fine on this borrow'}), 400
    if borrow.fine_paid:
        return jsonify({'error': 'Fine already paid'}), 400
    borrow.fine_paid = True
    db.session.commit()
    return jsonify(borrow.to_dict())


@admin_bp.route('/returns/<int:borrow_id>/approve', methods=['PUT'])
@admin_required
def approve_return(borrow_id):
    borrow = db.session.get(Borrow, borrow_id)
    if not borrow or not borrow.user or borrow.user.library_id != g.library_id:
        return jsonify({'error': 'Borrow not found'}), 404
    if borrow.return_date or not borrow.return_requested_at:
        return jsonify({'error': 'No pending return request for this borrow'}), 400

    # Lock the book row so no concurrent borrow races with the
    # available_copies increment / reservation promotion below.
    book = lock_book(borrow.book_id)
    if book is None:
        return jsonify({'error': 'Another transaction is in progress, please try again'}), 409

    # Freeze the return at the moment the member requested it, so the fine
    # doesn't grow while the request sits waiting for admin approval.
    borrow.return_date = borrow.return_requested_at
    borrow.calculate_fine()

    if borrow.fine_payment_requested_at:
        borrow.fine_paid = True
        borrow.fine_payment_requested_at = None

    next_pending = (Reservation.query
                    .filter_by(book_id=borrow.book_id, status='pending')
                    .order_by(Reservation.created_at)
                    .first())
    if next_pending:
        next_pending.status = 'ready'
    else:
        db.session.execute(
            sa_update(Book)
            .where(Book.id == borrow.book_id)
            .values(available_copies=Book.available_copies + 1)
            .execution_options(synchronize_session=False)
        )

    db.session.commit()
    return jsonify(borrow.to_dict())


@admin_bp.route('/returns/<int:borrow_id>/reject', methods=['PUT'])
@admin_required
def reject_return(borrow_id):
    borrow = db.session.get(Borrow, borrow_id)
    if not borrow or not borrow.user or borrow.user.library_id != g.library_id:
        return jsonify({'error': 'Borrow not found'}), 404
    if borrow.return_date or not borrow.return_requested_at:
        return jsonify({'error': 'No pending return request for this borrow'}), 400
    borrow.return_requested_at = None
    borrow.fine_payment_requested_at = None
    db.session.commit()
    return jsonify(borrow.to_dict())


@admin_bp.route('/policy', methods=['PUT'])
@admin_required
def update_policy():
    data = request.json
    errors = {}

    if 'fine_per_day' in data:
        try:
            val = float(data['fine_per_day'])
            if val < 0:
                raise ValueError
            db.session.add(set_setting('fine_per_day', g.library_id, f'{val:.2f}'))
        except (ValueError, TypeError):
            errors['fine_per_day'] = 'Must be a non-negative number'

    if 'borrow_days' in data:
        try:
            val = int(data['borrow_days'])
            if val < 1:
                raise ValueError
            db.session.add(set_setting('borrow_days', g.library_id, str(val)))
        except (ValueError, TypeError):
            errors['borrow_days'] = 'Must be a positive integer'

    if errors:
        return jsonify({'errors': errors}), 400

    db.session.commit()
    return jsonify({
        'fine_per_day': get_setting('fine_per_day', g.library_id, default=1.0, cast=float),
        'borrow_days': get_setting('borrow_days', g.library_id, default=14, cast=int),
    })
