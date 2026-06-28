from extensions import db


class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=False)
    isbn = db.Column(db.String(20), unique=True, nullable=False)
    total_copies = db.Column(db.Integer, nullable=False, default=1)
    available_copies = db.Column(db.Integer, nullable=False, default=1)
    genre = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    author_bio = db.Column(db.Text, nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)
    borrows = db.relationship('Borrow', backref='book', lazy=True)
    logs = db.relationship('BookLog', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'author': self.author,
            'isbn': self.isbn, 'total_copies': self.total_copies,
            'available_copies': self.available_copies,
            'genre': self.genre or '',
            # None  → never scraped (frontend will trigger lazy fetch)
            # ''    → scraped, no data found (frontend skips section, won't retry)
            # text  → has real data
            'description': self.description,
            'author_bio': self.author_bio,
            'cover_url': self.cover_url or '',
        }
