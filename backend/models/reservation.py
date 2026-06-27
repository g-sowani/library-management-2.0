from datetime import datetime
from extensions import db


class Reservation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # 'pending' or 'ready'

    book = db.relationship('Book', backref='reservations')
    user = db.relationship('User', backref='reservations')

    def queue_position(self):
        return Reservation.query.filter(
            Reservation.book_id == self.book_id,
            Reservation.status == 'pending',
            Reservation.created_at <= self.created_at,
        ).count()

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'book_title': self.book.title,
            'book_author': self.book.author,
            'created_at': self.created_at.isoformat(),
            'status': self.status,
            'queue_position': self.queue_position() if self.status == 'pending' else None,
        }
