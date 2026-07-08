from extensions import db


class Book(db.Model):
    __table_args__ = (db.UniqueConstraint('library_id', 'isbn', name='uq_book_library_isbn'),)

    id = db.Column(db.Integer, primary_key=True)
    library_id = db.Column(db.Integer, db.ForeignKey('library.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=False)
    isbn = db.Column(db.String(20), nullable=False)
    total_copies = db.Column(db.Integer, nullable=False, default=1)
    available_copies = db.Column(db.Integer, nullable=False, default=1)
    genre = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    author_bio = db.Column(db.Text, nullable=True)
    cover_url = db.Column(db.Text, nullable=True)
    cover_color = db.Column(db.String(7), nullable=True)
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
            'cover_color': self.cover_color or '',
        }
