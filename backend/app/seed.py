import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.security import hash_password

logger = logging.getLogger("area_tecnica")

CARRIER_PARTS = [
    ("CT-12", "Contactor 12A", "Eléctrico"),
    ("CT-20", "Contactor 20A", "Eléctrico"),
    ("CMP-01", "Compresor", "Refrigeración"),
    ("FLT-01", "Filtro deshidratador", "Refrigeración"),
    ("VEN-EV", "Ventilador del evaporador", "Ventilación"),
    ("VEN-CD", "Ventilador del condensador", "Ventilación"),
    ("CAB-01", "Cable de poder", "Eléctrico"),
    ("CTR-01", "Controlador", "Control"),
    ("VEX-01", "Válvula de expansión", "Refrigeración"),
    ("SEN-T", "Sensor de temperatura", "Control"),
    ("CON-CP", "Contactor del compresor", "Eléctrico"),
    ("SEL-01", "Sello de puerta", "Estructura"),
]


def _user(username: str, password: str, full_name: str, role: str) -> User:
    return User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        active=True,
    )


def _parts(brand_id: int, model_id: int, rows: list[tuple[str, str, str]]) -> list[SparePart]:
    return [
        SparePart(brand_id=brand_id, model_id=model_id, code=code, description=description, part_type=part_type)
        for code, description, part_type in rows
    ]


def seed(session: Session) -> None:
    if session.scalar(select(User.id)):
        return

    admin = _user("admin", "admin123", "Administrador general", "superadmin")
    encargado = _user("encargado", "encargado123", "Encargado de área", "encargado")
    juan = _user("jperez", "tecnico123", "Pérez Juan", "tecnico")
    maria = _user("mlopez", "tecnico123", "López María", "tecnico")
    session.add_all([admin, encargado, juan, maria])
    session.flush()

    tech_juan = Technician(
        name="Pérez Juan",
        cargo="Técnico de reefer",
        dni="45678912",
        phone="999111222",
        user_id=juan.id,
    )
    tech_maria = Technician(
        name="López María",
        cargo="Técnico de reefer",
        dni="40111222",
        phone="999333444",
        user_id=maria.id,
    )
    session.add_all([tech_juan, tech_maria])

    carrier = Brand(name="Carrier")
    thermo = Brand(name="Thermo King")
    daikin = Brand(name="Daikin")
    session.add_all([carrier, thermo, daikin])
    session.flush()

    carrier_model = ReeferModel(brand_id=carrier.id, name="69NT40-561")
    carrier_alt = ReeferModel(brand_id=carrier.id, name="Primeline")
    thermo_model = ReeferModel(brand_id=thermo.id, name="MAGNUM PLUS")
    daikin_model = ReeferModel(brand_id=daikin.id, name="LXE10E")
    session.add_all([carrier_model, carrier_alt, thermo_model, daikin_model])
    session.flush()

    session.add_all(_parts(carrier.id, carrier_model.id, CARRIER_PARTS))
    session.add_all(
        _parts(
            thermo.id,
            thermo_model.id,
            [
                ("TK-CMP", "Compresor", "Refrigeración"),
                ("TK-CTL", "Controlador", "Control"),
                ("TK-FAN", "Ventilador del condensador", "Ventilación"),
            ],
        )
    )
    session.add_all(
        _parts(
            daikin.id,
            daikin_model.id,
            [
                ("DK-FAN", "Ventilador del evaporador", "Ventilación"),
                ("DK-CTL", "Controlador", "Control"),
            ],
        )
    )
    session.flush()

    pending = Machine(
        serial="RFFU1234567",
        brand_id=carrier.id,
        model_id=carrier_model.id,
        location="Patio B",
        year=2016,
    )
    reviewed = Machine(
        serial="RFFU7654321",
        brand_id=carrier.id,
        model_id=carrier_model.id,
        location="Patio A",
        year=2014,
    )
    loose_tk = Machine(
        serial="TKRU0001111",
        brand_id=thermo.id,
        model_id=thermo_model.id,
        location="Taller 1",
        year=2019,
    )
    loose_dk = Machine(serial="DKRU0002222", brand_id=daikin.id, model_id=daikin_model.id)
    session.add_all([pending, reviewed, loose_tk, loose_dk])
    session.flush()

    session.add(
        Assignment(
            machine_id=pending.id,
            technician_id=tech_juan.id,
            assigned_by_id=encargado.id,
            status="pendiente",
        )
    )
    done = Assignment(
        machine_id=reviewed.id,
        technician_id=tech_juan.id,
        assigned_by_id=encargado.id,
        status="completada",
    )
    session.add(done)
    session.flush()

    now = datetime.now(timezone.utc)
    done.created_at = now - timedelta(hours=3)
    inspection = Inspection(
        assignment_id=done.id,
        machine_id=reviewed.id,
        technician_id=tech_juan.id,
        status="completada",
        started_at=now - timedelta(hours=2),
        completed_at=now,
    )
    session.add(inspection)
    session.flush()

    parts = {
        part.code: part
        for part in session.scalars(select(SparePart).where(SparePart.model_id == carrier_model.id)).all()
    }
    session.add_all(
        [
            InspectionItem(
                inspection_id=inspection.id,
                spare_part_id=parts["CT-12"].id,
                quantity=2,
                condition="cambio",
                note="Quemado, no enciende.",
            ),
            InspectionItem(
                inspection_id=inspection.id,
                spare_part_id=parts["FLT-01"].id,
                quantity=1,
                condition="instalacion",
            ),
            InspectionItem(
                inspection_id=inspection.id,
                spare_part_id=parts["SEN-T"].id,
                quantity=1,
                condition="desinstalacion",
                note="Marca fuera de rango.",
            ),
        ]
    )
    session.commit()
    logger.info(
        "Datos iniciales listos. admin/admin123, encargado/encargado123, jperez/tecnico123, mlopez/tecnico123"
    )
