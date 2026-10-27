import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.deps import get_db, require_superadmin
from app.models import (
    Assignment,
    Brand,
    Inspection,
    InspectionItem,
    Machine,
    ReeferModel,
    SparePart,
    Technician,
    User,
)

router = APIRouter(prefix="/backup", tags=["backup"])

MODULES = (
    "all",
    "technicians",
    "users",
    "brands",
    "machines",
    "spare_parts",
    "assignments",
    "inspections",
)


def iso(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def technicians(session: Session) -> list[dict]:
    rows = session.scalars(select(Technician).options(selectinload(Technician.user)).order_by(Technician.id)).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "cargo": row.cargo,
            "dni": row.dni,
            "numero": row.phone,
            "archived": row.archived,
            "user_id": row.user_id,
            "username": row.user.username if row.user else None,
        }
        for row in rows
    ]


def users(session: Session) -> list[dict]:
    rows = session.scalars(select(User).options(selectinload(User.technician)).order_by(User.id)).all()
    return [
        {
            "id": row.id,
            "username": row.username,
            "full_name": row.full_name,
            "role": row.role,
            "active": row.active,
            "technician_id": row.technician.id if row.technician else None,
        }
        for row in rows
    ]


def brands(session: Session) -> list[dict]:
    rows = session.scalars(
        select(Brand).options(selectinload(Brand.models)).order_by(Brand.id)
    ).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "archived": row.archived,
            "models": [
                {"id": model.id, "name": model.name, "archived": model.archived}
                for model in sorted(row.models, key=lambda item: item.id)
            ],
        }
        for row in rows
    ]


def machines(session: Session) -> list[dict]:
    rows = session.scalars(
        select(Machine).options(selectinload(Machine.brand), selectinload(Machine.model)).order_by(Machine.id)
    ).all()
    return [
        {
            "id": row.id,
            "serial": row.serial,
            "brand_id": row.brand_id,
            "brand": row.brand.name if row.brand else None,
            "model_id": row.model_id,
            "model": row.model.name if row.model else None,
            "location": row.location,
            "year": row.year,
            "archived": row.archived,
            "machine_photo": row.machine_photo,
            "serial_photo": row.serial_photo,
        }
        for row in rows
    ]


def spare_parts(session: Session) -> list[dict]:
    rows = session.scalars(select(SparePart).options(selectinload(SparePart.model)).order_by(SparePart.id)).all()
    return [
        {
            "id": row.id,
            "brand_id": row.brand_id,
            "model_id": row.model_id,
            "model": row.model.name if row.model else None,
            "code": row.code,
            "description": row.description,
            "part_type": row.part_type,
            "archived": row.archived,
        }
        for row in rows
    ]


def assignments(session: Session) -> list[dict]:
    rows = session.scalars(
        select(Assignment)
        .options(selectinload(Assignment.machine), selectinload(Assignment.technician))
        .order_by(Assignment.id)
    ).all()
    return [
        {
            "id": row.id,
            "machine_id": row.machine_id,
            "serial": row.machine.serial if row.machine else None,
            "technician_id": row.technician_id,
            "technician": row.technician.name if row.technician else None,
            "status": row.status,
            "created_at": iso(row.created_at),
        }
        for row in rows
    ]


def inspections(session: Session) -> list[dict]:
    rows = session.scalars(
        select(Inspection)
        .options(
            selectinload(Inspection.machine),
            selectinload(Inspection.technician),
            selectinload(Inspection.items).selectinload(InspectionItem.spare_part),
            selectinload(Inspection.items).selectinload(InspectionItem.photos),
        )
        .order_by(Inspection.id)
    ).all()
    return [_inspection(row) for row in rows]


def _inspection(row: Inspection) -> dict:
    return {
        "id": row.id,
        "assignment_id": row.assignment_id,
        "machine_id": row.machine_id,
        "serial": row.machine.serial if row.machine else None,
        "technician_id": row.technician_id,
        "technician": row.technician.name if row.technician else None,
        "status": row.status,
        "started_at": iso(row.started_at),
        "completed_at": iso(row.completed_at),
        "items": [
            {
                "id": item.id,
                "spare_part_id": item.spare_part_id,
                "code": item.spare_part.code if item.spare_part else None,
                "description": item.spare_part.description if item.spare_part else None,
                "quantity": item.quantity,
                "condition": item.condition,
                "note": item.note,
                "photos": [{"id": photo.id, "filename": photo.filename} for photo in item.photos],
            }
            for item in row.items
        ],
    }


LOADERS = {
    "technicians": technicians,
    "users": users,
    "brands": brands,
    "machines": machines,
    "spare_parts": spare_parts,
    "assignments": assignments,
    "inspections": inspections,
}


@router.get("")
def download_backup(
    module: str = Query(default="all"),
    session: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    if module not in MODULES:
        raise HTTPException(status_code=400, detail="Ese módulo no tiene respaldo.")
    records = {name: loader(session) for name, loader in LOADERS.items()} if module == "all" else LOADERS[module](session)
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "module": module,
        "records": records,
    }
    filename = "respaldo-area-tecnica.json" if module == "all" else f"respaldo-{module}.json"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2).encode(),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
