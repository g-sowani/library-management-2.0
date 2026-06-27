from datetime import datetime
from extensions import db


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    borrow_id = db.Column(db.Integer, db.ForeignKey('borrow.id', ondelete='CASCADE'), nullable=False, unique=True)
    rating = db.Column(db.Integer, nullable=False)
    review_text = db.Column(db.Text, nullable=True)
    is_anonymous = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self, username=None):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'rating': self.rating,
            'review_text': self.review_text or '',
            'is_anonymous': self.is_anonymous,
            'reviewer': 'Anonymous' if self.is_anonymous else (username or 'Unknown'),
            'created_at': self.created_at.isoformat(),
        }
