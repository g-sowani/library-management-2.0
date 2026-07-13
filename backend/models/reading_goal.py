from datetime import datetime
from extensions import db


class ReadingGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    period = db.Column(db.String(10), nullable=False, default='yearly')  # 'weekly' | 'monthly' | 'yearly'
    target = db.Column(db.Integer, nullable=False, default=12)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {'period': self.period, 'target': self.target}
