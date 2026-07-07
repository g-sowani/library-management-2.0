import re
from flask import Blueprint, jsonify, request, g
from extensions import db
from models.genre import Genre
from decorators import admin_required, login_required

genres_bp = Blueprint('genres', __name__)

_LETTERS_ONLY = re.compile(r'^[A-Za-z]+$')


@genres_bp.get('/api/genres')
@login_required
def list_genres():
    genres = Genre.query.filter_by(library_id=g.library_id).order_by(Genre.name).all()
    return jsonify([genre.to_dict() for genre in genres])


@genres_bp.post('/api/genres')
@admin_required
def add_genre():
    name = (request.json or {}).get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    if not _LETTERS_ONLY.match(name):
        return jsonify({'error': 'Genre must contain letters only (a–z), no spaces or special characters'}), 400

    # Normalize: first letter uppercase, rest lowercase
    normalized = name[0].upper() + name[1:].lower()

    existing = Genre.query.filter(
        Genre.library_id == g.library_id, db.func.lower(Genre.name) == normalized.lower()
    ).first()
    if existing:
        return jsonify({'error': f'"{existing.name}" already exists'}), 409

    genre = Genre(name=normalized, library_id=g.library_id)
    db.session.add(genre)
    db.session.commit()
    return jsonify(genre.to_dict()), 201
