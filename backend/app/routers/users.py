from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.deps import get_db, require_superadmin
from app.models import Technician, User
from app.schemas import UserOut, UserWrite
from app.security import hash_password
from app.utils import clean, commit_or_conflict, normalize_username

router = APIRouter(prefix="/users", tags=["users"])
ROLES = {"tecnico", "encargado", "superadmin"}


def to_user(user: User) -> UserOut:
    technician = user.technician
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        technician_id=technician.id if technician else None,
        technician_name=technician.name if technician else None,
        active=user.active,
    )


def linked_technician(session: Session, user_id: int) -> Technician | None:
    return session.scalar(select(Technician).where(Technician.user_id == user_id))


def ensure_superadmin_remains(session: Session, user: User, next_role: str, active: bool) -> None:
    if user.role != "superadmin":
        return
    if next_role == "superadmin" and active:
        return
    others = session.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == "superadmin", User.active.is_(True), User.id != user.id)
    )
    if not others:
        raise HTTPException(status_code=400, detail="Debe quedar al menos un superadmin activo.")


def apply_link(session: Session, user: User, technician_id: int | None, full_name: str | None) -> None:
    current = linked_technician(session, user.id)
    if user.role != "tecnico":
        if current is not None:
            current.user_id = None
        name = clean(full_name)
        if not name or len(name) < 3:
            raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
        user.full_name = name
        return
    if technician_id is None:
        if current is not None:
            current.user_id = None
        name = clean(full_name)
        if not name or len(name) < 3:
            raise HTTPException(status_code=400, detail="El nombre es obligatorio si no eliges un técnico.")
        user.full_name = name
        return
    technician = session.get(Technician, technician_id)
    if technician is None or technician.archived:
        raise HTTPException(status_code=400, detail="El técnico no está disponible.")
    if technician.user_id is not None and technician.user_id != user.id:
        raise HTTPException(status_code=409, detail="Ese técnico ya tiene un usuario.")
    if current is not None and current.id != technician.id:
        current.user_id = None
    technician.user_id = user.id
    user.full_name = technician.name


def check_password(password: str | None, required: bool) -> str | None:
    password = clean(password)
    if required and not password:
        raise HTTPException(status_code=400, detail="La contraseña es obligatoria.")
    if password and len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")
    return password


@router.get("", response_model=list[UserOut])
def list_users(session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    users = session.scalars(
        select(User).options(selectinload(User.technician)).order_by(User.full_name)
    ).all()
    return [to_user(user) for user in users]


@router.get("/technicians")
def linkable_technicians(session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    rows = session.scalars(
        select(Technician).where(Technician.archived.is_(False)).order_by(Technician.name)
    ).all()
    return [{"id": row.id, "name": row.name, "user_id": row.user_id} for row in rows]


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserWrite, session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="El rol debe ser técnico, encargado o superadmin.")
    username = normalize_username(payload.username)
    if session.scalar(select(User.id).where(User.username == username)):
        raise HTTPException(status_code=409, detail="Ese usuario ya está en uso.")
    password = check_password(payload.password, required=True)
    user = User(
        username=username,
        password_hash=hash_password(password or ""),
        full_name=clean(payload.full_name) or username,
        role=payload.role,
        active=True,
    )
    session.add(user)
    session.flush()
    apply_link(session, user, payload.technician_id if payload.role == "tecnico" else None, payload.full_name)
    commit_or_conflict(session, "Ese usuario ya está en uso.")
    session.refresh(user)
    user.technician = linked_technician(session, user.id)
    return to_user(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserWrite,
    session: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    user = session.scalar(select(User).where(User.id == user_id).options(selectinload(User.technician)))
    if user is None:
        raise HTTPException(status_code=404, detail="No se encontró el usuario.")
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="El rol debe ser técnico, encargado o superadmin.")
    ensure_superadmin_remains(session, user, payload.role, user.active)
    username = normalize_username(payload.username)
    taken = session.scalar(select(User.id).where(User.username == username, User.id != user.id))
    if taken:
        raise HTTPException(status_code=409, detail="Ese usuario ya está en uso.")
    user.username = username
    user.role = payload.role
    password = check_password(payload.password, required=False)
    if password:
        user.password_hash = hash_password(password)
    apply_link(session, user, payload.technician_id if payload.role == "tecnico" else None, payload.full_name)
    commit_or_conflict(session, "Ese usuario ya está en uso.")
    session.refresh(user)
    user.technician = linked_technician(session, user.id)
    return to_user(user)


@router.post("/{user_id}/archive", status_code=204)
def archive_user(user_id: int, session: Session = Depends(get_db), actor: User = Depends(require_superadmin)):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="No se encontró el usuario.")
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propio usuario.")
    ensure_superadmin_remains(session, user, user.role, False)
    user.active = False
    session.commit()


@router.post("/{user_id}/restore", status_code=204)
def restore_user(user_id: int, session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="No se encontró el usuario.")
    user.active = True
    session.commit()
