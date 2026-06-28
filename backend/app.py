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

    def add_missing_cols(table, additions):
        try:
            existing = [c['name'] for c in inspect(db.engine).get_columns(table)]
        except Exception:
            return  # table doesn't exist yet — db.create_all() will handle it
        for col, col_type in additions.items():
            if col not in existing:
                db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {col_type}'))

    add_missing_cols('book', {
        'genre': 'VARCHAR(100)',
        'description': 'TEXT',
        'author_bio': 'TEXT',
        'cover_url': 'VARCHAR(500)',
    })
    add_missing_cols('post_reaction', {'created_at': 'DATETIME'})
    add_missing_cols('comment_reaction', {'created_at': 'DATETIME'})
    db.session.commit()


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5027)
