import random
import string
from datetime import datetime
from extensions import db

_CODE_ALPHABET = ''.join(c for c in string.ascii_uppercase + string.digits if c not in 'O0I1')
_CODE_LENGTH = 6


class Library(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(10), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'code': self.code}


def generate_library_code():
    while True:
        code = ''.join(random.choices(_CODE_ALPHABET, k=_CODE_LENGTH))
        if not Library.query.filter_by(code=code).first():
            return code
