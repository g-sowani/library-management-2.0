from extensions import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    library_id = db.Column(db.Integer, db.ForeignKey('library.id'), nullable=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(200), nullable=False)
    google_sub = db.Column(db.String(255), unique=True, nullable=True)
    role = db.Column(db.String(10), nullable=False, default='member')
    avatar = db.Column(db.Text, nullable=True)
    xp = db.Column(db.Integer, nullable=False, default=0)
    borrows = db.relationship('Borrow', backref='user', lazy=True)
    membership = db.relationship('Membership', backref='user', uselist=False, lazy='joined')
    library = db.relationship('Library', foreign_keys=[library_id])

    def to_dict(self):
        d = {
            'id': self.id, 'username': self.username, 'email': self.email,
            'role': self.role, 'avatar': self.avatar, 'xp': self.xp,
            'library_id': self.library_id,
            'library': self.library.to_dict() if self.library else None,
        }
        if self.membership:
            d['membership'] = self.membership.to_dict()
        return d
