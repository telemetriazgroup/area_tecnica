import re
import secrets
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii")


def slugify(name: str) -> str:
    text = fold(name).lower()
    text = re.sub(r"[^a-z0-9]+", ".", text).strip(".")
    return text[:30]


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9._]{3,30}", username):
        raise HTTPException(
            status_code=400,
            detail="El usuario debe tener de 3 a 30 letras, números o puntos.",
        )
    return username


def normalize_serial(value: str) -> str:
    serial = re.sub(r"\s+", "", value).upper()
    if not serial:
        raise HTTPException(status_code=400, detail="La serie es obligatoria.")
    if len(serial) > 40:
        raise HTTPException(status_code=400, detail="La serie es demasiado larga.")
    return serial


def normalize_code(value: str) -> str:
    code = re.sub(r"\s+", " ", value).strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="La serie del repuesto es obligatoria.")
    if len(code) > 60:
        raise HTTPException(status_code=400, detail="La serie del repuesto es demasiado larga.")
    return code


def normalize_name(value: str, label: str, max_length: int = 120) -> str:
    name = re.sub(r"\s+", " ", value).strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail=f"{label} es obligatorio.")
    if len(name) > max_length:
        raise HTTPException(status_code=400, detail=f"{label} es demasiado largo.")
    return name


def temporary_password() -> str:
    alphabet = "abcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def unique_username(session: Session, name: str) -> str:
    base = slugify(name) or "tecnico"
    candidate = base
    number = 2
    while session.scalar(select(User.id).where(User.username == candidate)):
        candidate = f"{base[:24]}.{number}"
        number += 1
        if number > 40:
            candidate = f"{base[:20]}.{secrets.token_hex(2)}"
            break
    return candidate


def like_pattern(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def ilike(column, value: str):
    return column.ilike(like_pattern(value), escape="\\")


def name_taken(session: Session, model, name: str, brand_id: int | None = None, exclude_id: int | None = None):
    stmt = select(model.id).where(func.lower(model.name) == name.lower())
    if brand_id is not None:
        stmt = stmt.where(model.brand_id == brand_id)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    return session.scalar(stmt) is not None


def commit_or_conflict(session: Session, message: str = "Ese registro ya existe.") -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=message) from exc


def day_bounds(day: date) -> tuple[datetime, datetime]:
    zone = ZoneInfo(settings.timezone)
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def range_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    if end < start:
        raise HTTPException(status_code=400, detail="La fecha final es anterior a la inicial.")
    if (end - start).days > 366:
        raise HTTPException(status_code=400, detail="El rango máximo es de un año.")
    start_dt, _ = day_bounds(start)
    _, end_dt = day_bounds(end)
    return start_dt, end_dt
