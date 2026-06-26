from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app, supports_credentials=True, origins=['http://localhost:3027'])

db = SQLAlchemy(app)

FINE_PER_DAY = 1.00
BORROW_DAYS = 14


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), nullable=False, default='member')
    borrows = db.relationship('Borrow', backref='user', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'role': self.role}


class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=False)
    isbn = db.Column(db.String(20), unique=True, nullable=False)
    total_copies = db.Column(db.Integer, nullable=False, default=1)
    available_copies = db.Column(db.Integer, nullable=False, default=1)
    borrows = db.relationship('Borrow', backref='book', lazy=True)

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'author': self.author,
            'isbn': self.isbn, 'total_copies': self.total_copies,
            'available_copies': self.available_copies,
        }


class Borrow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    borrow_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime)
    return_date = db.Column(db.DateTime, nullable=True)
    fine = db.Column(db.Float, default=0.0)
    fine_paid = db.Column(db.Boolean, default=False)

    def calculate_fine(self):
        if self.return_date and self.return_date > self.due_date:
            days_late = (self.return_date - self.due_date).days
            self.fine = days_late * FINE_PER_DAY
        elif not self.return_date and datetime.utcnow() > self.due_date:
            days_late = (datetime.utcnow() - self.due_date).days
            self.fine = days_late * FINE_PER_DAY

    def to_dict(self):
        self.calculate_fine()
        return {
            'id': self.id, 'user_id': self.user_id, 'book_id': self.book_id,
            'book_title': self.book.title, 'book_author': self.book.author,
            'username': self.user.username,
            'borrow_date': self.borrow_date.isoformat(),
            'due_date': self.due_date.isoformat(),
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'fine': self.fine, 'fine_paid': self.fine_paid,
            'is_overdue': not self.return_date and datetime.utcnow() > self.due_date,
        }


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        user = db.session.get(User, session['user_id'])
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(
        username=data['username'],
        password_hash=generate_password_hash(data['password']),
        role=data.get('role', 'member'),
    )
    db.session.add(user)
    db.session.commit()
    session['user_id'] = user.id
    return jsonify(user.to_dict()), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    session['user_id'] = user.id
    return jsonify(user.to_dict())


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out'})


@app.route('/api/auth/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = db.session.get(User, session['user_id'])
    return jsonify(user.to_dict())


@app.route('/api/books')
@login_required
def get_books():
    books = Book.query.all()
    return jsonify([b.to_dict() for b in books])


@app.route('/api/books', methods=['POST'])
@admin_required
def add_book():
    data = request.json
    if Book.query.filter_by(isbn=data['isbn']).first():
        return jsonify({'error': 'Book with this ISBN already exists'}), 400
    book = Book(
        title=data['title'], author=data['author'], isbn=data['isbn'],
        total_copies=data.get('total_copies', 1),
        available_copies=data.get('total_copies', 1),
    )
    db.session.add(book)
    db.session.commit()
    return jsonify(book.to_dict()), 201


@app.route('/api/books/<int:book_id>', methods=['DELETE'])
@admin_required
def delete_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    active = Borrow.query.filter_by(book_id=book_id, return_date=None).first()
    if active:
        return jsonify({'error': 'Book has active borrows'}), 400
    db.session.delete(book)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@app.route('/api/borrow/<int:book_id>', methods=['POST'])
@login_required
def borrow_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    if book.available_copies < 1:
        return jsonify({'error': 'No copies available'}), 400
    existing = Borrow.query.filter_by(
        user_id=session['user_id'], book_id=book_id, return_date=None
    ).first()
    if existing:
        return jsonify({'error': 'You already borrowed this book'}), 400
    borrow = Borrow(
        user_id=session['user_id'], book_id=book_id,
        due_date=datetime.utcnow() + timedelta(days=BORROW_DAYS),
    )
    book.available_copies -= 1
    db.session.add(borrow)
    db.session.commit()
    return jsonify(borrow.to_dict()), 201


@app.route('/api/return/<int:borrow_id>', methods=['POST'])
@login_required
def return_book(borrow_id):
    borrow = db.session.get(Borrow, borrow_id)
    if not borrow or borrow.user_id != session['user_id']:
        return jsonify({'error': 'Borrow record not found'}), 404
    if borrow.return_date:
        return jsonify({'error': 'Already returned'}), 400
    borrow.return_date = datetime.utcnow()
    borrow.calculate_fine()
    borrow.book.available_copies += 1
    db.session.commit()
    return jsonify(borrow.to_dict())


@app.route('/api/my-borrows')
@login_required
def my_borrows():
    borrows = Borrow.query.filter_by(user_id=session['user_id']).all()
    return jsonify([b.to_dict() for b in borrows])


@app.route('/api/my-fines')
@login_required
def my_fines():
    borrows = Borrow.query.filter_by(user_id=session['user_id']).all()
    fines = [b.to_dict() for b in borrows if b.fine > 0 or (not b.return_date and datetime.utcnow() > b.due_date)]
    return jsonify(fines)


@app.route('/api/admin/borrows')
@admin_required
def admin_borrows():
    borrows = Borrow.query.filter_by(return_date=None).all()
    return jsonify([b.to_dict() for b in borrows])


@app.route('/api/admin/fines')
@admin_required
def admin_fines():
    borrows = Borrow.query.all()
    fines = []
    for b in borrows:
        b.calculate_fine()
        if b.fine > 0 and not b.fine_paid:
            fines.append(b.to_dict())
    db.session.commit()
    return jsonify(fines)


def seed_data():
    if User.query.first():
        return
    admin = User(username='admin', password_hash=generate_password_hash('admin123'), role='admin')
    member = User(username='member', password_hash=generate_password_hash('member123'), role='member')
    db.session.add_all([admin, member])

    books = [
        Book(title='The Hobbit', author='J.R.R. Tolkien', isbn='978-0547928227', total_copies=4, available_copies=4),
        Book(title='1984', author='George Orwell', isbn='978-0451524935', total_copies=3, available_copies=3),
        Book(title='To Kill a Mockingbird', author='Harper Lee', isbn='978-0061120084', total_copies=2, available_copies=2),
        Book(title='Pride and Prejudice', author='Jane Austen', isbn='978-0141439518', total_copies=5, available_copies=5),
        Book(title='The Great Gatsby', author='F. Scott Fitzgerald', isbn='978-0743273565', total_copies=3, available_copies=3),
    ]
    db.session.add_all(books)
    db.session.commit()


with app.app_context():
    db.create_all()
    seed_data()

if __name__ == '__main__':
    app.run(debug=True, port=5027)
