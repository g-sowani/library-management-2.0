from extensions import db


class Setting(db.Model):
    __table_args__ = (db.UniqueConstraint('library_id', 'key', name='uq_setting_library_key'),)

    id = db.Column(db.Integer, primary_key=True)
    library_id = db.Column(db.Integer, db.ForeignKey('library.id'), nullable=True)
    key = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(200), nullable=False)


def get_setting(key, library_id, default=None, cast=str):
    s = Setting.query.filter_by(library_id=library_id, key=key).first()
    return cast(s.value) if s else default


def set_setting(key, library_id, value):
    s = Setting.query.filter_by(library_id=library_id, key=key).first()
    if not s:
        s = Setting(library_id=library_id, key=key, value=value)
        db.session.add(s)
    else:
        s.value = value
    return s
