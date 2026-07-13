from routes.auth import auth_bp, libraries_bp
from routes.books import books_bp
from routes.borrows import borrows_bp
from routes.admin import admin_bp
from routes.reservations import reservations_bp
from routes.membership import membership_bp
from routes.membership_requests import membership_requests_bp
from routes.donations import donations_bp
from routes.communities import communities_bp
from routes.wishlist import wishlist_bp
from routes.genres import genres_bp
from routes.games import games_bp
from routes.book_requests import book_requests_bp
from routes.reading_goals import reading_goals_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(libraries_bp)
    app.register_blueprint(books_bp)
    app.register_blueprint(borrows_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(membership_bp)
    app.register_blueprint(membership_requests_bp)
    app.register_blueprint(donations_bp)
    app.register_blueprint(communities_bp)
    app.register_blueprint(wishlist_bp)
    app.register_blueprint(genres_bp)
    app.register_blueprint(games_bp)
    app.register_blueprint(book_requests_bp)
    app.register_blueprint(reading_goals_bp)
