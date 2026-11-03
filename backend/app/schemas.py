from datetime import date, datetime

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=80)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    technician_id: int | None = None
    technician_name: str | None = None
    active: bool = True


class LoginOut(BaseModel):
    access_token: str
    user: UserOut


class UserWrite(BaseModel):
    full_name: str | None = None
    username: str = Field(min_length=3, max_length=30)
    password: str | None = None
    role: str
    technician_id: int | None = None


class TechnicianIn(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    cargo: str | None = Field(default=None, max_length=120)
    dni: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=30)


class TechnicianOut(BaseModel):
    id: int
    name: str
    cargo: str | None
    dni: str | None
    phone: str | None
    archived: bool
    username: str | None


class NameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ModelOut(BaseModel):
    id: int
    brand_id: int
    name: str
    archived: bool
    has_manual: bool = False
    manual_name: str | None = None


class BrandOut(BaseModel):
    id: int
    name: str
    archived: bool
    models: list[ModelOut] = []


class MachineIn(BaseModel):
    serial: str = Field(min_length=1, max_length=40)
    brand_id: int
    model_id: int
    location: str | None = Field(default=None, max_length=160)
    year: int | None = Field(default=None, ge=1980, le=2100)
    machine_status: str = ""


class AssignmentBrief(BaseModel):
    id: int
    technician_id: int
    technician_name: str
    status: str


class MachineOut(BaseModel):
    id: int
    serial: str
    brand_id: int
    brand_name: str
    model_id: int
    model_name: str
    location: str | None
    year: int | None
    machine_status: str = ""
    archived: bool
    has_machine_photo: bool = False
    has_serial_photo: bool = False
    active_assignment: AssignmentBrief | None = None


class SparePartIn(BaseModel):
    brand_id: int
    model_id: int
    code: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=2, max_length=200)
    part_type: str | None = Field(default=None, max_length=80)


class SparePartUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=2, max_length=200)
    part_type: str | None = Field(default=None, max_length=80)


class SparePartOut(BaseModel):
    id: int
    brand_id: int
    model_id: int
    code: str
    description: str
    part_type: str | None
    archived: bool


class BulkError(BaseModel):
    row: int
    detail: str


class BulkResult(BaseModel):
    created: int
    updated: int
    errors: list[BulkError]


class AssignmentIn(BaseModel):
    machine_id: int
    technician_id: int


class AssignmentOut(BaseModel):
    id: int
    machine_id: int
    serial: str
    brand_name: str
    model_name: str
    location: str | None
    technician_id: int
    technician_name: str
    status: str
    created_at: datetime
    inspection_id: int | None = None


class MyJob(BaseModel):
    assignment_id: int
    status: str
    inspection_id: int | None
    items_count: int
    serial: str
    brand: str
    model: str
    location: str | None
    year: int | None


class PhotoOut(BaseModel):
    id: int


class MachineBrief(BaseModel):
    id: int
    serial: str
    brand: str
    model: str
    brand_id: int
    model_id: int
    location: str | None
    year: int | None
    has_machine_photo: bool = False
    has_serial_photo: bool = False
    has_manual: bool = False


class ItemOut(BaseModel):
    id: int
    spare_part_id: int
    code: str
    description: str
    part_type: str | None
    quantity: int
    condition: str
    note: str | None
    photos: list[PhotoOut]


class EventPhotoOut(BaseModel):
    id: int


class InspectionEventOut(BaseModel):
    id: int
    status: str
    note: str | None
    author_name: str | None
    created_at: datetime
    photos: list[EventPhotoOut]


class InspectionTechnicianUpdate(BaseModel):
    technician_id: int | None = None


class InspectionOut(BaseModel):
    id: int
    assignment_id: int
    status: str
    work_status: str
    assigned_at: datetime
    started_at: datetime
    completed_at: datetime | None
    technician_name: str
    assigned_technician_id: int | None = None
    assigned_technician_name: str | None = None
    machine: MachineBrief
    items: list[ItemOut]
    events: list[InspectionEventOut] = []


class InspectionSummary(BaseModel):
    id: int
    status: str
    work_status: str
    assigned_at: datetime
    started_at: datetime
    completed_at: datetime | None
    technician_name: str
    assigned_technician_id: int | None = None
    assigned_technician_name: str | None = None
    serial: str
    brand: str
    model: str
    location: str | None
    items_count: int


class ItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999)
    condition: str
    note: str | None = Field(default=None, max_length=800)


class ConditionTotal(BaseModel):
    key: str
    label: str
    quantity: int


class RecentInspection(BaseModel):
    id: int
    serial: str
    technician_name: str
    assigned_technician_name: str | None = None
    status: str
    work_status: str = ""
    assigned_at: datetime
    started_at: datetime
    completed_at: datetime | None
    items_count: int


class DashboardOut(BaseModel):
    period: str = "day"
    period_from: date | None = None
    period_to: date | None = None
    unset_machines: int = 0
    stock_machines: int = 0
    assigned_machines: int = 0
    open_inspections: int = 0
    pending_status: int = 0
    programmed: int = 0
    in_process_inspections: int = 0
    repaired: int = 0
    no_action: int = 0
    inspections_in_period: int = 0
    closed_in_period: int = 0
    programmed_in_period: int = 0
    in_process_in_period: int = 0
    repaired_in_period: int = 0
    no_action_in_period: int = 0
    parts_in_period: int = 0
    follows_in_period: int = 0
    parts_by_condition: list[ConditionTotal] = []
    pending_assignments: int
    in_progress: int
    unassigned_machines: int
    inspected_today: int
    parts_today: int
    recent: list[RecentInspection]


class DailyInspection(BaseModel):
    id: int
    assigned_at: datetime
    started_at: datetime
    completed_at: datetime
    serial: str
    brand: str
    model: str
    location: str | None
    items_count: int


class DailyGroup(BaseModel):
    technician: str
    inspections: list[DailyInspection]


class DailyReport(BaseModel):
    date: date
    groups: list[DailyGroup]


class PartLine(BaseModel):
    code: str
    description: str
    part_type: str | None
    quantity: int
    condition: str
    note: str | None


class ConditionOut(BaseModel):
    key: str
    label: str


class ConditionRename(BaseModel):
    label: str = Field(min_length=2, max_length=40)


class PartSum(BaseModel):
    code: str
    description: str
    part_type: str | None
    quantities: dict[str, int]
    total: int


class SerialBlock(BaseModel):
    inspection_id: int
    serial: str
    brand: str
    model: str
    location: str | None
    year: int | None
    technician: str
    completed_at: datetime | None
    parts: list[PartLine]


class ModelBlock(BaseModel):
    brand: str
    model: str
    machines: int
    parts: list[PartSum]
    units: list[SerialBlock] = []


class NeedsSummary(BaseModel):
    inspections: int
    machines: int
    parts_total: int


class NeedsReport(BaseModel):
    date_from: date
    date_to: date
    work_status: str = ""
    summary: NeedsSummary
    by_serial: list[SerialBlock]
    by_model: ModelBlock | None
    models: list[ModelBlock] = []
    conditions: list[ConditionOut] = []
    conglomerate: list[PartSum]
