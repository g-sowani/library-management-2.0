from datetime import datetime
from extensions import db


class BookRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=True)
    isbn = db.Column(db.String(20), nullable=True)
    genre = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending/approved/rejected
    admin_notes = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=True)
    # False until the member has seen the approve/reject outcome banner on the Home tab
    notified = db.Column(db.Boolean, nullable=False, default=False)

    user = db.relationship('User', backref='book_requests', lazy='joined')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'title': self.title,
            'author': self.author or '',
            'isbn': self.isbn or '',
            'genre': self.genre or '',
            'notes': self.notes or '',
            'status': self.status,
            'admin_notes': self.admin_notes or '',
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'book_id': self.book_id,
            'notified': self.notified,
        }
