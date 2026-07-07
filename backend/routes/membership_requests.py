from datetime import datetime

from flask import Blueprint, request, jsonify, session, g
from extensions import db
from models.membership_request import MembershipRequest
from models.user import User
from decorators import login_required, admin_required
from routes.admin import apply_tier

membership_requests_bp = Blueprint('membership_requests', __name__, url_prefix='/api')

TIERS = ('silver', 'gold', 'family')


@membership_requests_bp.route('/membership-requests', methods=['POST'])
@login_required
def submit_membership_request():
    data = request.json or {}
    tier = data.get('tier')
    if tier not in TIERS:
        return jsonify({'error': 'tier must be one of: silver, gold, family'}), 400

    existing_pending = MembershipRequest.query.filter_by(
        user_id=session['user_id'], status='pending'
    ).first()
    if existing_pending:
        return jsonify({'error': 'You already have a pending membership request'}), 400

    req = MembershipRequest(
        user_id=session['user_id'],
        requested_tier=tier,
        notes=(data.get('notes') or '').strip() or None,
        status='pending',
        submitted_at=datetime.utcnow(),
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@membership_requests_bp.route('/my-membership-requests')
@login_required
def my_membership_requests():
    requests_ = (
        MembershipRequest.query
        .filter_by(user_id=session['user_id'])
        .order_by(MembershipRequest.submitted_at.desc())
        .all()
    )
    return jsonify([r.to_dict() for r in requests_])


@membership_requests_bp.route('/admin/membership-requests')
@admin_required
def admin_membership_requests():
    status = request.args.get('status')
    q = (MembershipRequest.query
         .join(User, MembershipRequest.user_id == User.id)
         .filter(User.library_id == g.library_id)
         .order_by(MembershipRequest.submitted_at.desc()))
    if status:
        q = q.filter(MembershipRequest.status == status)
    return jsonify([r.to_dict() for r in q.all()])


@membership_requests_bp.route('/admin/membership-requests/<int:request_id>/approve', methods=['PUT'])
@admin_required
def approve_membership_request(request_id):
    req = db.session.get(MembershipRequest, request_id)
    if not req or not req.user or req.user.library_id != g.library_id:
        return jsonify({'error': 'Membership request not found'}), 404
    if req.status != 'pending':
        return jsonify({'error': 'Membership request is not pending'}), 400

    data = request.json or {}
    apply_tier(req.user_id, req.requested_tier)

    req.status = 'approved'
    req.admin_notes = (data.get('admin_notes') or '').strip() or None
    req.reviewed_at = datetime.utcnow()
    db.session.commit()
    return jsonify(req.to_dict())


@membership_requests_bp.route('/admin/membership-requests/<int:request_id>/reject', methods=['PUT'])
@admin_required
def reject_membership_request(request_id):
    req = db.session.get(MembershipRequest, request_id)
    if not req or not req.user or req.user.library_id != g.library_id:
        return jsonify({'error': 'Membership request not found'}), 404
    if req.status != 'pending':
        return jsonify({'error': 'Membership request is not pending'}), 400

    data = request.json or {}
    req.status = 'rejected'
    req.admin_notes = (data.get('admin_notes') or '').strip() or None
    req.reviewed_at = datetime.utcnow()
    db.session.commit()
    return jsonify(req.to_dict())
