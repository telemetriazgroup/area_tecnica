from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.deps import get_db, require_superadmin
from app.models import Brand, Machine, ReeferModel, SparePart, Technician, User

router = APIRouter(prefix="/audit", tags=["audit"])


class RestoreIn(BaseModel):
    module: str
    id: int


def row(item_id: int, label: str, detail: str = "") -> dict:
    return {"id": item_id, "label": label, "detail": detail}


@router.get("")
def archived_records(session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    technicians = session.scalars(
        select(Technician).where(Technician.archived.is_(True)).order_by(Technician.name)
    ).all()
    users = session.scalars(select(User).where(User.active.is_(False)).order_by(User.full_name)).all()
    brands = session.scalars(select(Brand).where(Brand.archived.is_(True)).order_by(Brand.name)).all()
    models = session.scalars(
        select(ReeferModel)
        .where(ReeferModel.archived.is_(True))
        .options(selectinload(ReeferModel.brand))
        .order_by(ReeferModel.name)
    ).all()
    machines = session.scalars(
        select(Machine)
        .where(Machine.archived.is_(True))
        .options(selectinload(Machine.brand), selectinload(Machine.model))
        .order_by(Machine.serial)
    ).all()
    parts = session.scalars(
        select(SparePart)
        .where(SparePart.archived.is_(True))
        .options(selectinload(SparePart.model))
        .order_by(SparePart.code)
    ).all()
    return {
        "technicians": [row(item.id, item.name, item.cargo or "") for item in technicians],
        "users": [row(item.id, item.full_name, item.username) for item in users],
        "brands": [row(item.id, item.name) for item in brands],
        "models": [row(item.id, item.name, item.brand.name if item.brand else "") for item in models],
        "machines": [
            row(item.id, item.serial, f"{item.brand.name if item.brand else ''} {item.model.name if item.model else ''}".strip())
            for item in machines
        ],
        "spare_parts": [
            row(item.id, f"{item.code} · {item.description}", item.model.name if item.model else "")
            for item in parts
        ],
    }


@router.post("/restore", status_code=204)
def restore_record(payload: RestoreIn, session: Session = Depends(get_db), _: User = Depends(require_superadmin)):
    if payload.module == "technicians":
        item = session.get(Technician, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró el técnico.")
        item.archived = False
        if item.user_id:
            account = session.get(User, item.user_id)
            if account is not None:
                account.active = True
    elif payload.module == "users":
        item = session.get(User, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró el usuario.")
        item.active = True
    elif payload.module == "brands":
        item = session.get(Brand, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró la marca.")
        item.archived = False
    elif payload.module == "models":
        item = session.get(ReeferModel, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró el modelo.")
        item.archived = False
    elif payload.module == "machines":
        item = session.get(Machine, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró la máquina.")
        item.archived = False
    elif payload.module == "spare_parts":
        item = session.get(SparePart, payload.id)
        if item is None:
            raise HTTPException(status_code=404, detail="No se encontró el repuesto.")
        item.archived = False
    else:
        raise HTTPException(status_code=400, detail="Ese módulo no se puede restaurar.")
    session.commit()
