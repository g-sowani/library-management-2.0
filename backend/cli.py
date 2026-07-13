"""Admin CLI for managing the library straight from the database.

Registered on the Flask app's built-in CLI, so every command runs as
`flask <command>` from the backend/ directory (with FLASK_APP=app.py).
"""
import click
from datetime import datetime, timedelta

from extensions import db
from models.user import User
from models.book import Book
from models.borrow import Borrow
from models.library import Library, generate_library_code
from models.setting import get_setting
from werkzeug.security import generate_password_hash


def register_cli(app):
    for cmd in (list_books, add_book, list_users, create_user,
                list_borrows, checkout, return_book, stats, list_libraries):
        app.cli.add_command(cmd)


def _resolve_library(code):
    """Pick the library a command should operate on: the explicit --library
    code if given, otherwise the sole library if there's only one, otherwise
    fail with the list of valid codes."""
    if code:
        library = Library.query.filter_by(code=code.upper()).first()
        if not library:
            raise click.ClickException(f"No library with code '{code}'.")
        return library

    libraries = Library.query.all()
    if len(libraries) == 1:
        return libraries[0]
    if not libraries:
        raise click.ClickException("No libraries exist yet.")
    codes = ', '.join(l.code for l in libraries)
    raise click.ClickException(f"Multiple libraries exist — pass --library <code>. Options: {codes}")


library_option = click.option('--library', 'library_code', help='Library code (omit if only one library exists).')


@click.command('list-libraries')
def list_libraries():
    """List all libraries."""
    libraries = Library.query.all()
    if not libraries:
        click.echo('No libraries found.')
        return
    for lib in libraries:
        click.echo(f'[{lib.code}] {lib.name} (id={lib.id})')


@click.command('list-books')
@library_option
@click.option('--search', help='Filter by title or author (case-insensitive substring).')
def list_books(library_code, search):
    """List books in a library."""
    library = _resolve_library(library_code)
    query = Book.query.filter_by(library_id=library.id)
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(Book.title.ilike(like), Book.author.ilike(like)))
    books = query.order_by(Book.title).all()
    if not books:
        click.echo('No books found.')
        return
    for book in books:
        click.echo(f'#{book.id:<4} {book.title!r} by {book.author} '
                   f'[{book.available_copies}/{book.total_copies} available] ({book.genre or "no genre"})')


@click.command('add-book')
@library_option
@click.option('--title', required=True)
@click.option('--author', required=True)
@click.option('--isbn', required=True)
@click.option('--copies', default=1, show_default=True, type=int)
@click.option('--genre', default=None)
def add_book(library_code, title, author, isbn, copies, genre):
    """Add a new book to a library."""
    library = _resolve_library(library_code)
    if Book.query.filter_by(library_id=library.id, isbn=isbn).first():
        raise click.ClickException(f"A book with ISBN {isbn} already exists in this library.")
    book = Book(title=title, author=author, isbn=isbn, total_copies=copies,
                available_copies=copies, genre=genre, library_id=library.id)
    db.session.add(book)
    db.session.commit()
    click.echo(f'Added book #{book.id}: {title!r} by {author}.')


@click.command('list-users')
@library_option
@click.option('--role', type=click.Choice(['admin', 'member']), default=None)
def list_users(library_code, role):
    """List users in a library."""
    library = _resolve_library(library_code)
    query = User.query.filter_by(library_id=library.id)
    if role:
        query = query.filter_by(role=role)
    users = query.order_by(User.username).all()
    if not users:
        click.echo('No users found.')
        return
    for user in users:
        click.echo(f'#{user.id:<4} {user.username:<20} {user.role:<7} xp={user.xp}')


@click.command('create-user')
@library_option
@click.option('--username', required=True)
@click.option('--password', required=True)
@click.option('--email', default=None)
@click.option('--role', type=click.Choice(['admin', 'member']), default='member', show_default=True)
def create_user(library_code, username, password, email, role):
    """Create a new user in a library."""
    library = _resolve_library(library_code)
    if User.query.filter_by(username=username).first():
        raise click.ClickException(f"Username '{username}' is already taken.")
    user = User(username=username, password_hash=generate_password_hash(password),
                email=email, role=role, library_id=library.id)
    db.session.add(user)
    db.session.commit()
    click.echo(f'Created {role} #{user.id}: {username}.')


@click.command('list-borrows')
@library_option
@click.option('--overdue', is_flag=True, help='Only show overdue, unreturned borrows.')
def list_borrows(library_code, overdue):
    """List borrow records for a library."""
    library = _resolve_library(library_code)
    query = Borrow.query.join(Book).filter(Book.library_id == library.id)
    if overdue:
        query = query.filter(Borrow.return_date.is_(None), Borrow.due_date < datetime.utcnow())
    borrows = query.order_by(Borrow.due_date).all()
    if not borrows:
        click.echo('No borrows found.')
        return
    for b in borrows:
        status = 'returned' if b.return_date else ('OVERDUE' if b.due_date < datetime.utcnow() else 'out')
        click.echo(f'#{b.id:<4} {b.user.username:<15} "{b.book.title}" '
                   f'due {b.due_date.date()} [{status}]')


@click.command('checkout')
@library_option
@click.option('--user', 'username', required=True, help='Username borrowing the book.')
@click.option('--book', 'book_id', required=True, type=int, help='Book id to borrow.')
def checkout(library_code, username, book_id):
    """Check a book out to a user."""
    library = _resolve_library(library_code)
    user = User.query.filter_by(library_id=library.id, username=username).first()
    if not user:
        raise click.ClickException(f"No user '{username}' in this library.")
    book = Book.query.filter_by(library_id=library.id, id=book_id).first()
    if not book:
        raise click.ClickException(f"No book #{book_id} in this library.")
    if book.available_copies < 1:
        raise click.ClickException(f"'{book.title}' has no available copies.")

    borrow_days = get_setting('borrow_days', library.id, default=14, cast=int)
    borrow = Borrow(user_id=user.id, book_id=book.id,
                     due_date=datetime.utcnow() + timedelta(days=borrow_days))
    book.available_copies -= 1
    db.session.add(borrow)
    db.session.commit()
    click.echo(f'Checked out "{book.title}" to {username} (borrow #{borrow.id}, due {borrow.due_date.date()}).')


@click.command('return-book')
@click.option('--borrow-id', required=True, type=int)
def return_book(borrow_id):
    """Mark a borrow as returned and settle its fine."""
    borrow = Borrow.query.get(borrow_id)
    if not borrow:
        raise click.ClickException(f"No borrow #{borrow_id}.")
    if borrow.return_date:
        raise click.ClickException(f"Borrow #{borrow_id} was already returned.")
    borrow.return_date = datetime.utcnow()
    borrow.calculate_fine()
    borrow.book.available_copies += 1
    db.session.commit()
    fine_note = f' (fine: ${borrow.fine:.2f})' if borrow.fine else ''
    click.echo(f'Returned "{borrow.book.title}" from {borrow.user.username}.{fine_note}')


@click.command('stats')
@library_option
def stats(library_code):
    """Show summary counts for a library."""
    library = _resolve_library(library_code)
    book_count = Book.query.filter_by(library_id=library.id).count()
    user_count = User.query.filter_by(library_id=library.id).count()
    active_borrows = Borrow.query.join(Book).filter(
        Book.library_id == library.id, Borrow.return_date.is_(None)).count()
    overdue = Borrow.query.join(Book).filter(
        Book.library_id == library.id, Borrow.return_date.is_(None),
        Borrow.due_date < datetime.utcnow()).count()

    click.echo(f'Library: {library.name} [{library.code}]')
    click.echo(f'  Books:           {book_count}')
    click.echo(f'  Users:           {user_count}')
    click.echo(f'  Active borrows:  {active_borrows}')
    click.echo(f'  Overdue:         {overdue}')
