"""One-shot script: adds 45 books + rich borrow/fine history to the existing DB."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from extensions import db
from models.user import User
from models.book import Book
from models.borrow import Borrow
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta

app = create_app()

BOOKS_TO_ADD = [
    # Fiction
    ("The Catcher in the Rye",         "J.D. Salinger",          "978-0316769174", "Fiction",        3),
    ("Of Mice and Men",                 "John Steinbeck",         "978-0140177398", "Fiction",        2),
    ("Brave New World",                 "Aldous Huxley",          "978-0060850524", "Fiction",        3),
    ("The Lord of the Flies",           "William Golding",        "978-0399501487", "Fiction",        2),
    ("Jane Eyre",                       "Charlotte Brontë",       "978-0141441146", "Fiction",        4),
    ("Wuthering Heights",               "Emily Brontë",           "978-0141439556", "Fiction",        2),
    ("Anna Karenina",                   "Leo Tolstoy",            "978-0143035008", "Fiction",        3),
    ("Crime and Punishment",            "Fyodor Dostoevsky",      "978-0143107637", "Fiction",        2),
    ("The Alchemist",                   "Paulo Coelho",           "978-0062315007", "Fiction",        5),
    # Science Fiction
    ("Dune",                            "Frank Herbert",          "978-0441013593", "Science Fiction", 4),
    ("Ender's Game",                    "Orson Scott Card",       "978-0312853235", "Science Fiction", 3),
    ("The Hitchhiker's Guide",          "Douglas Adams",          "978-0345391803", "Science Fiction", 4),
    ("Fahrenheit 451",                  "Ray Bradbury",           "978-1451673319", "Science Fiction", 3),
    ("Neuromancer",                     "William Gibson",         "978-0441569595", "Science Fiction", 2),
    ("The Martian",                     "Andy Weir",              "978-0553418026", "Science Fiction", 3),
    ("Project Hail Mary",               "Andy Weir",              "978-0593135204", "Science Fiction", 3),
    # Fantasy
    ("The Name of the Wind",            "Patrick Rothfuss",       "978-0756404079", "Fantasy",         3),
    ("A Game of Thrones",               "George R.R. Martin",     "978-0553573404", "Fantasy",         4),
    ("The Fellowship of the Ring",      "J.R.R. Tolkien",         "978-0547928210", "Fantasy",         3),
    ("The Way of Kings",                "Brandon Sanderson",      "978-0765326355", "Fantasy",         2),
    ("American Gods",                   "Neil Gaiman",            "978-0380789030", "Fantasy",         3),
    # Mystery
    ("Gone Girl",                       "Gillian Flynn",          "978-0307588371", "Mystery",         3),
    ("The Girl with the Dragon Tattoo", "Stieg Larsson",          "978-0307949486", "Mystery",         3),
    ("And Then There Were None",        "Agatha Christie",        "978-0062073488", "Mystery",         4),
    ("In the Woods",                    "Tana French",            "978-0143113492", "Mystery",         2),
    ("Big Little Lies",                 "Liane Moriarty",         "978-0425274866", "Mystery",         3),
    # Thriller
    ("The Da Vinci Code",               "Dan Brown",              "978-0307474278", "Thriller",        4),
    ("Gone with the Wind",              "Margaret Mitchell",      "978-1451635621", "Thriller",        2),
    ("The Silence of the Lambs",        "Thomas Harris",          "978-0312924584", "Thriller",        2),
    # Biography
    ("Steve Jobs",                      "Walter Isaacson",        "978-1451648539", "Biography",       3),
    ("Educated",                        "Tara Westover",          "978-0399590504", "Biography",       4),
    ("The Diary of a Young Girl",       "Anne Frank",             "978-0553577129", "Biography",       5),
    ("Born a Crime",                    "Trevor Noah",            "978-0399588174", "Biography",       3),
    # History
    ("Sapiens",                         "Yuval Noah Harari",      "978-0062316097", "History",         5),
    ("The Guns of August",              "Barbara Tuchman",        "978-0345476098", "History",         2),
    ("A Short History of Nearly Everything","Bill Bryson",        "978-0767908184", "History",         3),
    # Science
    ("A Brief History of Time",         "Stephen Hawking",        "978-0553380163", "Science",         4),
    ("The Selfish Gene",                "Richard Dawkins",        "978-0199291151", "Science",         2),
    ("Thinking, Fast and Slow",         "Daniel Kahneman",        "978-0374533557", "Science",         3),
    # Self-Help
    ("Atomic Habits",                   "James Clear",            "978-0735211292", "Self-Help",       5),
    ("The 7 Habits of Highly Effective People","Stephen Covey",   "978-1982137274", "Self-Help",       4),
    ("Deep Work",                       "Cal Newport",            "978-1455586691", "Self-Help",       3),
    # Horror
    ("It",                              "Stephen King",           "978-1501156700", "Horror",          3),
    ("The Shining",                     "Stephen King",           "978-0307743657", "Horror",          3),
    ("Dracula",                         "Bram Stoker",            "978-0141439846", "Horror",          2),
    # Children's
    ("Harry Potter and the Sorcerer's Stone","J.K. Rowling",     "978-0439708180", "Children's",      5),
    ("Charlotte's Web",                 "E.B. White",             "978-0061124952", "Children's",      3),
]

def days_ago(n):
    return datetime.utcnow() - timedelta(days=n)

with app.app_context():
    # ── Add extra members ──────────────────────────────────────────
    extra_members = [
        ('alice',   'alice123'),
        ('bob',     'bob123'),
        ('carol',   'carol123'),
        ('dave',    'dave123'),
    ]
    added_members = []
    for uname, pwd in extra_members:
        if not User.query.filter_by(username=uname).first():
            u = User(username=uname, password_hash=generate_password_hash(pwd), role='member')
            db.session.add(u)
            added_members.append(uname)
    db.session.flush()

    # ── Add books ─────────────────────────────────────────────────
    added_books = []
    for title, author, isbn, genre, copies in BOOKS_TO_ADD:
        if not Book.query.filter_by(isbn=isbn).first():
            b = Book(title=title, author=author, isbn=isbn,
                     total_copies=copies, available_copies=copies, genre=genre)
            db.session.add(b)
            added_books.append(title)
    db.session.flush()

    # ── Build borrow history ───────────────────────────────────────
    # Fetch users and books fresh after flush
    alice = User.query.filter_by(username='alice').first()
    bob   = User.query.filter_by(username='bob').first()
    carol = User.query.filter_by(username='carol').first()
    dave  = User.query.filter_by(username='dave').first()
    seed_member = User.query.filter_by(username='member').first()

    all_books = Book.query.all()
    by_title = {b.title: b for b in all_books}

    def returned_on_time(user, book, borrow_days_ago, loan_days=14):
        """Borrow and return before due date — no fine."""
        borrow_date = days_ago(borrow_days_ago)
        due_date    = borrow_date + timedelta(days=loan_days)
        return_date = borrow_date + timedelta(days=loan_days - 3)
        rec = Borrow(user_id=user.id, book_id=book.id,
                     borrow_date=borrow_date, due_date=due_date,
                     return_date=return_date, fine=0.0, fine_paid=False)
        db.session.add(rec)

    def returned_late_paid(user, book, borrow_days_ago, overdue_days, loan_days=14):
        """Returned late — fine calculated and already paid."""
        borrow_date = days_ago(borrow_days_ago)
        due_date    = borrow_date + timedelta(days=loan_days)
        return_date = due_date + timedelta(days=overdue_days)
        fine = overdue_days * 1.0
        rec = Borrow(user_id=user.id, book_id=book.id,
                     borrow_date=borrow_date, due_date=due_date,
                     return_date=return_date, fine=fine, fine_paid=True)
        db.session.add(rec)

    def returned_late_unpaid(user, book, borrow_days_ago, overdue_days, loan_days=14):
        """Returned late — fine pending."""
        borrow_date = days_ago(borrow_days_ago)
        due_date    = borrow_date + timedelta(days=loan_days)
        return_date = due_date + timedelta(days=overdue_days)
        fine = overdue_days * 1.0
        rec = Borrow(user_id=user.id, book_id=book.id,
                     borrow_date=borrow_date, due_date=due_date,
                     return_date=return_date, fine=fine, fine_paid=False)
        db.session.add(rec)

    def currently_borrowed(user, book, borrow_days_ago, loan_days=14):
        """Active borrow — not yet returned."""
        borrow_date = days_ago(borrow_days_ago)
        due_date    = borrow_date + timedelta(days=loan_days)
        rec = Borrow(user_id=user.id, book_id=book.id,
                     borrow_date=borrow_date, due_date=due_date,
                     return_date=None, fine=0.0, fine_paid=False)
        db.session.add(rec)
        book.available_copies = max(0, book.available_copies - 1)

    def overdue_not_returned(user, book, borrow_days_ago, loan_days=7):
        """Overdue and still not returned — fine accumulating."""
        borrow_date = days_ago(borrow_days_ago)
        due_date    = borrow_date + timedelta(days=loan_days)
        overdue_days = (datetime.utcnow() - due_date).days
        fine = max(0, overdue_days) * 1.0
        rec = Borrow(user_id=user.id, book_id=book.id,
                     borrow_date=borrow_date, due_date=due_date,
                     return_date=None, fine=fine, fine_paid=False)
        db.session.add(rec)
        book.available_copies = max(0, book.available_copies - 1)

    # ── Alice: heavy reader, mix of on-time, late, active ─────────
    if alice:
        returned_on_time(alice,  by_title['Sapiens'],                90, loan_days=14)
        returned_on_time(alice,  by_title['Atomic Habits'],          75, loan_days=14)
        returned_on_time(alice,  by_title['Dune'],                   60, loan_days=14)
        returned_late_paid(alice,by_title['Gone Girl'],              55, overdue_days=5)
        returned_on_time(alice,  by_title['The Alchemist'],          45, loan_days=14)
        returned_late_paid(alice,by_title['A Brief History of Time'],40, overdue_days=8)
        returned_on_time(alice,  by_title['Educated'],               30, loan_days=14)
        returned_on_time(alice,  by_title['Steve Jobs'],             20, loan_days=14)
        currently_borrowed(alice,by_title['Project Hail Mary'],       5, loan_days=14)
        currently_borrowed(alice,by_title["Harry Potter and the Sorcerer's Stone"], 3, loan_days=14)

    # ── Bob: few borrows, has unpaid fines ────────────────────────
    if bob:
        returned_on_time(bob,        by_title['It'],                      80, loan_days=14)
        returned_late_unpaid(bob,    by_title['The Da Vinci Code'],       65, overdue_days=12)
        returned_on_time(bob,        by_title['Dracula'],                 50, loan_days=14)
        returned_late_unpaid(bob,    by_title['The Shining'],             35, overdue_days=7)
        overdue_not_returned(bob,    by_title['Neuromancer'],             25, loan_days=7)
        currently_borrowed(bob,      by_title['Fahrenheit 451'],           4, loan_days=14)

    # ── Carol: consistent borrower, no fines ─────────────────────
    if carol:
        returned_on_time(carol, by_title['Pride and Prejudice'],     100, loan_days=14)
        returned_on_time(carol, by_title['Jane Eyre'],                85, loan_days=14)
        returned_on_time(carol, by_title['Anna Karenina'],            70, loan_days=14)
        returned_on_time(carol, by_title['Wuthering Heights'],        55, loan_days=14)
        returned_on_time(carol, by_title['Crime and Punishment'],     40, loan_days=14)
        returned_on_time(carol, by_title['The Name of the Wind'],     25, loan_days=14)
        returned_on_time(carol, by_title['A Game of Thrones'],        10, loan_days=14)

    # ── Dave: occasional, one overdue pending ─────────────────────
    if dave:
        returned_on_time(dave,       by_title['Born a Crime'],            60, loan_days=14)
        returned_late_paid(dave,     by_title['Thinking, Fast and Slow'], 45, overdue_days=3)
        returned_on_time(dave,       by_title['Deep Work'],               30, loan_days=14)
        overdue_not_returned(dave,   by_title['The Girl with the Dragon Tattoo'], 20, loan_days=7)
        currently_borrowed(dave,     by_title['American Gods'],            6, loan_days=14)

    # ── Seed member: a few records ────────────────────────────────
    if seed_member:
        returned_on_time(seed_member, by_title['The Hitchhiker\'s Guide'], 50, loan_days=14)
        returned_late_paid(seed_member, by_title['Ender\'s Game'],         35, overdue_days=4)

    db.session.commit()

    # Give these demo accounts realistic membership tiers — real users pick their
    # own tier via the membership-request flow, so this random assignment is only
    # ever run explicitly here, not on every server startup.
    from models import _seed_memberships
    _seed_memberships(db)

    print(f"Added {len(added_books)} books, members: {added_members or 'already exist'}")
    print("Borrow history seeded.")
    print("\nMember summary:")
    for uname in ['alice', 'bob', 'carol', 'dave', 'member']:
        u = User.query.filter_by(username=uname).first()
        if u:
            total = len(u.borrows)
            active = sum(1 for b in u.borrows if b.return_date is None)
            fines_pending = sum(b.fine for b in u.borrows if not b.fine_paid and b.fine > 0)
            fines_paid = sum(b.fine for b in u.borrows if b.fine_paid)
            print(f"  {uname}: {total} borrows, {active} active, ${fines_pending:.2f} pending, ${fines_paid:.2f} paid")
