from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.deps import get_current_user, get_db
from app.models import User
from app.schemas import LoginIn, LoginOut, UserOut
from app.security import create_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: User) -> UserOut:
    technician_id = user.technician.id if user.technician else None
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        technician_id=technician_id,
        technician_name=user.technician.name if user.technician else None,
        active=user.active,
    )


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, response: Response, session: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = session.scalar(
        select(User).where(User.username == username).options(selectinload(User.technician))
    )
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    token = create_token(user.id, user.role)
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return LoginOut(access_token=token, user=user_out(user))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)
