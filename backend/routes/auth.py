from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
from models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(
        username=data['username'],
        password_hash=generate_password_hash(data['password']),
        role=data.get('role', 'member'),
    )
    db.session.add(user)
    db.session.commit()
    session['user_id'] = user.id
    return jsonify(user.to_dict()), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    session['user_id'] = user.id
    return jsonify(user.to_dict())


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        session.pop('user_id', None)
        return jsonify({'error': 'Not logged in'}), 401
    return jsonify(user.to_dict())


@auth_bp.route('/avatar', methods=['PUT'])
def update_avatar():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json or {}
    avatar = data.get('avatar')
    if avatar and not avatar.startswith('data:image/'):
        return jsonify({'error': 'Invalid image format'}), 400
    # Rough size guard: base64 of a 2 MB image is ~2.7 MB string
    if avatar and len(avatar) > 3 * 1024 * 1024:
        return jsonify({'error': 'Image too large (max ~2 MB)'}), 400
    user.avatar = avatar  # None clears the avatar
    db.session.commit()
    return jsonify(user.to_dict())
