from functools import wraps
from flask import session, jsonify, g
from extensions import db


def _load_current_user():
    from models import User
    user = db.session.get(User, session['user_id'])
    if user:
        g.current_user = user
        g.library_id = user.library_id
    return user


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        user = _load_current_user()
        if not user:
            session.pop('user_id', None)
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        user = _load_current_user()
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated
