from extensions import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), nullable=False, default='member')
    borrows = db.relationship('Borrow', backref='user', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'role': self.role}
