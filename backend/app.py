import os
from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from routes import register_blueprints


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, supports_credentials=True, origins=app.config['CORS_ORIGINS'])
    db.init_app(app)
    register_blueprints(app)

    with app.app_context():
        db.create_all()
        _migrate_db()
        from models import seed_data
        seed_data()

    return app


def _migrate_db():
    from sqlalchemy import inspect, text

    def get_cols(table):
        try:
            return [c['name'] for c in inspect(db.engine).get_columns(table)]
        except Exception:
            return None  # table doesn't exist yet — db.create_all() will handle it

    def add_missing_cols(table, additions):
        existing = get_cols(table)
        if existing is None:
            return
        for col, col_type in additions.items():
            if col not in existing:
                db.session.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {col} {col_type}'))

    add_missing_cols('book', {
        'genre': 'VARCHAR(100)',
        'description': 'TEXT',
        'author_bio': 'TEXT',
        'cover_url': 'TEXT',
        'cover_color': 'VARCHAR(7)',
    })
    add_missing_cols('user', {
        'avatar': 'TEXT', 'xp': 'INTEGER DEFAULT 0', 'library_id': 'INTEGER', 'email': 'VARCHAR(120)',
        'google_sub': 'VARCHAR(255)',
    })
    add_missing_cols('post_reaction', {'created_at': 'TIMESTAMP'})
    add_missing_cols('comment_reaction', {'created_at': 'TIMESTAMP'})
    add_missing_cols('borrow', {'return_requested_at': 'TIMESTAMP'})
    db.session.execute(text(
        'CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_sub ON "user" (google_sub) WHERE google_sub IS NOT NULL'
    ))
    db.session.commit()

    _migrate_to_multi_library(get_cols)
    _migrate_username_email_split()


def _migrate_to_multi_library(get_cols):
    """One-time upgrade for pre-multi-library databases: 'book', 'genre',
    'community', and 'setting' each had a *global* unique constraint (or, for
    'setting', a bare-string primary key) that must become per-library.
    SQLite can't ALTER a constraint in place, so each table is rebuilt
    (rename -> recreate via db.create_all() -> copy rows in, backfilling
    library_id -> drop the old table). A fresh DB never hits this: db.create_all()
    already created these tables with the new schema, so `library_id` is present
    from the start and this whole function is a no-op.
    """
    from sqlalchemy import text
    from models.library import Library, generate_library_code

    # table -> comma-separated old columns to carry over as-is (library_id is added)
    rebuild_specs = {
        'book': 'id, title, author, isbn, total_copies, available_copies, '
                'genre, description, author_bio, cover_url, cover_color',
        'genre': 'id, name, created_at',
        'community': 'id, name, description, creator_id, status, admin_notes, created_at',
    }
    needs_rebuild = {t for t in rebuild_specs if get_cols(t) and 'library_id' not in get_cols(t)}
    setting_cols = get_cols('setting')
    setting_needs_rebuild = bool(setting_cols) and 'library_id' not in setting_cols
    if not needs_rebuild and not setting_needs_rebuild:
        return  # already migrated, or a brand-new DB created fresh with the current schema

    default_library = Library.query.first()
    if not default_library:
        default_library = Library(name='Default Library', code=generate_library_code())
        db.session.add(default_library)
        db.session.flush()
    default_library_id = default_library.id

    db.session.execute(text('UPDATE "user" SET library_id = :lid WHERE library_id IS NULL'),
                        {'lid': default_library_id})
    db.session.commit()

    for table in needs_rebuild:
        old = f'{table}_old'
        db.session.execute(text(f'ALTER TABLE {table} RENAME TO {old}'))
        db.session.commit()
        db.create_all()  # recreates `table` fresh with the new schema (incl. library_id)
        cols = rebuild_specs[table]
        db.session.execute(text(f'''
            INSERT INTO {table} ({cols}, library_id)
            SELECT {cols}, :lid FROM {old}
        '''), {'lid': default_library_id})
        db.session.execute(text(f'DROP TABLE {old}'))
        db.session.commit()

    if setting_needs_rebuild:
        db.session.execute(text('ALTER TABLE setting RENAME TO setting_old'))
        db.session.commit()
        db.create_all()
        db.session.execute(text('''
            INSERT INTO setting (library_id, key, value)
            SELECT :lid, key, value FROM setting_old
        '''), {'lid': default_library_id})
        db.session.execute(text('DROP TABLE setting_old'))
        db.session.commit()


def _migrate_username_email_split():
    """One-time cleanup for accounts created before 'email' existed as its own
    column, back when the username field itself was often filled in with an
    email address. For any user whose username still looks like an email and
    who has no email on file yet: move that value into the new email column
    and replace username with a clean handle derived from the address's local
    part (deduplicated against every other username). Already-clean usernames
    (e.g. 'admin', 'alice') are left untouched. Naturally idempotent — once a
    row's email is set, `email IS NULL` no longer matches it on a later run.
    """
    import re
    from sqlalchemy import text
    from models.user import User

    candidates = User.query.filter(User.email.is_(None), User.username.contains('@')).all()

    if candidates:
        taken = {u.username for u in User.query.all()}

        for user in candidates:
            email = user.username.strip().lower()
            local_part = email.split('@')[0]
            base = re.sub(r'[^a-z0-9_]', '', local_part.lower()) or 'user'

            new_username = base
            suffix = 2
            while new_username in taken:
                new_username = f'{base}_{suffix}'
                suffix += 1

            taken.add(new_username)
            user.email = email
            user.username = new_username

        db.session.commit()

    # Idempotent regardless of whether any rows needed backfilling above —
    # a fresh install with no email-shaped usernames still needs the index.
    db.session.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_email ON "user" (email)'))
    db.session.commit()


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5027)