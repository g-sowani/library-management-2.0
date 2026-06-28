from datetime import datetime
from extensions import db

TIER_LIMITS = {'silver': 1, 'gold': 3, 'family': 1}


class Membership(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    tier = db.Column(db.String(20), nullable=False)  # 'silver', 'gold', 'family'
    family_group_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def borrow_limit(self):
        return TIER_LIMITS.get(self.tier, 1)

    def to_dict(self):
        return {
            'tier': self.tier,
            'family_group_id': self.family_group_id,
            'borrow_limit': self.borrow_limit(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
