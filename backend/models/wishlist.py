from datetime import datetime
from extensions import db


class Wishlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    book = db.relationship('Book', backref='wishlist_entries')
    user = db.relationship('User', backref='wishlist_entries')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'book_id', name='uq_wishlist_user_book'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'book_title': self.book.title,
            'book_author': self.book.author,
            'book_cover': self.book.cover_url,
            'book_cover_color': self.book.cover_color,
            'book_available': self.book.available_copies > 0,
            'added_at': self.added_at.isoformat(),
        }
