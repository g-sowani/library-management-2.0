from routes.auth import auth_bp
from routes.books import books_bp
from routes.borrows import borrows_bp
from routes.admin import admin_bp
from routes.reservations import reservations_bp
from routes.membership import membership_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(books_bp)
    app.register_blueprint(borrows_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(membership_bp)
