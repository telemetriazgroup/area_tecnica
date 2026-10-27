from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_token(user_id: int, role: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_hours)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expires},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="La sesión expiró. Vuelve a entrar.") from exc
