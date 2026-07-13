from flask import Blueprint, jsonify, request, session
from datetime import datetime, timedelta
from extensions import db
from models import Borrow
from models.reading_goal import ReadingGoal
from decorators import login_required

reading_goals_bp = Blueprint('reading_goals', __name__, url_prefix='/api')

VALID_PERIODS = ('weekly', 'monthly', 'yearly')


def _period_start(period, now):
    if period == 'weekly':
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == 'monthly':
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)


def _books_completed_since(user_id, start):
    return Borrow.query.filter(
        Borrow.user_id == user_id,
        Borrow.is_completed.is_(True),
        Borrow.completed_at >= start,
    ).count()


@reading_goals_bp.route('/reading-goal')
@login_required
def get_reading_goal():
    now = datetime.utcnow()
    goal = ReadingGoal.query.filter_by(user_id=session['user_id']).first()
    period = goal.period if goal else 'yearly'
    progress = _books_completed_since(session['user_id'], _period_start(period, now))
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return jsonify({
        'goal': goal.to_dict() if goal else None,
        'progress': progress,
        'books_read_this_year': _books_completed_since(session['user_id'], year_start),
    })


@reading_goals_bp.route('/reading-goal', methods=['POST'])
@login_required
def set_reading_goal():
    data = request.get_json(silent=True) or {}
    period = data.get('period')
    target = data.get('target')

    if period not in VALID_PERIODS:
        return jsonify({'error': f'period must be one of {VALID_PERIODS}'}), 400
    try:
        target = int(target)
        if target < 1:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'target must be a positive integer'}), 400

    goal = ReadingGoal.query.filter_by(user_id=session['user_id']).first()
    if not goal:
        goal = ReadingGoal(user_id=session['user_id'])
        db.session.add(goal)
    goal.period = period
    goal.target = target
    db.session.commit()

    now = datetime.utcnow()
    progress = _books_completed_since(session['user_id'], _period_start(period, now))
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return jsonify({
        'goal': goal.to_dict(),
        'progress': progress,
        'books_read_this_year': _books_completed_since(session['user_id'], year_start),
    })
