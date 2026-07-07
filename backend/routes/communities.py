from datetime import datetime
from flask import Blueprint, request, jsonify, session, g
from extensions import db
from models import User
from models.membership import Membership
from models.community import (Community, CommunityMembership, CommunityPost,
                               CommunityComment, PostReaction, CommentReaction,
                               VALID_REACTIONS)
from decorators import admin_required

communities_bp = Blueprint('communities', __name__)


def _gold_user():
    if 'user_id' not in session:
        return None, (jsonify({'error': 'Login required'}), 401)
    user = db.session.get(User, session['user_id'])
    if not user:
        return None, (jsonify({'error': 'Login required'}), 401)
    mem = Membership.query.filter_by(user_id=user.id).first()
    if not mem or mem.tier != 'gold':
        return None, (jsonify({'error': 'Gold membership required'}), 403)
    return user, None


def _community_for_member(cid, user):
    community = db.session.get(Community, cid)
    if not community or community.status != 'approved' or community.library_id != user.library_id:
        return None, (jsonify({'error': 'Community not found'}), 404)
    membership = CommunityMembership.query.filter_by(
        community_id=cid, user_id=user.id
    ).first()
    if not membership:
        return None, (jsonify({'error': 'You must join this community first'}), 403)
    return community, None


# ── Community listing & creation ──────────────────────────────────────────────

@communities_bp.get('/api/communities')
def list_communities():
    user, err = _gold_user()
    if err:
        return err
    communities = (Community.query
                   .filter_by(status='approved', library_id=user.library_id)
                   .order_by(Community.created_at.desc())
                   .all())
    return jsonify([c.to_dict(user.id) for c in communities])


@communities_bp.post('/api/communities')
def create_community():
    user, err = _gold_user()
    if err:
        return err
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip() or None
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if Community.query.filter(
        Community.library_id == user.library_id, db.func.lower(Community.name) == name.lower()
    ).first():
        return jsonify({'error': 'A community with this name already exists'}), 400
    community = Community(name=name, description=description, creator_id=user.id, library_id=user.library_id)
    db.session.add(community)
    db.session.commit()
    return jsonify(community.to_dict(user.id)), 201


@communities_bp.get('/api/my-communities')
def my_communities():
    user, err = _gold_user()
    if err:
        return err
    created = Community.query.filter_by(creator_id=user.id).all()
    joined_ids = {
        m.community_id
        for m in CommunityMembership.query.filter_by(user_id=user.id).all()
    }
    created_ids = {c.id for c in created}
    all_ids = joined_ids | created_ids
    if not all_ids:
        return jsonify([])
    communities = Community.query.filter(Community.id.in_(all_ids)).all()
    return jsonify([c.to_dict(user.id) for c in communities])


# ── Join / Leave ──────────────────────────────────────────────────────────────

@communities_bp.post('/api/communities/<int:cid>/join')
def join_community(cid):
    user, err = _gold_user()
    if err:
        return err
    community = db.session.get(Community, cid)
    if not community or community.status != 'approved' or community.library_id != user.library_id:
        return jsonify({'error': 'Community not found'}), 404
    if CommunityMembership.query.filter_by(community_id=cid, user_id=user.id).first():
        return jsonify({'error': 'Already a member'}), 400
    db.session.add(CommunityMembership(community_id=cid, user_id=user.id))
    db.session.commit()
    db.session.refresh(community)
    return jsonify(community.to_dict(user.id))


@communities_bp.delete('/api/communities/<int:cid>/leave')
def leave_community(cid):
    user, err = _gold_user()
    if err:
        return err
    membership = CommunityMembership.query.filter_by(
        community_id=cid, user_id=user.id
    ).first()
    if not membership:
        return jsonify({'error': 'Not a member'}), 400
    db.session.delete(membership)
    db.session.commit()
    return jsonify({'ok': True})


# ── Posts ─────────────────────────────────────────────────────────────────────

@communities_bp.get('/api/communities/<int:cid>/posts')
def list_posts(cid):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    posts = (CommunityPost.query
             .filter_by(community_id=cid)
             .order_by(CommunityPost.created_at.desc())
             .all())
    return jsonify([p.to_dict(user.id) for p in posts])


@communities_bp.post('/api/communities/<int:cid>/posts')
def create_post(cid):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    post = CommunityPost(community_id=cid, author_id=user.id, title=title, content=content)
    db.session.add(post)
    db.session.commit()
    return jsonify(post.to_dict(user.id)), 201


@communities_bp.get('/api/communities/<int:cid>/posts/<int:pid>')
def get_post(cid, pid):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    post = CommunityPost.query.filter_by(id=pid, community_id=cid).first()
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    top_comments = (CommunityComment.query
                    .filter_by(post_id=pid, parent_id=None)
                    .order_by(CommunityComment.created_at)
                    .all())
    return jsonify({
        **post.to_dict(user.id),
        'comments': [c.to_dict(user.id) for c in top_comments],
    })


# ── Comments ──────────────────────────────────────────────────────────────────

@communities_bp.post('/api/communities/<int:cid>/posts/<int:pid>/comments')
def add_comment(cid, pid):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    post = CommunityPost.query.filter_by(id=pid, community_id=cid).first()
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    parent_id = data.get('parent_id')
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    if parent_id:
        parent = db.session.get(CommunityComment, int(parent_id))
        if not parent or parent.post_id != pid:
            return jsonify({'error': 'Invalid parent comment'}), 400
    comment = CommunityComment(
        post_id=pid, author_id=user.id,
        parent_id=int(parent_id) if parent_id else None,
        content=content,
    )
    db.session.add(comment)
    db.session.commit()
    return jsonify(comment.to_dict(user.id)), 201


# ── Reactions ─────────────────────────────────────────────────────────────────

@communities_bp.post('/api/communities/<int:cid>/posts/<int:pid>/react')
def react_post(cid, pid):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    post = CommunityPost.query.filter_by(id=pid, community_id=cid).first()
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    emoji = (request.get_json() or {}).get('emoji', '')
    if emoji not in VALID_REACTIONS:
        return jsonify({'error': 'Invalid reaction'}), 400
    existing = PostReaction.query.filter_by(post_id=pid, user_id=user.id).first()
    if existing:
        if existing.emoji == emoji:
            db.session.delete(existing)
        else:
            existing.emoji = emoji
    else:
        db.session.add(PostReaction(post_id=pid, user_id=user.id, emoji=emoji))
    db.session.commit()
    db.session.refresh(post)
    return jsonify(post.reaction_summary(user.id))


@communities_bp.post('/api/communities/<int:cid>/posts/<int:pid>/comments/<int:comment_id>/react')
def react_comment(cid, pid, comment_id):
    user, err = _gold_user()
    if err:
        return err
    _, err = _community_for_member(cid, user)
    if err:
        return err
    comment = db.session.get(CommunityComment, comment_id)
    if not comment or comment.post_id != pid:
        return jsonify({'error': 'Comment not found'}), 404
    emoji = (request.get_json() or {}).get('emoji', '')
    if emoji not in VALID_REACTIONS:
        return jsonify({'error': 'Invalid reaction'}), 400
    existing = CommentReaction.query.filter_by(comment_id=comment_id, user_id=user.id).first()
    if existing:
        if existing.emoji == emoji:
            db.session.delete(existing)
        else:
            existing.emoji = emoji
    else:
        db.session.add(CommentReaction(comment_id=comment_id, user_id=user.id, emoji=emoji))
    db.session.commit()
    db.session.refresh(comment)
    return jsonify(comment.reaction_summary(user.id))


# ── Activity count (for badge) ────────────────────────────────────────────────

@communities_bp.get('/api/communities/activity-count')
def activity_count():
    user, err = _gold_user()
    if err:
        return err
    since_str = request.args.get('since', '')
    try:
        since = datetime.fromisoformat(since_str) if since_str else datetime.min
    except ValueError:
        since = datetime.min

    member_ids = [
        m.community_id
        for m in CommunityMembership.query.filter_by(user_id=user.id).all()
    ]
    if not member_ids:
        return jsonify({'count': 0})

    new_posts = (CommunityPost.query
                 .filter(CommunityPost.community_id.in_(member_ids))
                 .filter(CommunityPost.created_at > since)
                 .filter(CommunityPost.author_id != user.id)
                 .count())

    post_ids = [
        p.id for p in CommunityPost.query
        .filter(CommunityPost.community_id.in_(member_ids))
        .with_entities(CommunityPost.id)
        .all()
    ]
    new_comments = 0
    if post_ids:
        new_comments = (CommunityComment.query
                        .filter(CommunityComment.post_id.in_(post_ids))
                        .filter(CommunityComment.created_at > since)
                        .filter(CommunityComment.author_id != user.id)
                        .count())

    new_post_reactions = 0
    new_comment_reactions = 0
    if post_ids:
        new_post_reactions = (PostReaction.query
                              .filter(PostReaction.post_id.in_(post_ids))
                              .filter(PostReaction.created_at > since)
                              .filter(PostReaction.user_id != user.id)
                              .count())
        comment_ids = [
            c.id for c in CommunityComment.query
            .filter(CommunityComment.post_id.in_(post_ids))
            .with_entities(CommunityComment.id)
            .all()
        ]
        if comment_ids:
            new_comment_reactions = (CommentReaction.query
                                     .filter(CommentReaction.comment_id.in_(comment_ids))
                                     .filter(CommentReaction.created_at > since)
                                     .filter(CommentReaction.user_id != user.id)
                                     .count())

    total = new_posts + new_comments + new_post_reactions + new_comment_reactions
    return jsonify({'count': total})


# ── Admin ─────────────────────────────────────────────────────────────────────

@communities_bp.get('/api/admin/communities')
@admin_required
def admin_list_communities():
    status_filter = request.args.get('status')
    q = Community.query.filter_by(library_id=g.library_id)
    if status_filter:
        q = q.filter_by(status=status_filter)
    communities = q.order_by(Community.created_at.desc()).all()
    return jsonify([c.to_dict() for c in communities])


@communities_bp.put('/api/admin/communities/<int:cid>/approve')
@admin_required
def admin_approve(cid):
    community = db.session.get(Community, cid)
    if not community or community.library_id != g.library_id:
        return jsonify({'error': 'Community not found'}), 404
    if community.status == 'approved':
        return jsonify({'error': 'Already approved'}), 400
    data = request.get_json() or {}
    community.status = 'approved'
    community.admin_notes = data.get('admin_notes') or None
    existing = CommunityMembership.query.filter_by(
        community_id=cid, user_id=community.creator_id
    ).first()
    if not existing:
        db.session.add(CommunityMembership(
            community_id=cid, user_id=community.creator_id, role='moderator'
        ))
    db.session.commit()
    db.session.refresh(community)
    return jsonify(community.to_dict())


@communities_bp.put('/api/admin/communities/<int:cid>/reject')
@admin_required
def admin_reject(cid):
    community = db.session.get(Community, cid)
    if not community or community.library_id != g.library_id:
        return jsonify({'error': 'Community not found'}), 404
    data = request.get_json() or {}
    community.status = 'rejected'
    community.admin_notes = data.get('admin_notes') or None
    db.session.commit()
    return jsonify(community.to_dict())
