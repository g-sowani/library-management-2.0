from datetime import datetime
from extensions import db


class BookLog(db.Model):
    __tablename__ = 'book_log'
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    details = db.Column(db.Text, nullable=False, default='')
    admin_username = db.Column(db.String(80), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'action': self.action,
            'details': self.details,
            'admin_username': self.admin_username,
            'timestamp': self.timestamp.isoformat(),
        }
