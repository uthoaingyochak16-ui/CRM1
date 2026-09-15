from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from urllib.parse import urlparse

from ..database import get_db
from ..auth import get_current_user, require_admin
from .. import models, schemas
from .notifications import notify

router = APIRouter(prefix="/api/feed", tags=["feed"])


POST_TYPES = {"text", "link", "poll"}


def _can_post(user: models.User, project_id: Optional[str], db: Session) -> bool:
    if user.role == "admin":
        return True
    if project_id is None:
        return False
    perm = (
        db.query(models.ProjectPermission)
        .filter_by(user_id=user.id, project_id=project_id)
        .first()
    )
    return bool(perm and getattr(perm, "can_post_feed", False))


def _get_user_preference(db: Session, user_id: str, post_id: int) -> Optional[models.FeedUserPreference]:
    return (
        db.query(models.FeedUserPreference)
        .filter_by(user_id=user_id, post_id=post_id)
        .first()
    )


def _serialize_post(post: models.Post, db: Session, current_user: Optional[models.User] = None) -> dict:
    reaction_count = db.query(func.count(models.PostReaction.id)).filter_by(post_id=post.id).scalar()
    comment_count = db.query(func.count(models.PostComment.id)).filter_by(post_id=post.id).scalar()

    preference = None
    is_saved = False
    is_hidden = False
    if current_user is not None:
        preference = _get_user_preference(db, current_user.id, post.id)
        if preference is not None:
            is_saved = bool(preference.is_saved)
            is_hidden = bool(preference.is_hidden)

    poll_options = None
    if post.post_type == "poll":
        poll_options = []
        for opt in post.poll_options:
            vote_count = db.query(func.count(models.PollVote.id)).filter_by(option_id=opt.id).scalar()
            poll_options.append({"id": opt.id, "label": opt.label, "vote_count": vote_count})

    return {
        "id": post.id,
        "project_id": post.project_id,
        "author_id": post.author_id,
        "author_name": post.author.name if hasattr(post.author, "name") else post.author.username,
        "author_role": post.author.role,
        "content": post.content,
        "post_type": post.post_type,
        "is_pinned": post.is_pinned,
        "link_url": post.link_url,
        "link_title": post.link_title,
        "link_domain": post.link_domain,
        "reaction_count": reaction_count,
        "comment_count": comment_count,
        "poll_options": poll_options,
        "is_saved": is_saved,
        "is_hidden": is_hidden,
        "created_at": post.created_at,
    }


@router.get("", response_model=list[schemas.PostOut])
def list_feed(
    project_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Post)
    if project_id is not None:
        q = q.filter(models.Post.project_id == project_id)
    q = q.order_by(desc(models.Post.is_pinned), desc(models.Post.created_at))
    posts = q.offset(offset).limit(limit).all()
    visible_posts = []
    for post in posts:
        preference = _get_user_preference(db, current_user.id, post.id)
        if preference is not None and preference.is_hidden:
            continue
        visible_posts.append(_serialize_post(post, db, current_user))
    return visible_posts


@router.post("", response_model=schemas.PostOut)
def create_post(
    payload: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.post_type == "link":
        title = (payload.title or "").strip()
        description = (payload.description or payload.content or "").strip()
        if not title and not description:
            raise HTTPException(status_code=400, detail="লিংক পোস্টের জন্য title বা description দিন")
        content = description or title
    else:
        content = payload.content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="পোস্টের লেখা খালি রাখা যাবে না")
    if payload.post_type not in POST_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported post type")
    if payload.post_type == "link":
        parsed = urlparse(payload.link_url or "")
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(status_code=400, detail="সঠিক http/https link দিন")
    if payload.post_type == "poll":
        options = [item.strip() for item in (payload.poll_options or []) if item.strip()]
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="Poll-এ কমপক্ষে দুটি option দিন")
    else:
        options = []
    if not _can_post(current_user, payload.project_id, db):
        raise HTTPException(status_code=403, detail="Not permitted to post")

    post = models.Post(
        project_id=payload.project_id,
        author_id=current_user.id,
        content=content,
        post_type=payload.post_type,
        link_url=payload.link_url,
        link_title=((payload.title or "").strip() or (urlparse(payload.link_url or "").netloc if payload.link_url else None)),
        link_domain=(urlparse(payload.link_url or "").netloc if payload.link_url else None),
    )
    db.add(post)
    db.flush()  # get post.id before adding poll options

    if payload.post_type == "poll":
        for label in options:
            db.add(models.PollOption(post_id=post.id, label=label))

    db.commit()
    db.refresh(post)

    recipients = (
        db.query(models.User)
        .filter(models.User.is_active.is_(True))
        .all()
    )
    for recipient in recipients:
        notify(
            db,
            recipient.id,
            f"{current_user.name} নতুন feed post শেয়ার করেছেন",
            "feed_post_created",
            "/admin/feed",
        )
    db.commit()

    return _serialize_post(post, db, current_user)


# ── Feed Ads ──

@router.get("/ads", response_model=list[schemas.FeedAdOut])
def list_feed_ads(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ads = (
        db.query(models.FeedAd)
        .filter(models.FeedAd.is_active == True)
        .order_by(models.FeedAd.created_at.desc())
        .all()
    )
    return ads


@router.post("/ads", response_model=schemas.FeedAdOut)
def create_feed_ad(
    payload: schemas.FeedAdCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    ad = models.FeedAd(
        title=payload.title.strip(),
        description=payload.description.strip(),
        image_url=payload.image_url.strip(),
        website_url=payload.website_url.strip(),
        cta_text=payload.cta_text.strip(),
        sponsor_name=payload.sponsor_name.strip(),
        placement=payload.placement,
        after_posts=payload.after_posts,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(ad)
    db.commit()
    db.refresh(ad)
    return ad


@router.patch("/ads/{ad_id}", response_model=schemas.FeedAdOut)
def update_feed_ad(
    ad_id: int,
    payload: schemas.FeedAdUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    ad = db.query(models.FeedAd).filter_by(id=ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")

    if payload.title is not None:
        ad.title = payload.title.strip()
    if payload.description is not None:
        ad.description = payload.description.strip()
    if payload.image_url is not None:
        ad.image_url = payload.image_url.strip()
    if payload.website_url is not None:
        ad.website_url = payload.website_url.strip()
    if payload.cta_text is not None:
        ad.cta_text = payload.cta_text.strip()
    if payload.sponsor_name is not None:
        ad.sponsor_name = payload.sponsor_name.strip()
    if payload.placement is not None:
        if payload.placement not in {"first", "after", "banner"}:
            raise HTTPException(status_code=400, detail="placement must be 'first', 'after', or 'banner'")
        ad.placement = payload.placement
        if payload.placement == "banner":
            ad.after_posts = None
    if payload.after_posts is not None:
        ad.after_posts = payload.after_posts
    if payload.is_active is not None:
        ad.is_active = payload.is_active

    db.commit()
    db.refresh(ad)
    return ad


@router.delete("/ads/{ad_id}")
def delete_feed_ad(
    ad_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    ad = db.query(models.FeedAd).filter_by(id=ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    db.delete(ad)
    db.commit()
    return {"ok": True}


@router.patch("/{post_id}")
def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if current_user.role != "admin" and post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")

    if payload.content is not None:
        post.content = payload.content.strip() or post.content
    if payload.title is not None:
        post.link_title = payload.title.strip() or None
    if payload.description is not None:
        post.content = payload.description.strip() or post.content
    if payload.link_url is not None:
        post.link_url = payload.link_url.strip() or None
        post.link_domain = (urlparse(post.link_url or "").netloc if post.link_url else None)
    if payload.post_type is not None:
        post.post_type = payload.post_type
    db.commit()
    db.refresh(post)
    return _serialize_post(post, db, current_user)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if current_user.role != "admin" and post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")
    db.delete(post)
    db.commit()
    return {"ok": True}


@router.post("/{post_id}/save")
def save_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    preference = _get_user_preference(db, current_user.id, post_id)
    if preference is None:
        preference = models.FeedUserPreference(user_id=current_user.id, post_id=post_id)
        db.add(preference)
    preference.is_saved = not preference.is_saved
    db.commit()
    return {"saved": preference.is_saved}


@router.post("/{post_id}/hide")
def hide_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    preference = _get_user_preference(db, current_user.id, post_id)
    if preference is None:
        preference = models.FeedUserPreference(user_id=current_user.id, post_id=post_id)
        db.add(preference)
    preference.is_hidden = not preference.is_hidden
    db.commit()
    return {"hidden": preference.is_hidden}


@router.post("/{post_id}/react")
def react_to_post(
    post_id: int,
    reaction_type: str = "like",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.PostReaction)
        .filter_by(post_id=post_id, user_id=current_user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"reacted": False}

    db.add(models.PostReaction(post_id=post_id, user_id=current_user.id, reaction_type=reaction_type))
    db.commit()
    return {"reacted": True}


@router.get("/{post_id}/comments", response_model=list[schemas.PostCommentOut])
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comments = (
        db.query(models.PostComment)
        .filter_by(post_id=post_id)
        .order_by(models.PostComment.created_at)
        .all()
    )
    return [
        {
            "id": c.id,
            "author_id": c.author_id,
            "author_name": c.author.name if hasattr(c.author, "name") else c.author.username,
            "content": c.content,
            "created_at": c.created_at,
        }
        for c in comments
    ]


@router.post("/{post_id}/comments", response_model=schemas.PostCommentOut)
def add_comment(
    post_id: int,
    payload: schemas.PostCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = models.PostComment(post_id=post_id, author_id=current_user.id, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "author_id": comment.author_id,
        "author_name": current_user.name if hasattr(current_user, "name") else current_user.username,
        "content": comment.content,
        "created_at": comment.created_at,
    }


@router.post("/poll-options/{option_id}/vote")
def vote_poll(
    option_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    option = db.query(models.PollOption).filter_by(id=option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    # remove any previous vote by this user on the same post's options
    sibling_ids = [o.id for o in option.post.poll_options]
    db.query(models.PollVote).filter(
        models.PollVote.user_id == current_user.id,
        models.PollVote.option_id.in_(sibling_ids),
    ).delete(synchronize_session=False)

    db.add(models.PollVote(option_id=option_id, user_id=current_user.id))
    db.commit()
    return {"ok": True}


@router.patch("/{post_id}/pin")
def toggle_pin(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    post = db.query(models.Post).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_pinned = not post.is_pinned
    db.commit()
    return {"is_pinned": post.is_pinned}
