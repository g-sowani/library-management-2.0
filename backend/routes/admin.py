from flask import Blueprint, request, jsonify, session
from datetime import datetime
from werkzeug.security import check_password_hash
from extensions import db
from models import Borrow
from models.user import User
from models.membership import Membership
from models.setting import Setting, get_setting
from decorators import admin_required

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.route('/borrows')
@admin_required
def admin_borrows():
    borrows = Borrow.query.filter_by(return_date=None).all()
    return jsonify([b.to_dict() for b in borrows])


@admin_bp.route('/fines')
@admin_required
def admin_fines():
    fines = []
    for b in Borrow.query.all():
        b.calculate_fine()
        if b.fine > 0 and not b.fine_paid:
            fines.append(b.to_dict())
    db.session.commit()
    return jsonify(fines)


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
        'fine_per_day': get_setting('fine_per_day', default=1.0, cast=float),
        'borrow_days': get_setting('borrow_days', default=14, cast=int),
    })


@admin_bp.route('/members')
@admin_required
def admin_members():
    members = User.query.filter_by(role='member').order_by(User.username).all()
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
        'silver_rate': get_setting('membership_silver_rate', default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', default=29.99, cast=float),
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
                s = db.session.get(Setting, key) or Setting(key=key, value='')
                s.value = f'{val:.2f}'
                db.session.add(s)
            except (ValueError, TypeError):
                errors[field] = 'Must be a non-negative number'

    if errors:
        return jsonify({'errors': errors}), 400

    db.session.commit()
    return jsonify({
        'silver_rate': get_setting('membership_silver_rate', default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', default=29.99, cast=float),
    })


@admin_bp.route('/members/<int:user_id>/membership', methods=['PUT'])
@admin_required
def update_member_tier(user_id):
    from sqlalchemy import func

    m = db.session.get(User, user_id)
    if not m or m.role != 'member':
        return jsonify({'error': 'Member not found'}), 404

    data = request.json
    tier = data.get('tier')
    if tier not in ('silver', 'gold', 'family', None):
        return jsonify({'error': 'Invalid tier'}), 400

    membership = Membership.query.filter_by(user_id=user_id).first()

    if tier is None:
        if membership:
            db.session.delete(membership)
        db.session.commit()
        return jsonify({'membership': None})

    if not membership:
        membership = Membership(user_id=user_id)
        db.session.add(membership)

    membership.tier = tier
    if tier == 'family':
        # Use provided group id or auto-assign to an existing group with room
        fgid = data.get('family_group_id')
        if fgid:
            membership.family_group_id = int(fgid)
        else:
            # Find a family group with fewer than 4 members
            from sqlalchemy import func as sqlfunc
            groups = (db.session.query(Membership.family_group_id,
                                       sqlfunc.count(Membership.id).label('cnt'))
                      .filter(Membership.tier == 'family',
                              Membership.family_group_id.isnot(None),
                              Membership.user_id != user_id)
                      .group_by(Membership.family_group_id)
                      .all())
            avail = next((g.family_group_id for g in groups if g.cnt < 4), None)
            if avail:
                membership.family_group_id = avail
            else:
                max_group = db.session.query(func.max(Membership.family_group_id)).scalar() or 0
                membership.family_group_id = max_group + 1
    else:
        membership.family_group_id = None

    db.session.commit()
    return jsonify({'membership': membership.to_dict()})


@admin_bp.route('/members/<int:user_id>/borrows')
@admin_required
def admin_member_borrows(user_id):
    m = db.session.get(User, user_id)
    if not m or m.role != 'member':
        return jsonify({'error': 'Member not found'}), 404
    for b in m.borrows:
        b.calculate_fine()
    db.session.commit()
    return jsonify([b.to_dict() for b in sorted(m.borrows, key=lambda b: b.borrow_date, reverse=True)])


@admin_bp.route('/fines/<int:borrow_id>/mark-paid', methods=['PUT'])
@admin_required
def mark_fine_paid(borrow_id):
    borrow = db.session.get(Borrow, borrow_id)
    if not borrow:
        return jsonify({'error': 'Borrow not found'}), 404
    if borrow.fine <= 0:
        return jsonify({'error': 'No fine on this borrow'}), 400
    if borrow.fine_paid:
        return jsonify({'error': 'Fine already paid'}), 400
    borrow.fine_paid = True
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
            s = db.session.get(Setting, 'fine_per_day') or Setting(key='fine_per_day', value='')
            s.value = f'{val:.2f}'
            db.session.add(s)
        except (ValueError, TypeError):
            errors['fine_per_day'] = 'Must be a non-negative number'

    if 'borrow_days' in data:
        try:
            val = int(data['borrow_days'])
            if val < 1:
                raise ValueError
            s = db.session.get(Setting, 'borrow_days') or Setting(key='borrow_days', value='')
            s.value = str(val)
            db.session.add(s)
        except (ValueError, TypeError):
            errors['borrow_days'] = 'Must be a positive integer'

    if errors:
        return jsonify({'errors': errors}), 400

    db.session.commit()
    return jsonify({
        'fine_per_day': get_setting('fine_per_day', default=1.0, cast=float),
        'borrow_days': get_setting('borrow_days', default=14, cast=int),
    })
