from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_superadmin
from app.models import ConditionOption, User
from app.schemas import ConditionOut, ConditionRename
from app.utils import clean

router = APIRouter(prefix="/conditions", tags=["condiciones"])


def to_condition(row: ConditionOption) -> ConditionOut:
    return ConditionOut(key=row.key, label=row.label)


@router.get("", response_model=list[ConditionOut])
def list_conditions(session: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = session.scalars(select(ConditionOption).order_by(ConditionOption.position, ConditionOption.key)).all()
    return [to_condition(row) for row in rows]


@router.patch("/{key}", response_model=ConditionOut)
def rename_condition(
    key: str,
    payload: ConditionRename,
    session: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    row = session.get(ConditionOption, key)
    if row is None:
        raise HTTPException(status_code=404, detail="No se encontró esa condición.")
    label = clean(payload.label)
    if label is None or len(label) < 2:
        raise HTTPException(status_code=400, detail="El nombre debe tener al menos 2 caracteres.")
    row.label = label[:40]
    session.commit()
    session.refresh(row)
    return to_condition(row)
