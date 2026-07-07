from datetime import datetime
from extensions import db


class Genre(db.Model):
    __table_args__ = (db.UniqueConstraint('library_id', 'name', name='uq_genre_library_name'),)

    id = db.Column(db.Integer, primary_key=True)
    library_id = db.Column(db.Integer, db.ForeignKey('library.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'name': self.name}
