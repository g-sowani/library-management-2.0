from flask import Blueprint, jsonify, session, request, g
from extensions import db
from models.membership import Membership
from models.user import User
from models.library import Library
from models.setting import get_setting
from decorators import login_required

membership_bp = Blueprint('membership', __name__, url_prefix='/api')


@membership_bp.route('/membership/pricing')
def get_public_pricing():
    """Unauthenticated pricing read — lets the registration form show real
    rates for the library the visitor is about to join/create, before an
    account (and session) exists."""
    code = (request.args.get('library_code') or '').strip().upper()
    library_id = None
    if code:
        library = Library.query.filter_by(code=code).first()
        if not library:
            return jsonify({'error': 'Library not found'}), 404
        library_id = library.id
    return jsonify({
        'silver_rate': get_setting('membership_silver_rate', library_id, default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', library_id, default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', library_id, default=29.99, cast=float),
    })


@membership_bp.route('/membership')
@login_required
def get_membership():
    membership = Membership.query.filter_by(user_id=session['user_id']).first()
    pricing = {
        'silver_rate': get_setting('membership_silver_rate', g.library_id, default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', g.library_id, default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', g.library_id, default=29.99, cast=float),
    }
    family_members = []
    if membership and membership.tier == 'family' and membership.family_group_id:
        siblings = (Membership.query
                    .join(User, Membership.user_id == User.id)
                    .filter_by(tier='family', family_group_id=membership.family_group_id)
                    .filter(Membership.user_id != session['user_id'], User.library_id == g.library_id)
                    .all())
        for s in siblings:
            u = db.session.get(User, s.user_id)
            if u:
                family_members.append(u.username)

    return jsonify({
        'membership': membership.to_dict() if membership else None,
        'pricing': pricing,
        'family_members': family_members,
    })
