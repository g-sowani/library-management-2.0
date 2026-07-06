from datetime import datetime
from extensions import db


class MembershipRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    requested_tier = db.Column(db.String(20), nullable=False)  # silver/gold/family
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending/approved/rejected
    admin_notes = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', backref='membership_requests', lazy='joined')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'requested_tier': self.requested_tier,
            'notes': self.notes or '',
            'status': self.status,
            'admin_notes': self.admin_notes or '',
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
        }
