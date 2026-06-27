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
    cols = [c['name'] for c in inspect(db.engine).get_columns('book')]
    if 'genre' not in cols:
        db.session.execute(text('ALTER TABLE book ADD COLUMN genre VARCHAR(100)'))
        db.session.commit()


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5027)
