from collections.abc import Callable

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.constants import STAFF
from app.database import SessionLocal
from app.models import User
from app.security import decode_token


def get_db():
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _token_from_request(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    cookie = request.cookies.get("access_token")
    if cookie:
        return cookie
    return request.query_params.get("access_token")


def get_current_user(request: Request, session: Session = Depends(get_db)) -> User:
    token = _token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    payload = decode_token(token)
    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="La sesión no es válida.") from exc
    user = session.scalar(
        select(User).where(User.id == user_id).options(selectinload(User.technician))
    )
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="El usuario no está activo.")
    return user


def require(*roles: str) -> Callable:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")
        return user

    return checker


require_staff = require(*STAFF)
require_tecnico = require("tecnico")
require_superadmin = require("superadmin")


def archived_requested(user: User, requested: bool) -> bool:
    return bool(requested) and user.role == "superadmin"
