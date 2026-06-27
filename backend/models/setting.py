from extensions import db


class Setting(db.Model):
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(200), nullable=False)


def get_setting(key, default=None, cast=str):
    s = db.session.get(Setting, key)
    return cast(s.value) if s else default
