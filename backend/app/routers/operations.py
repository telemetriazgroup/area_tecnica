from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.constants import CONDITIONS, MAX_PHOTOS, OPEN_ASSIGNMENT, STAFF
from app.deps import get_current_user, get_db, require_staff, require_tecnico
from app.models import Assignment, Inspection, InspectionItem, InspectionPhoto, Machine, SparePart, Technician, User
from app.photos import photo_path, remove_file, save_image
from app.routers.catalog import to_part
from app.schemas import (
    AssignmentIn,
    AssignmentOut,
    InspectionOut,
    InspectionSummary,
    ItemOut,
    ItemUpdate,
    MachineBrief,
    MyJob,
    PhotoOut,
    SparePartOut,
)
from app.utils import clean, day_bounds, ilike

router = APIRouter(tags=["operacion"])


def uploaded(photo: UploadFile | None) -> bool:
    return photo is not None and bool(photo.filename)


def load_inspection(session: Session, inspection_id: int) -> Inspection:
    inspection = session.scalar(
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(
            selectinload(Inspection.items).selectinload(InspectionItem.spare_part),
            selectinload(Inspection.items).selectinload(InspectionItem.photos),
            selectinload(Inspection.machine).selectinload(Machine.brand),
            selectinload(Inspection.machine).selectinload(Machine.model),
            selectinload(Inspection.technician),
            selectinload(Inspection.assignment),
        )
    )
    if inspection is None:
        raise HTTPException(status_code=404, detail="No se encontró la inspección.")
    return inspection


def ensure_view(user: User, inspection: Inspection) -> None:
    if user.role in STAFF:
        return
    if user.technician and inspection.technician_id == user.technician.id:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para ver esta inspección.")


def ensure_edit(user: User, inspection: Inspection) -> None:
    if user.role != "tecnico" or user.technician is None or inspection.technician_id != user.technician.id:
        raise HTTPException(status_code=403, detail="Solo el técnico asignado puede registrar esta revisión.")
    if inspection.status != "en_proceso":
        raise HTTPException(status_code=400, detail="Esta inspección ya está cerrada.")


def check_condition(condition: str) -> str:
    if condition not in CONDITIONS:
        raise HTTPException(status_code=400, detail="El estado debe ser faltante, incompleto o inoperativo.")
    return condition


def check_quantity(quantity: int) -> int:
    if quantity < 1 or quantity > 999:
        raise HTTPException(status_code=400, detail="La cantidad debe estar entre 1 y 999.")
    return quantity


def inspection_out(inspection: Inspection) -> InspectionOut:
    machine = inspection.machine
    items = []
    for item in sorted(inspection.items, key=lambda row: row.id):
        part = item.spare_part
        items.append(
            ItemOut(
                id=item.id,
                spare_part_id=item.spare_part_id,
                code=part.code,
                description=part.description,
                part_type=part.part_type,
                quantity=item.quantity,
                condition=item.condition,
                note=item.note,
                photos=[PhotoOut(id=photo.id) for photo in item.photos],
            )
        )
    return InspectionOut(
        id=inspection.id,
        assignment_id=inspection.assignment_id,
        status=inspection.status,
        assigned_at=inspection.assignment.created_at,
        started_at=inspection.started_at,
        completed_at=inspection.completed_at,
        technician_name=inspection.technician.name,
        machine=MachineBrief(
            id=machine.id,
            serial=machine.serial,
            brand=machine.brand.name,
            model=machine.model.name,
            brand_id=machine.brand_id,
            model_id=machine.model_id,
            location=machine.location,
            year=machine.year,
        ),
        items=items,
    )


def assignment_out(assignment: Assignment) -> AssignmentOut:
    machine = assignment.machine
    return AssignmentOut(
        id=assignment.id,
        machine_id=machine.id,
        serial=machine.serial,
        brand_name=machine.brand.name,
        model_name=machine.model.name,
        location=machine.location,
        technician_id=assignment.technician_id,
        technician_name=assignment.technician.name,
        status=assignment.status,
        created_at=assignment.created_at,
        inspection_id=assignment.inspection.id if assignment.inspection else None,
    )


def load_assignment(session: Session, assignment_id: int) -> Assignment:
    assignment = session.scalar(
        select(Assignment)
        .where(Assignment.id == assignment_id)
        .options(
            selectinload(Assignment.machine).selectinload(Machine.brand),
            selectinload(Assignment.machine).selectinload(Machine.model),
            selectinload(Assignment.technician).selectinload(Technician.user),
            selectinload(Assignment.inspection),
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="No se encontró la asignación.")
    return assignment


@router.get("/my/jobs", response_model=list[MyJob])
def my_jobs(session: Session = Depends(get_db), user: User = Depends(require_tecnico)):
    if user.technician is None:
        raise HTTPException(status_code=403, detail="Tu usuario no está vinculado a un técnico.")
    technician_id = user.technician.id
    options = (
        selectinload(Assignment.machine).selectinload(Machine.brand),
        selectinload(Assignment.machine).selectinload(Machine.model),
        selectinload(Assignment.inspection).selectinload(Inspection.items),
    )
    open_rows = session.scalars(
        select(Assignment)
        .where(Assignment.technician_id == technician_id, Assignment.status.in_(OPEN_ASSIGNMENT))
        .options(*options)
    ).all()
    done_rows = session.scalars(
        select(Assignment)
        .where(Assignment.technician_id == technician_id, Assignment.status == "completada")
        .options(*options)
        .order_by(Assignment.id.desc())
        .limit(15)
    ).all()
    priority = {"en_proceso": 0, "pendiente": 1, "completada": 2}
    rows = list(open_rows) + list(done_rows)
    rows.sort(key=lambda row: (priority.get(row.status, 9), -row.id))
    jobs = []
    for row in rows:
        machine = row.machine
        jobs.append(
            MyJob(
                assignment_id=row.id,
                status=row.status,
                inspection_id=row.inspection.id if row.inspection else None,
                items_count=len(row.inspection.items) if row.inspection else 0,
                serial=machine.serial,
                brand=machine.brand.name,
                model=machine.model.name,
                location=machine.location,
                year=machine.year,
            )
        )
    return jobs


@router.get("/assignments", response_model=list[AssignmentOut])
def list_assignments(
    scope: str = "activas",
    session: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    stmt = (
        select(Assignment)
        .options(
            selectinload(Assignment.machine).selectinload(Machine.brand),
            selectinload(Assignment.machine).selectinload(Machine.model),
            selectinload(Assignment.technician),
            selectinload(Assignment.inspection),
        )
        .order_by(Assignment.id.desc())
        .limit(100)
    )
    if scope == "historial":
        stmt = stmt.where(Assignment.status.in_(["completada", "cancelada"]))
    else:
        stmt = stmt.where(Assignment.status.in_(OPEN_ASSIGNMENT))
    return [assignment_out(row) for row in session.scalars(stmt).all()]


@router.post("/assignments", response_model=AssignmentOut, status_code=201)
def create_assignment(
    payload: AssignmentIn,
    session: Session = Depends(get_db),
    actor: User = Depends(require_staff),
):
    machine = session.scalar(
        select(Machine)
        .where(Machine.id == payload.machine_id)
        .options(selectinload(Machine.brand), selectinload(Machine.model))
    )
    if machine is None or machine.archived:
        raise HTTPException(status_code=400, detail="La máquina no está disponible.")
    technician = session.scalar(
        select(Technician).where(Technician.id == payload.technician_id).options(selectinload(Technician.user))
    )
    if technician is None or technician.archived:
        raise HTTPException(status_code=400, detail="El técnico no está disponible.")
    if technician.user is not None and not technician.user.active:
        raise HTTPException(status_code=400, detail="El usuario de este técnico está inactivo.")
    open_job = session.scalar(
        select(Assignment.id).where(
            Assignment.machine_id == machine.id,
            Assignment.status.in_(OPEN_ASSIGNMENT),
        )
    )
    if open_job:
        raise HTTPException(status_code=409, detail="Esa máquina ya tiene una revisión abierta.")
    assignment = Assignment(
        machine_id=machine.id,
        technician_id=technician.id,
        assigned_by_id=actor.id,
        status="pendiente",
    )
    session.add(assignment)
    session.commit()
    return assignment_out(load_assignment(session, assignment.id))


@router.post("/assignments/{assignment_id}/cancel", status_code=204)
def cancel_assignment(
    assignment_id: int,
    session: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    assignment = session.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="No se encontró la asignación.")
    if assignment.status != "pendiente":
        raise HTTPException(status_code=400, detail="Solo puedes cancelar una asignación que aún no empieza.")
    assignment.status = "cancelada"
    session.commit()


@router.post("/assignments/{assignment_id}/start", response_model=InspectionOut)
def start_assignment(
    assignment_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    assignment = load_assignment(session, assignment_id)
    if user.technician is None or assignment.technician_id != user.technician.id:
        raise HTTPException(status_code=403, detail="Esta máquina no está asignada a ti.")
    if assignment.status == "cancelada":
        raise HTTPException(status_code=400, detail="Esta asignación fue cancelada.")
    if assignment.inspection:
        return inspection_out(load_inspection(session, assignment.inspection.id))
    if assignment.status == "completada":
        raise HTTPException(status_code=400, detail="Esta revisión ya terminó.")
    inspection = Inspection(
        assignment_id=assignment.id,
        machine_id=assignment.machine_id,
        technician_id=assignment.technician_id,
        status="en_proceso",
    )
    assignment.status = "en_proceso"
    session.add(inspection)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        assignment = load_assignment(session, assignment_id)
        if assignment.inspection is None:
            raise HTTPException(status_code=409, detail="La revisión ya fue abierta. Vuelve a entrar.") from None
        return inspection_out(load_inspection(session, assignment.inspection.id))
    return inspection_out(load_inspection(session, inspection.id))


@router.get("/inspections", response_model=list[InspectionSummary])
def list_inspections(
    q: str = "",
    status: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Inspection)
        .join(Inspection.machine)
        .options(
            selectinload(Inspection.machine).selectinload(Machine.brand),
            selectinload(Inspection.machine).selectinload(Machine.model),
            selectinload(Inspection.technician),
            selectinload(Inspection.assignment),
            selectinload(Inspection.items),
        )
        .order_by(Inspection.id.desc())
        .limit(200)
    )
    if user.role == "tecnico":
        if user.technician is None:
            return []
        stmt = stmt.where(Inspection.technician_id == user.technician.id)
    elif user.role not in STAFF:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")
    if status:
        stmt = stmt.where(Inspection.status == status)
    query = q.strip()
    if query:
        stmt = stmt.where(or_(ilike(Machine.serial, query), ilike(Machine.location, query)))
    if date_from or date_to:
        start_day = date_from or date_to
        end_day = date_to or date_from
        if end_day < start_day:
            raise HTTPException(status_code=400, detail="La fecha final es anterior a la inicial.")
        start, end = day_bounds(start_day)[0], day_bounds(end_day)[1]
        stmt = stmt.where(Inspection.started_at >= start, Inspection.started_at < end)
    rows = []
    for inspection in session.scalars(stmt).all():
        machine = inspection.machine
        rows.append(
            InspectionSummary(
                id=inspection.id,
                status=inspection.status,
                assigned_at=inspection.assignment.created_at,
                started_at=inspection.started_at,
                completed_at=inspection.completed_at,
                technician_name=inspection.technician.name,
                serial=machine.serial,
                brand=machine.brand.name,
                model=machine.model.name,
                location=machine.location,
                items_count=len(inspection.items),
            )
        )
    return rows


@router.get("/inspections/{inspection_id}", response_model=InspectionOut)
def get_inspection(inspection_id: int, session: Session = Depends(get_db), user: User = Depends(get_current_user)):
    inspection = load_inspection(session, inspection_id)
    ensure_view(user, inspection)
    return inspection_out(inspection)


@router.get("/inspections/{inspection_id}/parts", response_model=list[SparePartOut])
def search_parts(
    inspection_id: int,
    q: str = "",
    limit: int = 30,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inspection = load_inspection(session, inspection_id)
    ensure_view(user, inspection)
    limit = min(max(limit, 1), 50)
    stmt = (
        select(SparePart)
        .where(SparePart.model_id == inspection.machine.model_id, SparePart.archived.is_(False))
        .order_by(SparePart.description)
        .limit(limit)
    )
    query = q.strip()
    if query:
        stmt = stmt.where(or_(ilike(SparePart.description, query), ilike(SparePart.code, query)))
    return [to_part(part) for part in session.scalars(stmt).all()]


@router.post("/inspections/{inspection_id}/items", response_model=InspectionOut, status_code=201)
def add_item(
    inspection_id: int,
    spare_part_id: int = Form(),
    quantity: int = Form(),
    condition: str = Form(),
    note: str = Form(""),
    photo: UploadFile | None = File(None),
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    inspection = load_inspection(session, inspection_id)
    ensure_edit(user, inspection)
    part = session.get(SparePart, spare_part_id)
    if part is None or part.archived or part.model_id != inspection.machine.model_id:
        raise HTTPException(status_code=400, detail="Ese repuesto no corresponde a este modelo.")
    existing = session.scalar(
        select(InspectionItem).where(
            InspectionItem.inspection_id == inspection.id,
            InspectionItem.spare_part_id == part.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "Ese repuesto ya está en la lista.", "item_id": existing.id},
        )
    clean_note = clean(note)
    if clean_note and len(clean_note) > 800:
        raise HTTPException(status_code=400, detail="La nota es demasiado larga.")
    item = InspectionItem(
        inspection_id=inspection.id,
        spare_part_id=part.id,
        quantity=check_quantity(quantity),
        condition=check_condition(condition),
        note=clean_note,
    )
    session.add(item)
    session.flush()
    if uploaded(photo):
        filename = save_image(photo)
        session.add(InspectionPhoto(item_id=item.id, filename=filename))
    session.commit()
    return inspection_out(load_inspection(session, inspection.id))


@router.post("/inspections/{inspection_id}/complete", response_model=InspectionOut)
def complete_inspection(
    inspection_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    inspection = load_inspection(session, inspection_id)
    ensure_edit(user, inspection)
    inspection.status = "completada"
    inspection.completed_at = datetime.now(timezone.utc)
    inspection.assignment.status = "completada"
    session.commit()
    return inspection_out(load_inspection(session, inspection.id))


def load_item(session: Session, item_id: int) -> InspectionItem:
    item = session.scalar(
        select(InspectionItem)
        .where(InspectionItem.id == item_id)
        .options(selectinload(InspectionItem.photos), selectinload(InspectionItem.inspection))
    )
    if item is None:
        raise HTTPException(status_code=404, detail="No se encontró el repuesto de la inspección.")
    return item


@router.patch("/inspection-items/{item_id}", response_model=InspectionOut)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    item = load_item(session, item_id)
    inspection = load_inspection(session, item.inspection_id)
    ensure_edit(user, inspection)
    item.quantity = check_quantity(payload.quantity)
    item.condition = check_condition(payload.condition)
    note = clean(payload.note)
    if note and len(note) > 800:
        raise HTTPException(status_code=400, detail="La nota es demasiado larga.")
    item.note = note
    session.commit()
    return inspection_out(load_inspection(session, inspection.id))


@router.delete("/inspection-items/{item_id}", response_model=InspectionOut)
def delete_item(item_id: int, session: Session = Depends(get_db), user: User = Depends(require_tecnico)):
    item = load_item(session, item_id)
    inspection = load_inspection(session, item.inspection_id)
    ensure_edit(user, inspection)
    filenames = [photo.filename for photo in item.photos]
    session.delete(item)
    session.commit()
    for filename in filenames:
        remove_file(filename)
    return inspection_out(load_inspection(session, inspection.id))


@router.post("/inspection-items/{item_id}/photos", response_model=InspectionOut)
def add_photo(
    item_id: int,
    photo: UploadFile = File(...),
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    item = load_item(session, item_id)
    inspection = load_inspection(session, item.inspection_id)
    ensure_edit(user, inspection)
    if not uploaded(photo):
        raise HTTPException(status_code=400, detail="Elige una foto.")
    if len(item.photos) >= MAX_PHOTOS:
        raise HTTPException(status_code=400, detail="Solo puedes adjuntar 4 fotos por repuesto.")
    filename = save_image(photo)
    session.add(InspectionPhoto(item_id=item.id, filename=filename))
    session.commit()
    return inspection_out(load_inspection(session, inspection.id))


@router.delete("/inspection-items/{item_id}/photos/{photo_id}", response_model=InspectionOut)
def delete_photo(
    item_id: int,
    photo_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(require_tecnico),
):
    photo = session.get(InspectionPhoto, photo_id)
    if photo is None or photo.item_id != item_id:
        raise HTTPException(status_code=404, detail="No se encontró la foto.")
    item = load_item(session, item_id)
    inspection = load_inspection(session, item.inspection_id)
    ensure_edit(user, inspection)
    filename = photo.filename
    session.delete(photo)
    session.commit()
    remove_file(filename)
    return inspection_out(load_inspection(session, inspection.id))


@router.get("/photos/{photo_id}")
def get_photo(photo_id: int, session: Session = Depends(get_db), user: User = Depends(get_current_user)):
    photo = session.scalar(
        select(InspectionPhoto)
        .where(InspectionPhoto.id == photo_id)
        .options(selectinload(InspectionPhoto.item).selectinload(InspectionItem.inspection))
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="No se encontró la foto.")
    ensure_view(user, photo.item.inspection)
    return FileResponse(photo_path(photo.filename), media_type="image/jpeg")
