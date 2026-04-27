"""Admin portal — Wellnest internal ops.

Auth: magic-link only. Admins are seeded via scripts/create_admin.py.
Flow:
    POST /admin/auth/request-link { email }  -> sends an email with a one-time URL
    GET  /admin/auth/consume?token=...       -> validates token, issues JWT, redirects to portal
    GET  /admin/me                           -> current admin info

All write endpoints append to admin_audit_logs. JWT carries scope="admin".
Admins can manage: users, counsellors, institutions, and view the audit log.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.email import send_email
from app.email_validation import is_disposable_email
from app.limiter import limiter
from app.models import (
    Admin,
    AdminAuditLog,
    AdminMagicLink,
    Counsellor,
    Institution,
    StudentProfile,
    User,
)
from app.security import create_access_token, decode_access_token, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

MAGIC_LINK_TTL_MINUTES = 15


# ============================================================================
# AUTH — magic link
# ============================================================================


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _magic_link_html(full_name: str, link: str) -> str:
    name = full_name or "admin"
    return f"""<!doctype html>
<html><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="color:#0f766e;margin:0 0 12px;font-size:22px;">Wellnest admin sign-in</h1>
  <p style="font-size:15px;line-height:1.6;">Hi {name}, click the button below to sign in to the Wellnest admin portal. The link expires in {MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.</p>
  <p style="margin:28px 0;"><a href="{link}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to admin</a></p>
  <p style="font-size:13px;color:#888;word-break:break-all;">Or paste this URL: {link}</p>
  <p style="font-size:13px;color:#888;margin-top:20px;">If you didn't request this, ignore this email. Your account is safe.</p>
</body></html>"""


class RequestLinkIn(BaseModel):
    email: EmailStr


class RequestLinkOut(BaseModel):
    message: str = "If an admin account exists, a sign-in link was sent."


@router.post("/auth/request-link", response_model=RequestLinkOut)
@limiter.limit("3/minute;10/hour")
async def request_link(
    request: Request,
    payload: RequestLinkIn,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> RequestLinkOut:
    """Issue a magic link. Always returns 200 to avoid admin enumeration."""
    email = payload.email.lower()
    logger.info("Magic link requested for email=%s", email)
    admin = (
        await db.execute(select(Admin).where(Admin.email == email, Admin.is_active.is_(True)))
    ).scalar_one_or_none()

    if admin is None:
        logger.warning("No active admin found for email=%s", email)
    else:
        raw_token = secrets.token_urlsafe(32)
        link = AdminMagicLink(
            admin_id=admin.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=MAGIC_LINK_TTL_MINUTES),
            ip_requested=request.client.host if request.client else None,
        )
        db.add(link)
        await db.commit()

        consume_url = (
            f"{settings.FRONTEND_BASE_URL}/admin/auth/callback?token={raw_token}"
        )
        logger.info("Queuing magic link email to %s (url prefix: %s)", admin.email, settings.FRONTEND_BASE_URL)
        bg.add_task(
            send_email,
            to=admin.email,
            to_name=admin.full_name,
            subject="Wellnest admin sign-in link",
            html=_magic_link_html(admin.full_name, consume_url),
        )

    return RequestLinkOut()


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str
    last_login_at: Optional[datetime] = None


class ConsumeOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


@router.post("/auth/consume", response_model=ConsumeOut)
@limiter.limit("30/minute")
async def consume_link(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> ConsumeOut:
    """Redeem a magic-link token for an admin JWT."""
    raw_token = (payload or {}).get("token") or ""
    if not raw_token or len(raw_token) < 20:
        raise HTTPException(status_code=400, detail="invalid_token")

    token_hash = _hash_token(raw_token)
    row = (
        await db.execute(
            select(AdminMagicLink, Admin)
            .join(Admin, Admin.id == AdminMagicLink.admin_id)
            .where(AdminMagicLink.token_hash == token_hash)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=400, detail="invalid_token")

    link, admin = row
    now = datetime.now(timezone.utc)
    if link.used_at is not None:
        raise HTTPException(status_code=400, detail="token_used")
    if link.expires_at < now:
        raise HTTPException(status_code=400, detail="token_expired")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="admin_inactive")

    link.used_at = now
    admin.last_login_at = now
    await db.commit()

    token = create_access_token(admin.id, extra={"scope": "admin"})
    return ConsumeOut(access_token=token, admin=AdminOut.model_validate(admin))


# ============================================================================
# DEPENDENCY — current admin
# ============================================================================


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Admin:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    token = auth.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid_token")
    if payload.get("scope") != "admin":
        raise HTTPException(status_code=403, detail="not_admin")
    try:
        admin_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="invalid_token")
    admin = (
        await db.execute(select(Admin).where(Admin.id == admin_id, Admin.is_active.is_(True)))
    ).scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=401, detail="admin_not_found")
    return admin


async def _audit(
    db: AsyncSession,
    admin: Admin,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> None:
    db.add(
        AdminAuditLog(
            admin_id=admin.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            meta=meta or {},
        )
    )


@router.get("/me", response_model=AdminOut)
async def me(admin: Admin = Depends(get_current_admin)) -> AdminOut:
    return AdminOut.model_validate(admin)


# ============================================================================
# USERS — create / list / update / disable
# ============================================================================


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    first_name: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    is_onboarded: bool
    email_verified: bool
    auth_provider: str
    created_at: datetime


class UserListOut(BaseModel):
    items: list[UserListItem]
    total: int


class UserCreateIn(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    # Admin can bypass email verification for manual provisioning (e.g. staff pilot)
    email_verified: bool = True


class UserUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    email_verified: Optional[bool] = None
    new_password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=80)


@router.get("/users", response_model=UserListOut)
async def list_users(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> UserListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = select(User).options(selectinload(User.profile))
    count_q = select(func.count()).select_from(User)
    if q:
        needle = f"%{q.lower()}%"
        base = base.where(func.lower(User.email).like(needle))
        count_q = count_q.where(func.lower(User.email).like(needle))

    total = (await db.execute(count_q)).scalar_one()
    rows = (
        await db.execute(base.order_by(User.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()

    items = [
        UserListItem(
            id=u.id,
            email=u.email,
            first_name=(u.profile.first_name if u.profile else None),
            full_name=(u.profile.full_name if u.profile else None),
            is_active=u.is_active,
            is_onboarded=u.is_onboarded,
            email_verified=u.email_verified,
            auth_provider=u.auth_provider,
            created_at=u.created_at,
        )
        for u in rows
    ]
    return UserListOut(items=items, total=total)


@router.post("/users", response_model=UserListItem, status_code=201)
async def create_user(
    payload: UserCreateIn,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> UserListItem:
    email = payload.email.lower()
    if is_disposable_email(email):
        raise HTTPException(status_code=400, detail="disposable_email_not_allowed")
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="email_already_registered")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        auth_provider="password",
        email_verified=payload.email_verified,
        is_active=True,
    )
    user.profile = StudentProfile(first_name=payload.first_name.strip())
    db.add(user)
    await _audit(
        db,
        admin,
        action="user.create",
        target_type="user",
        target_id=str(user.id),
        meta={"email": email},
    )
    await db.commit()
    await db.refresh(user, attribute_names=["profile"])

    return UserListItem(
        id=user.id,
        email=user.email,
        first_name=user.profile.first_name if user.profile else None,
        full_name=user.profile.full_name if user.profile else None,
        is_active=user.is_active,
        is_onboarded=user.is_onboarded,
        email_verified=user.email_verified,
        auth_provider=user.auth_provider,
        created_at=user.created_at,
    )


@router.patch("/users/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateIn,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> UserListItem:
    user = (
        await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")

    changes: dict = {}
    if payload.is_active is not None and payload.is_active != user.is_active:
        user.is_active = payload.is_active
        changes["is_active"] = payload.is_active
    if payload.email_verified is not None and payload.email_verified != user.email_verified:
        user.email_verified = payload.email_verified
        changes["email_verified"] = payload.email_verified
    if payload.new_password:
        user.hashed_password = hash_password(payload.new_password)
        changes["password_reset"] = True
    if payload.first_name and user.profile:
        user.profile.first_name = payload.first_name.strip()
        changes["first_name"] = payload.first_name.strip()

    if changes:
        await _audit(
            db,
            admin,
            action="user.update",
            target_type="user",
            target_id=str(user.id),
            meta=changes,
        )
    await db.commit()
    await db.refresh(user, attribute_names=["profile"])

    return UserListItem(
        id=user.id,
        email=user.email,
        first_name=user.profile.first_name if user.profile else None,
        full_name=user.profile.full_name if user.profile else None,
        is_active=user.is_active,
        is_onboarded=user.is_onboarded,
        email_verified=user.email_verified,
        auth_provider=user.auth_provider,
        created_at=user.created_at,
    )


# ============================================================================
# COUNSELLORS — approve / reject / list
# ============================================================================


class CounsellorAdminItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    email: str
    application_status: str
    verified: bool
    is_active: bool
    years_experience: Optional[int] = None
    specializations: Optional[str] = None
    credentials: Optional[str] = None
    application_notes: Optional[str] = None
    created_at: datetime


@router.get("/counsellors", response_model=list[CounsellorAdminItem])
async def list_counsellors(
    status_filter: Optional[Literal["pending", "verified", "rejected"]] = None,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[CounsellorAdminItem]:
    q = select(Counsellor).order_by(Counsellor.created_at.desc())
    if status_filter:
        q = q.where(Counsellor.application_status == status_filter)
    rows = (await db.execute(q)).scalars().all()
    return [CounsellorAdminItem.model_validate(c) for c in rows]


@router.post("/counsellors/{counsellor_id}/approve", response_model=CounsellorAdminItem)
async def approve_counsellor(
    counsellor_id: uuid.UUID,
    bg: BackgroundTasks,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> CounsellorAdminItem:
    c = (await db.execute(select(Counsellor).where(Counsellor.id == counsellor_id))).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="counsellor_not_found")

    c.verified = True
    c.application_status = "verified"
    c.is_active = True
    await _audit(
        db,
        admin,
        action="counsellor.approve",
        target_type="counsellor",
        target_id=str(c.id),
        meta={"email": c.email},
    )
    await db.commit()
    await db.refresh(c)

    from app.email import counsellor_approved_html

    bg.add_task(
        send_email,
        to=c.email,
        to_name=c.full_name,
        subject="Your Wellnest counsellor application is approved",
        html=counsellor_approved_html(c.full_name),
    )
    return CounsellorAdminItem.model_validate(c)


class RejectIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/counsellors/{counsellor_id}/reject", response_model=CounsellorAdminItem)
async def reject_counsellor(
    counsellor_id: uuid.UUID,
    payload: RejectIn,
    bg: BackgroundTasks,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> CounsellorAdminItem:
    c = (await db.execute(select(Counsellor).where(Counsellor.id == counsellor_id))).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="counsellor_not_found")

    c.verified = False
    c.application_status = "rejected"
    c.is_active = False
    await _audit(
        db,
        admin,
        action="counsellor.reject",
        target_type="counsellor",
        target_id=str(c.id),
        meta={"email": c.email, "reason": payload.reason or ""},
    )
    await db.commit()
    await db.refresh(c)

    from app.email import counsellor_rejected_html

    bg.add_task(
        send_email,
        to=c.email,
        to_name=c.full_name,
        subject="Wellnest counsellor application update",
        html=counsellor_rejected_html(c.full_name),
    )
    return CounsellorAdminItem.model_validate(c)


# ============================================================================
# INSTITUTIONS — list / create
# ============================================================================


class InstitutionAdminItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    type: str
    city: Optional[str] = None
    state: Optional[str] = None
    invite_code: str
    is_active: bool
    created_at: datetime


class InstitutionCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    type: Literal["school", "college", "university", "coaching"]
    city: Optional[str] = Field(default=None, max_length=80)
    state: Optional[str] = Field(default=None, max_length=80)
    primary_contact_name: Optional[str] = Field(default=None, max_length=150)
    primary_contact_email: Optional[EmailStr] = None


@router.get("/institutions", response_model=list[InstitutionAdminItem])
async def list_institutions(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[InstitutionAdminItem]:
    rows = (
        await db.execute(select(Institution).order_by(Institution.created_at.desc()))
    ).scalars().all()
    return [InstitutionAdminItem.model_validate(i) for i in rows]


@router.post("/institutions", response_model=InstitutionAdminItem, status_code=201)
async def create_institution(
    payload: InstitutionCreateIn,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> InstitutionAdminItem:
    existing = (
        await db.execute(select(Institution).where(Institution.slug == payload.slug))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="slug_taken")

    invite_code = secrets.token_urlsafe(8)[:12].upper().replace("_", "X").replace("-", "Y")
    inst = Institution(
        name=payload.name.strip(),
        slug=payload.slug,
        type=payload.type,
        city=payload.city,
        state=payload.state,
        primary_contact_name=payload.primary_contact_name,
        primary_contact_email=(payload.primary_contact_email or None),
        invite_code=invite_code,
        is_active=True,
    )
    db.add(inst)
    await _audit(
        db,
        admin,
        action="institution.create",
        target_type="institution",
        target_id=str(inst.id),
        meta={"slug": inst.slug},
    )
    await db.commit()
    await db.refresh(inst)
    return InstitutionAdminItem.model_validate(inst)


# ============================================================================
# AUDIT LOG
# ============================================================================


class AuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    admin_id: Optional[uuid.UUID]
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    meta: dict
    created_at: datetime


@router.get("/audit-log", response_model=list[AuditLogItem])
async def list_audit(
    limit: int = 100,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogItem]:
    limit = max(1, min(limit, 500))
    rows = (
        await db.execute(
            select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)
        )
    ).scalars().all()
    return [AuditLogItem.model_validate(r) for r in rows]


# ============================================================================
# STATS — dashboard home
# ============================================================================


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    onboarded_users: int
    total_counsellors: int
    pending_counsellors: int
    verified_counsellors: int
    total_institutions: int


@router.get("/stats", response_model=AdminStats)
async def stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStats:
    async def scalar(q):
        return (await db.execute(q)).scalar_one()

    total_users = await scalar(select(func.count()).select_from(User))
    active_users = await scalar(
        select(func.count()).select_from(User).where(User.is_active.is_(True))
    )
    onboarded_users = await scalar(
        select(func.count()).select_from(User).where(User.is_onboarded.is_(True))
    )
    total_counsellors = await scalar(select(func.count()).select_from(Counsellor))
    pending_counsellors = await scalar(
        select(func.count()).select_from(Counsellor).where(
            Counsellor.application_status == "pending"
        )
    )
    verified_counsellors = await scalar(
        select(func.count()).select_from(Counsellor).where(Counsellor.verified.is_(True))
    )
    total_institutions = await scalar(select(func.count()).select_from(Institution))

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        onboarded_users=onboarded_users,
        total_counsellors=total_counsellors,
        pending_counsellors=pending_counsellors,
        verified_counsellors=verified_counsellors,
        total_institutions=total_institutions,
    )
