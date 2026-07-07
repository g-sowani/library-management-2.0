from models.library import Library
from models.user import User
from models.book import Book
from models.borrow import Borrow
from models.setting import Setting
from models.book_log import BookLog
from models.reservation import Reservation
from models.review import Review
from models.membership import Membership
from models.membership_request import MembershipRequest
from models.donation import Donation
from models.book_request import BookRequest
from models.community import (Community, CommunityMembership, CommunityPost,
                               CommunityComment, PostReaction, CommentReaction)
from models.wishlist import Wishlist
from models.genre import Genre


def seed_data():
    from werkzeug.security import generate_password_hash
    from extensions import db
    from models.library import generate_library_code

    if User.query.first():
        return

    library = Library(name='Default Library', code=generate_library_code())
    db.session.add(library)
    db.session.flush()  # assign library.id before referencing it below

    admin = User(username='admin', password_hash=generate_password_hash('admin123'),
                 role='admin', library_id=library.id)
    member = User(username='member', password_hash=generate_password_hash('member123'),
                  role='member', library_id=library.id)
    db.session.add_all([admin, member])

    books = [
        Book(title='The Hobbit', author='J.R.R. Tolkien', isbn='978-0547928227', total_copies=4, available_copies=4, genre='Fantasy', library_id=library.id),
        Book(title='1984', author='George Orwell', isbn='978-0451524935', total_copies=3, available_copies=3, genre='Science Fiction', library_id=library.id),
        Book(title='To Kill a Mockingbird', author='Harper Lee', isbn='978-0061120084', total_copies=2, available_copies=2, genre='Fiction', library_id=library.id),
        Book(title='Pride and Prejudice', author='Jane Austen', isbn='978-0141439518', total_copies=5, available_copies=5, genre='Romance', library_id=library.id),
        Book(title='The Great Gatsby', author='F. Scott Fitzgerald', isbn='978-0743273565', total_copies=3, available_copies=3, genre='Fiction', library_id=library.id),
    ]
    db.session.add_all(books)
    _seed_settings(db, library.id)
    _seed_genres(db, library.id)
    db.session.commit()
    # Real accounts pick a tier themselves via the membership-request flow —
    # random auto-assignment is only used explicitly by seed_extra.py for demo data.


def _seed_settings(db, library_id):
    defaults = {
        'fine_per_day': '1.00',
        'borrow_days': '14',
        'membership_silver_rate': '9.99',
        'membership_gold_rate': '19.99',
        'membership_family_rate': '29.99',
    }
    for key, value in defaults.items():
        if not Setting.query.filter_by(library_id=library_id, key=key).first():
            db.session.add(Setting(library_id=library_id, key=key, value=value))
    db.session.commit()


def _seed_genres(db, library_id):
    defaults = [
        'Fiction', 'Fantasy', 'Mystery', 'Thriller', 'Romance',
        'Biography', 'History', 'Science', 'Horror', 'Other',
        'Nonfiction', 'Selfhelp', 'Scifi',
    ]
    for name in defaults:
        if not Genre.query.filter_by(library_id=library_id, name=name).first():
            db.session.add(Genre(library_id=library_id, name=name))
    db.session.commit()


def _seed_memberships(db, library_id=None):
    import random
    from sqlalchemy import func

    members_q = User.query.filter_by(role='member')
    if library_id is not None:
        members_q = members_q.filter_by(library_id=library_id)
    members = members_q.all()
    unassigned = [m for m in members if not Membership.query.filter_by(user_id=m.id).first()]
    if not unassigned:
        return

    random.shuffle(unassigned)
    tiers = ['silver', 'gold', 'family']

    # Scope the group-numbering search to members of the same library so
    # family group ids never collide/leak across libraries.
    group_query = (db.session.query(func.max(Membership.family_group_id))
                   .join(User, Membership.user_id == User.id))
    if library_id is not None:
        group_query = group_query.filter(User.library_id == library_id)
    max_group = group_query.scalar() or 0
    family_group_id = max_group + 1
    family_count = 0

    for user in unassigned:
        tier = random.choice(tiers)
        fgid = None
        if tier == 'family':
            fgid = family_group_id
            family_count += 1
            if family_count >= 4:
                family_group_id += 1
                family_count = 0
        db.session.add(Membership(user_id=user.id, tier=tier, family_group_id=fgid))

    db.session.commit()
