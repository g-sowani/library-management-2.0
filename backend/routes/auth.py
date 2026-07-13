import re
import secrets
from datetime import datetime

from flask import Blueprint, request, jsonify, session, current_app
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
from models import User, _seed_settings, _seed_genres
from models.library import Library, generate_library_code, SUPPORTED_CURRENCIES
from models.membership_request import MembershipRequest
from decorators import login_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
libraries_bp = Blueprint('libraries', __name__, url_prefix='/api')

_EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _resolve_library(data, role):
    """Shared by password and Google registration: creates a new library for
    an admin choosing to start one, or looks up an existing one by join code.
    Returns (library, None) on success or (None, (message, status)) on failure.
    """
    if role == 'admin' and data.get('library_action') == 'create':
        name = (data.get('library_name') or '').strip()
        if not name:
            return None, ('Library name is required', 400)
        currency = (data.get('library_currency') or 'USD').strip().upper()
        if currency not in SUPPORTED_CURRENCIES:
            return None, ('Unsupported currency', 400)
        library = Library(name=name, code=generate_library_code(), currency=currency)
        db.session.add(library)
        db.session.flush()
        _seed_settings(db, library.id)
        _seed_genres(db, library.id)
        return library, None

    code = (data.get('library_code') or '').strip().upper()
    if not code:
        return None, ('Library code is required', 400)
    library = Library.query.filter_by(code=code).first()
    if not library:
        return None, ('Invalid library code', 400)
    return library, None


def _verify_google_credential(credential):
    """Returns (idinfo, None) on success or (None, error_message) on failure."""
    client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not client_id:
        return None, 'Google sign-in is not configured'
    try:
        idinfo = google_id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except ValueError:
        return None, 'Invalid Google credential'
    return idinfo, None


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'error': 'Username already exists'}), 400

    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({'error': 'Please enter a valid email address'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    role = data.get('role', 'member')

    library, lib_err = _resolve_library(data, role)
    if lib_err:
        message, status = lib_err
        return jsonify({'error': message}), status

    user = User(
        username=data['username'],
        email=email,
        password_hash=generate_password_hash(data['password']),
        role=role,
        library_id=library.id,
    )
    db.session.add(user)
    db.session.flush()  # assign user.id before referencing it below

    requested_tier = data.get('requested_tier')
    if role == 'member' and requested_tier in ('silver', 'gold', 'family'):
        db.session.add(MembershipRequest(
            user_id=user.id,
            requested_tier=requested_tier,
            status='pending',
            submitted_at=datetime.utcnow(),
        ))

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


@auth_bp.route('/google/config')
def google_config():
    return jsonify({'client_id': current_app.config.get('GOOGLE_CLIENT_ID') or ''})


@auth_bp.route('/google-login', methods=['POST'])
def google_login():
    data = request.json or {}
    credential = data.get('credential')
    if not credential:
        return jsonify({'error': 'Missing Google credential'}), 400

    idinfo, err = _verify_google_credential(credential)
    if err:
        return jsonify({'error': err}), 400

    email = (idinfo.get('email') or '').strip().lower()
    sub = idinfo.get('sub')
    user = User.query.filter_by(google_sub=sub).first() or User.query.filter_by(email=email).first()
    if not user:
        return jsonify({
            'error': 'No account found for this Google email. Please register first.',
            'code': 'no_account',
        }), 404

    if not user.google_sub:
        user.google_sub = sub
        db.session.commit()

    session['user_id'] = user.id
    return jsonify(user.to_dict())


@auth_bp.route('/google-register', methods=['POST'])
def google_register():
    data = request.json or {}
    credential = data.get('credential')
    if not credential:
        return jsonify({'error': 'Missing Google credential'}), 400

    idinfo, err = _verify_google_credential(credential)
    if err:
        return jsonify({'error': err}), 400

    email = (idinfo.get('email') or '').strip().lower()
    sub = idinfo.get('sub')
    if User.query.filter_by(email=email).first() or User.query.filter_by(google_sub=sub).first():
        return jsonify({'error': 'An account with this email already exists. Try signing in with Google instead.'}), 400

    username = (data.get('username') or '').strip()
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    role = data.get('role', 'member')
    library, lib_err = _resolve_library(data, role)
    if lib_err:
        message, status = lib_err
        return jsonify({'error': message}), status

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(secrets.token_hex(32)),
        role=role,
        library_id=library.id,
        google_sub=sub,
    )
    db.session.add(user)
    db.session.flush()

    requested_tier = data.get('requested_tier')
    if role == 'member' and requested_tier in ('silver', 'gold', 'family'):
        db.session.add(MembershipRequest(
            user_id=user.id,
            requested_tier=requested_tier,
            status='pending',
            submitted_at=datetime.utcnow(),
        ))

    db.session.commit()
    session['user_id'] = user.id
    return jsonify(user.to_dict()), 201


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


@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    current_password = data.get('current_password') or ''
    if not check_password_hash(user.password_hash, current_password):
        # 400, not 401: a 401 here would trip the frontend's global
        # response interceptor, which treats any 401 as "session expired"
        # and force-logs-out the (still validly logged-in) user.
        return jsonify({'error': 'Current password is incorrect'}), 400

    username = (data.get('username') or '').strip()
    if username and username != user.username:
        if User.query.filter(User.username == username, User.id != user.id).first():
            return jsonify({'error': 'Username already exists'}), 400
        user.username = username

    email = (data.get('email') or '').strip().lower()
    if email and email != user.email:
        if not _EMAIL_RE.match(email):
            return jsonify({'error': 'Please enter a valid email address'}), 400
        if User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify({'error': 'Email already registered'}), 400
        user.email = email

    new_password = data.get('new_password') or ''
    if new_password:
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
        user.password_hash = generate_password_hash(new_password)

    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.route('/onboarding', methods=['POST'])
@login_required
def complete_onboarding():
    """Saves the genres a new member picked in the onboarding quiz so
    GET /recommendations has something to work with before they've borrowed
    anything, and marks the quiz as done so it doesn't show again."""
    user = db.session.get(User, session['user_id'])
    genres = (request.json or {}).get('genres') or []
    genres = [genre.strip() for genre in genres if isinstance(genre, str) and genre.strip()][:8]
    if not genres:
        return jsonify({'error': 'Pick at least one genre'}), 400

    user.preferred_genres = ','.join(genres)
    user.onboarded = True
    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.route('/onboarding/skip', methods=['POST'])
@login_required
def skip_onboarding():
    user = db.session.get(User, session['user_id'])
    user.onboarded = True
    db.session.commit()
    return jsonify(user.to_dict())


@libraries_bp.route('/libraries')
def list_libraries():
    """Unauthenticated directory of every library — lets the registration
    form offer a searchable name/code picker instead of requiring the exact
    code to be typed blind."""
    libraries = Library.query.order_by(Library.name).all()
    return jsonify([lib.to_dict() for lib in libraries])


@libraries_bp.route('/libraries/lookup')
def lookup_library():
    code = (request.args.get('code') or '').strip().upper()
    if not code:
        return jsonify({'error': 'code is required'}), 400
    library = Library.query.filter_by(code=code).first()
    if not library:
        return jsonify({'error': 'Library not found'}), 404
    return jsonify({'id': library.id, 'name': library.name})
