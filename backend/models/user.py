from extensions import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), nullable=False, default='member')
    avatar = db.Column(db.Text, nullable=True)
    borrows = db.relationship('Borrow', backref='user', lazy=True)
    membership = db.relationship('Membership', backref='user', uselist=False, lazy='joined')

    def to_dict(self):
        d = {'id': self.id, 'username': self.username, 'role': self.role, 'avatar': self.avatar}
        if self.membership:
            d['membership'] = self.membership.to_dict()
        return d
