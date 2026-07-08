from datetime import datetime
from extensions import db


class Borrow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    borrow_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime)
    return_date = db.Column(db.DateTime, nullable=True)
    return_requested_at = db.Column(db.DateTime, nullable=True)
    fine_payment_requested_at = db.Column(db.DateTime, nullable=True)
    fine = db.Column(db.Float, default=0.0)
    fine_paid = db.Column(db.Boolean, default=False)

    def calculate_fine(self):
        from models.setting import get_setting
        library_id = self.book.library_id if self.book else None
        fine_per_day = get_setting('fine_per_day', library_id, default=1.0, cast=float)
        if self.return_date and self.return_date > self.due_date:
            self.fine = (self.return_date - self.due_date).days * fine_per_day
        elif not self.return_date and datetime.utcnow() > self.due_date:
            self.fine = (datetime.utcnow() - self.due_date).days * fine_per_day

    def to_dict(self):
        self.calculate_fine()
        return {
            'id': self.id, 'user_id': self.user_id, 'book_id': self.book_id,
            'book_title': self.book.title, 'book_author': self.book.author,
            'username': self.user.username,
            'borrow_date': self.borrow_date.isoformat(),
            'due_date': self.due_date.isoformat(),
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'return_requested_at': self.return_requested_at.isoformat() if self.return_requested_at else None,
            'fine_payment_requested_at': (
                self.fine_payment_requested_at.isoformat() if self.fine_payment_requested_at else None
            ),
            'fine': self.fine, 'fine_paid': self.fine_paid,
            'is_overdue': not self.return_date and datetime.utcnow() > self.due_date,
        }
