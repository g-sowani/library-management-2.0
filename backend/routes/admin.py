from flask import Blueprint, request, jsonify
from datetime import datetime
from extensions import db
from models import Borrow
from models.user import User
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
        })
    db.session.commit()
    return jsonify(result)


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
