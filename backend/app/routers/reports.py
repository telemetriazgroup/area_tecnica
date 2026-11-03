from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.constants import OPEN_ASSIGNMENT, WORK_STATUSES
from app.deps import get_db, require_staff
from app.models import (
    Assignment,
    ConditionOption,
    Inspection,
    InspectionEvent,
    InspectionItem,
    Machine,
    ReeferModel,
    User,
)
from app.schemas import (
    ConditionOut,
    ConditionTotal,
    DailyGroup,
    DailyInspection,
    DailyReport,
    DashboardOut,
    ModelBlock,
    NeedsReport,
    NeedsSummary,
    PartLine,
    PartSum,
    RecentInspection,
    SerialBlock,
)
from app.report_export import PDF_MEDIA, XLSX_MEDIA, build_daily_pdf, build_daily_xlsx, build_needs_pdf, build_needs_xlsx
from app.utils import day_bounds, range_bounds

router = APIRouter(tags=["reportes"])


def period_bounds(period: str) -> tuple[str, date, date, datetime, datetime]:
    if period not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail="El período debe ser día, semana o mes.")
    today = datetime.now(ZoneInfo(settings.timezone)).date()
    if period == "week":
        start_day = today - timedelta(days=today.weekday())
    elif period == "month":
        start_day = today.replace(day=1)
    else:
        start_day = today
    start, end = range_bounds(start_day, today)
    return period, start_day, today, start, end


def inspection_options():
    return (
        selectinload(Inspection.items).selectinload(InspectionItem.spare_part),
        selectinload(Inspection.machine).selectinload(Machine.brand),
        selectinload(Inspection.machine).selectinload(Machine.model),
        selectinload(Inspection.technician),
        selectinload(Inspection.assignment),
    )


def load_completed(session: Session, start, end) -> list[Inspection]:
    return list(
        session.scalars(
            select(Inspection)
            .where(
                Inspection.status == "completada",
                Inspection.completed_at >= start,
                Inspection.completed_at < end,
            )
            .options(*inspection_options())
            .order_by(Inspection.completed_at)
        ).all()
    )


def load_needs_inspections(session: Session, start, end, work_status: str) -> list[Inspection]:
    if not work_status:
        return load_completed(session, start, end)
    if work_status != "todos" and work_status not in WORK_STATUSES:
        raise HTTPException(status_code=400, detail="El status no es válido.")
    activity = or_(
        and_(Inspection.completed_at.is_not(None), Inspection.completed_at >= start, Inspection.completed_at < end),
        and_(Inspection.started_at >= start, Inspection.started_at < end),
    )
    stmt = select(Inspection).where(activity).options(*inspection_options()).order_by(Inspection.started_at)
    if work_status != "todos":
        stmt = stmt.where(Inspection.work_status == work_status)
    return list(session.scalars(stmt).all())


def load_conditions(session: Session) -> list[ConditionOut]:
    rows = session.scalars(select(ConditionOption).order_by(ConditionOption.position, ConditionOption.key)).all()
    return [ConditionOut(key=row.key, label=row.label) for row in rows]


def sum_parts(inspections: list[Inspection], keys: list[str]) -> list[PartSum]:
    grouped: dict[tuple[str, str, str | None], dict[str, int]] = {}
    for inspection in inspections:
        for item in inspection.items:
            part = item.spare_part
            key = (part.code, part.description, part.part_type)
            bucket = grouped.setdefault(key, {name: 0 for name in keys})
            if item.condition in bucket:
                bucket[item.condition] += item.quantity
    rows = []
    for (code, description, part_type), qty in grouped.items():
        rows.append(
            PartSum(
                code=code,
                description=description,
                part_type=part_type,
                quantities=qty,
                total=sum(qty.values()),
            )
        )
    rows.sort(key=lambda row: (-row.total, row.description.lower()))
    return rows


def summary_for(inspections: list[Inspection]) -> NeedsSummary:
    parts_total = sum(item.quantity for inspection in inspections for item in inspection.items)
    return NeedsSummary(
        inspections=len(inspections),
        machines=len({inspection.machine.serial for inspection in inspections}),
        parts_total=parts_total,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    period: str = "day",
    session: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    period, period_from, period_to, start, end = period_bounds(period)
    pending = session.scalar(
        select(func.count()).select_from(Assignment).where(Assignment.status == "pendiente")
    )
    in_progress = session.scalar(
        select(func.count()).select_from(Assignment).where(Assignment.status == "en_proceso")
    )
    open_exists = (
        select(Assignment.id)
        .where(Assignment.machine_id == Machine.id, Assignment.status.in_(OPEN_ASSIGNMENT))
        .exists()
    )
    unassigned = session.scalar(
        select(func.count()).select_from(Machine).where(Machine.archived.is_(False), ~open_exists)
    )
    today = period_to
    inspected_today = session.scalar(
        select(func.count())
        .select_from(Inspection)
        .where(
            Inspection.status == "completada",
            Inspection.completed_at >= start,
            Inspection.completed_at < end,
        )
    )
    parts_today = session.scalar(
        select(func.coalesce(func.sum(InspectionItem.quantity), 0))
        .select_from(InspectionItem)
        .join(Inspection, InspectionItem.inspection_id == Inspection.id)
        .where(
            Inspection.status == "completada",
            Inspection.completed_at >= start,
            Inspection.completed_at < end,
        )
    )
    recent_rows = session.scalars(
        select(Inspection)
        .options(
            selectinload(Inspection.machine),
            selectinload(Inspection.technician),
            selectinload(Inspection.assigned_technician),
            selectinload(Inspection.assignment),
            selectinload(Inspection.items),
        )
        .order_by(Inspection.id.desc())
        .limit(8)
    ).all()
    recent = [
        RecentInspection(
            id=row.id,
            serial=row.machine.serial,
            technician_name=row.technician.name,
            assigned_technician_name=row.assigned_technician.name if row.assigned_technician else None,
            status=row.status,
            work_status=row.work_status,
            assigned_at=row.assignment.created_at,
            started_at=row.started_at,
            completed_at=row.completed_at,
            items_count=len(row.items),
        )
        for row in recent_rows
    ]
    def count_machines(status: str) -> int:
        value = session.scalar(
            select(func.count())
            .select_from(Machine)
            .where(Machine.archived.is_(False), Machine.machine_status == status)
        )
        return value or 0

    def count_work(status: str) -> int:
        value = session.scalar(
            select(func.count()).select_from(Inspection).where(Inspection.work_status == status)
        )
        return value or 0

    def count_status_period(status: str) -> int:
        by_event = (
            select(InspectionEvent.inspection_id)
            .where(
                InspectionEvent.status == status,
                InspectionEvent.created_at >= start,
                InspectionEvent.created_at < end,
            )
        )
        value = session.scalar(
            select(func.count())
            .select_from(Inspection)
            .where(
                or_(
                    Inspection.id.in_(by_event),
                    and_(
                        Inspection.work_status == status,
                        Inspection.status_at.is_not(None),
                        Inspection.status_at >= start,
                        Inspection.status_at < end,
                    ),
                )
            )
        )
        return value or 0

    open_inspections = session.scalar(
        select(func.count()).select_from(Inspection).where(Inspection.status == "en_proceso")
    )
    pending_status = session.scalar(
        select(func.count())
        .select_from(Inspection)
        .where(Inspection.status == "completada", Inspection.work_status == "")
    )
    inspections_in_period = session.scalar(
        select(func.count())
        .select_from(Inspection)
        .where(Inspection.started_at >= start, Inspection.started_at < end)
    )
    closed_in_period = session.scalar(
        select(func.count())
        .select_from(Inspection)
        .where(
            Inspection.status == "completada",
            Inspection.completed_at >= start,
            Inspection.completed_at < end,
        )
    )
    parts_in_period = session.scalar(
        select(func.coalesce(func.sum(InspectionItem.quantity), 0))
        .select_from(InspectionItem)
        .join(Inspection, InspectionItem.inspection_id == Inspection.id)
        .where(Inspection.started_at >= start, Inspection.started_at < end)
    )
    follows_in_period = session.scalar(
        select(func.count())
        .select_from(InspectionEvent)
        .where(
            InspectionEvent.status == "seguimiento",
            InspectionEvent.created_at >= start,
            InspectionEvent.created_at < end,
        )
    )
    condition_rows = session.execute(
        select(InspectionItem.condition, func.coalesce(func.sum(InspectionItem.quantity), 0))
        .join(Inspection, InspectionItem.inspection_id == Inspection.id)
        .where(Inspection.started_at >= start, Inspection.started_at < end)
        .group_by(InspectionItem.condition)
    ).all()
    quantities = {key: int(qty or 0) for key, qty in condition_rows}
    conditions = load_conditions(session)
    known = {item.key for item in conditions}
    parts_by_condition = [
        ConditionTotal(key=item.key, label=item.label, quantity=quantities.get(item.key, 0))
        for item in conditions
    ]
    parts_by_condition.extend(
        ConditionTotal(key=key, label=key, quantity=qty)
        for key, qty in quantities.items()
        if key not in known
    )
    return DashboardOut(
        period=period,
        period_from=period_from,
        period_to=period_to,
        unset_machines=count_machines(""),
        stock_machines=count_machines("stock"),
        assigned_machines=count_machines("asignado"),
        open_inspections=open_inspections or 0,
        pending_status=pending_status or 0,
        programmed=count_work("programado"),
        in_process_inspections=count_work("en_proceso"),
        repaired=count_work("reparado"),
        no_action=count_work("sin_accion"),
        inspections_in_period=inspections_in_period or 0,
        closed_in_period=closed_in_period or 0,
        programmed_in_period=count_status_period("programado"),
        in_process_in_period=count_status_period("en_proceso"),
        repaired_in_period=count_status_period("reparado"),
        no_action_in_period=count_status_period("sin_accion"),
        parts_in_period=int(parts_in_period or 0),
        follows_in_period=follows_in_period or 0,
        parts_by_condition=parts_by_condition,
        pending_assignments=pending or 0,
        in_progress=in_progress or 0,
        unassigned_machines=unassigned or 0,
        inspected_today=inspected_today or 0,
        parts_today=int(parts_today or 0),
        recent=recent,
    )


@router.get("/reports/daily", response_model=DailyReport)
def daily_report(
    day: date = Query(..., alias="date"),
    session: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    start, end = day_bounds(day)
    inspections = load_completed(session, start, end)
    grouped: dict[str, list[DailyInspection]] = {}
    for inspection in inspections:
        grouped.setdefault(inspection.technician.name, []).append(
            DailyInspection(
                id=inspection.id,
                assigned_at=inspection.assignment.created_at,
                started_at=inspection.started_at,
                completed_at=inspection.completed_at,
                serial=inspection.machine.serial,
                brand=inspection.machine.brand.name,
                model=inspection.machine.model.name,
                location=inspection.machine.location,
                items_count=len(inspection.items),
            )
        )
    groups = [
        DailyGroup(technician=name, inspections=rows)
        for name, rows in sorted(grouped.items(), key=lambda item: item[0].lower())
    ]
    return DailyReport(date=day, groups=groups)


def file_response(payload: bytes, media: str, filename: str) -> Response:
    return Response(
        content=payload,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/daily/export")
def export_daily(
    day: date = Query(..., alias="date"),
    file_format: str = Query(..., alias="format", pattern="^(pdf|xlsx)$"),
    session: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    report = daily_report(day, session, user)
    if file_format == "pdf":
        return file_response(build_daily_pdf(report), PDF_MEDIA, f"inspecciones-{day.isoformat()}.pdf")
    return file_response(build_daily_xlsx(report), XLSX_MEDIA, f"inspecciones-{day.isoformat()}.xlsx")


@router.get("/reports/needs", response_model=NeedsReport)
def needs_report(
    date_from: date,
    date_to: date,
    brand_id: int | None = None,
    model_id: int | None = None,
    work_status: str = "",
    session: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    start, end = range_bounds(date_from, date_to)
    conditions = load_conditions(session)
    keys = [item.key for item in conditions]
    inspections = load_needs_inspections(session, start, end, work_status)
    by_serial = []
    for inspection in inspections:
        machine = inspection.machine
        by_serial.append(
            SerialBlock(
                inspection_id=inspection.id,
                serial=machine.serial,
                brand=machine.brand.name,
                model=machine.model.name,
                location=machine.location,
                year=machine.year,
                technician=inspection.technician.name,
                completed_at=inspection.completed_at,
                parts=[
                    PartLine(
                        code=item.spare_part.code,
                        description=item.spare_part.description,
                        part_type=item.spare_part.part_type,
                        quantity=item.quantity,
                        condition=item.condition,
                        note=item.note,
                    )
                    for item in sorted(inspection.items, key=lambda row: row.spare_part.description.lower())
                ],
            )
        )
    grouped: dict[tuple[str, str], list[SerialBlock]] = {}
    for block in by_serial:
        grouped.setdefault((block.brand, block.model), []).append(block)
    inspection_by_id = {inspection.id: inspection for inspection in inspections}
    models = []
    for (brand_name, model_name), units in sorted(grouped.items(), key=lambda item: (item[0][0].lower(), item[0][1].lower())):
        chosen_units = [inspection_by_id[unit.inspection_id] for unit in units]
        models.append(
            ModelBlock(
                brand=brand_name,
                model=model_name,
                machines=len({unit.serial for unit in units}),
                parts=sum_parts(chosen_units, keys),
                units=units,
            )
        )
    by_model = None
    if brand_id is not None or model_id is not None:
        if brand_id is None or model_id is None:
            raise HTTPException(status_code=400, detail="Elige marca y modelo.")
        model = session.scalar(
            select(ReeferModel).where(ReeferModel.id == model_id).options(selectinload(ReeferModel.brand))
        )
        if model is None or model.brand_id != brand_id:
            raise HTTPException(status_code=400, detail="El modelo no corresponde a la marca.")
        chosen = [
            inspection
            for inspection in inspections
            if inspection.machine.brand_id == brand_id and inspection.machine.model_id == model_id
        ]
        by_model = ModelBlock(
            brand=model.brand.name,
            model=model.name,
            machines=len({inspection.machine.serial for inspection in chosen}),
            parts=sum_parts(chosen, keys),
            units=[
                block
                for block in by_serial
                if block.brand == model.brand.name and block.model == model.name
            ],
        )
    return NeedsReport(
        date_from=date_from,
        date_to=date_to,
        work_status=work_status,
        summary=summary_for(inspections),
        by_serial=by_serial,
        by_model=by_model,
        models=models,
        conditions=conditions,
        conglomerate=sum_parts(inspections, keys),
    )


@router.get("/reports/needs/export")
def export_needs(
    date_from: date,
    date_to: date,
    view: str = Query(..., pattern="^(serie|modelo|total|general)$"),
    file_format: str = Query(..., alias="format", pattern="^(pdf|xlsx)$"),
    brand_id: int | None = None,
    model_id: int | None = None,
    work_status: str = "",
    session: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    if view == "modelo" and (brand_id is None or model_id is None):
        raise HTTPException(status_code=400, detail="Elige marca y modelo.")
    report = needs_report(date_from, date_to, brand_id, model_id, work_status, session, user)
    if view == "modelo" and report.by_model is None:
        raise HTTPException(status_code=400, detail="Elige marca y modelo.")
    names = {
        "serie": "necesidad-serie",
        "modelo": "necesidad-modelo",
        "total": "conglomerado",
        "general": "reporte-general",
    }
    stem = f"{names[view]}-{date_from.isoformat()}-al-{date_to.isoformat()}"
    if file_format == "pdf":
        return file_response(build_needs_pdf(report, view), PDF_MEDIA, f"{stem}.pdf")
    return file_response(build_needs_xlsx(report, view), XLSX_MEDIA, f"{stem}.xlsx")
