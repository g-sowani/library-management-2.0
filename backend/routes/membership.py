from flask import Blueprint, jsonify, session
from extensions import db
from models.membership import Membership
from models.user import User
from models.setting import get_setting
from decorators import login_required

membership_bp = Blueprint('membership', __name__, url_prefix='/api')


@membership_bp.route('/membership/pricing')
def get_public_pricing():
    """Unauthenticated pricing read — lets the registration form show real
    rates before an account (and session) exists."""
    return jsonify({
        'silver_rate': get_setting('membership_silver_rate', default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', default=29.99, cast=float),
    })


@membership_bp.route('/membership')
@login_required
def get_membership():
    membership = Membership.query.filter_by(user_id=session['user_id']).first()
    pricing = {
        'silver_rate': get_setting('membership_silver_rate', default=9.99, cast=float),
        'gold_rate': get_setting('membership_gold_rate', default=19.99, cast=float),
        'family_rate': get_setting('membership_family_rate', default=29.99, cast=float),
    }
    family_members = []
    if membership and membership.tier == 'family' and membership.family_group_id:
        siblings = (Membership.query
                    .filter_by(tier='family', family_group_id=membership.family_group_id)
                    .filter(Membership.user_id != session['user_id'])
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
