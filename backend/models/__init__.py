from models.user import User
from models.book import Book
from models.borrow import Borrow
from models.setting import Setting
from models.book_log import BookLog
from models.reservation import Reservation


def seed_data():
    from werkzeug.security import generate_password_hash
    from extensions import db

    if User.query.first():
        # Ensure default settings exist even on an already-seeded DB
        _seed_settings(db)
        return

    admin = User(username='admin', password_hash=generate_password_hash('admin123'), role='admin')
    member = User(username='member', password_hash=generate_password_hash('member123'), role='member')
    db.session.add_all([admin, member])

    books = [
        Book(title='The Hobbit', author='J.R.R. Tolkien', isbn='978-0547928227', total_copies=4, available_copies=4, genre='Fantasy'),
        Book(title='1984', author='George Orwell', isbn='978-0451524935', total_copies=3, available_copies=3, genre='Science Fiction'),
        Book(title='To Kill a Mockingbird', author='Harper Lee', isbn='978-0061120084', total_copies=2, available_copies=2, genre='Fiction'),
        Book(title='Pride and Prejudice', author='Jane Austen', isbn='978-0141439518', total_copies=5, available_copies=5, genre='Romance'),
        Book(title='The Great Gatsby', author='F. Scott Fitzgerald', isbn='978-0743273565', total_copies=3, available_copies=3, genre='Fiction'),
    ]
    db.session.add_all(books)
    _seed_settings(db)
    db.session.commit()


def _seed_settings(db):
    defaults = {'fine_per_day': '1.00', 'borrow_days': '14'}
    for key, value in defaults.items():
        if not db.session.get(Setting, key):
            db.session.add(Setting(key=key, value=value))
    db.session.commit()
