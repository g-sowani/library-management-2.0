from flask import Blueprint, request, jsonify, session
from extensions import db
from models import User
from models.membership import Membership

games_bp = Blueprint('games', __name__)

# Generous ceiling on a single award so a single request can't inflate XP arbitrarily;
# the highest legitimate single-game award (a first-guess Wordle win) is well under this.
MAX_XP_PER_AWARD = 100


def _gold_user():
    if 'user_id' not in session:
        return None, (jsonify({'error': 'Login required'}), 401)
    user = db.session.get(User, session['user_id'])
    if not user:
        return None, (jsonify({'error': 'Login required'}), 401)
    mem = Membership.query.filter_by(user_id=user.id).first()
    if not mem or mem.tier != 'gold':
        return None, (jsonify({'error': 'Gold membership required'}), 403)
    return user, None


@games_bp.route('/api/games/xp', methods=['POST'])
def award_xp():
    user, err = _gold_user()
    if err:
        return err
    data = request.json or {}
    amount = data.get('amount')
    if not isinstance(amount, int) or isinstance(amount, bool) or not (0 < amount <= MAX_XP_PER_AWARD):
        return jsonify({'error': 'Invalid XP amount'}), 400
    user.xp = (user.xp or 0) + amount
    db.session.commit()
    return jsonify({'xp': user.xp})
