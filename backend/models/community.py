from datetime import datetime
from extensions import db

VALID_REACTIONS = {'like', 'love', 'haha', 'wow', 'sad', 'angry'}


class Community(db.Model):
    __tablename__ = 'community'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending|approved|rejected
    admin_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    creator = db.relationship('User', backref='communities_created', foreign_keys=[creator_id])
    memberships = db.relationship('CommunityMembership', backref='community',
                                   cascade='all, delete-orphan', lazy='select')
    posts = db.relationship('CommunityPost', backref='community',
                             cascade='all, delete-orphan', lazy='select')

    def to_dict(self, user_id=None):
        mem = next((m for m in self.memberships if m.user_id == user_id), None) if user_id else None
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'creator_id': self.creator_id,
            'creator_username': self.creator.username if self.creator else None,
            'status': self.status,
            'admin_notes': self.admin_notes,
            'created_at': self.created_at.isoformat(),
            'member_count': len(self.memberships),
            'post_count': len(self.posts),
            'is_member': mem is not None,
            'user_role': mem.role if mem else None,
        }


class CommunityMembership(db.Model):
    __tablename__ = 'community_membership'
    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey('community.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # member|moderator
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('community_id', 'user_id', name='uq_comm_membership'),)

    user = db.relationship('User', backref='community_memberships')


class CommunityPost(db.Model):
    __tablename__ = 'community_post'
    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey('community.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship('User', backref='community_posts')
    comments = db.relationship(
        'CommunityComment',
        backref='post',
        cascade='all, delete-orphan',
        foreign_keys='[CommunityComment.post_id]',
        lazy='select',
    )
    reactions = db.relationship('PostReaction', backref='post',
                                 cascade='all, delete-orphan', lazy='select')

    def reaction_summary(self, user_id=None):
        counts = {}
        user_emoji = None
        for r in self.reactions:
            counts[r.emoji] = counts.get(r.emoji, 0) + 1
            if r.user_id == user_id:
                user_emoji = r.emoji
        return {'counts': counts, 'user_reaction': user_emoji}

    def to_dict(self, user_id=None):
        return {
            'id': self.id,
            'community_id': self.community_id,
            'author_id': self.author_id,
            'author_username': self.author.username if self.author else None,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'comment_count': len(self.comments),
            'reactions': self.reaction_summary(user_id),
        }


class CommunityComment(db.Model):
    __tablename__ = 'community_comment'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('community_post.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('community_comment.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship('User', backref='community_comments')
    replies = db.relationship(
        'CommunityComment',
        backref=db.backref('parent_comment', remote_side=[id]),
        foreign_keys=[parent_id],
        lazy='select',
        order_by=created_at,
    )
    reactions = db.relationship('CommentReaction', backref='comment',
                                 cascade='all, delete-orphan', lazy='select')

    def reaction_summary(self, user_id=None):
        counts = {}
        user_emoji = None
        for r in self.reactions:
            counts[r.emoji] = counts.get(r.emoji, 0) + 1
            if r.user_id == user_id:
                user_emoji = r.emoji
        return {'counts': counts, 'user_reaction': user_emoji}

    def to_dict(self, user_id=None):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'author_id': self.author_id,
            'author_username': self.author.username if self.author else None,
            'parent_id': self.parent_id,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'reactions': self.reaction_summary(user_id),
            'replies': [r.to_dict(user_id) for r in sorted(self.replies, key=lambda x: x.created_at)],
        }


class PostReaction(db.Model):
    __tablename__ = 'post_reaction'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('community_post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='uq_post_user_rxn'),)


class CommentReaction(db.Model):
    __tablename__ = 'comment_reaction'
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('community_comment.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('comment_id', 'user_id', name='uq_comment_user_rxn'),)
