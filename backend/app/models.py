from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(20), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    technician: Mapped[Technician | None] = relationship(back_populates="user")


class Technician(Base):
    __tablename__ = "technicians"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    cargo: Mapped[str | None] = mapped_column(String(120))
    dni: Mapped[str | None] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(30))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User | None] = relationship(back_populates="technician")


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    models: Mapped[list[ReeferModel]] = relationship(back_populates="brand")
    machines: Mapped[list[Machine]] = relationship(back_populates="brand")


class ReeferModel(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    manual_file: Mapped[str | None] = mapped_column(String(80))
    manual_name: Mapped[str | None] = mapped_column(String(200))

    brand: Mapped[Brand] = relationship(back_populates="models")
    machines: Mapped[list[Machine]] = relationship(back_populates="model")


class ConditionOption(Base):
    __tablename__ = "condition_options"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, default=1)


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    serial: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("models.id"), index=True)
    location: Mapped[str | None] = mapped_column(String(160))
    year: Mapped[int | None] = mapped_column(Integer)
    machine_photo: Mapped[str | None] = mapped_column(String(80))
    serial_photo: Mapped[str | None] = mapped_column(String(80))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    brand: Mapped[Brand] = relationship(back_populates="machines")
    model: Mapped[ReeferModel] = relationship(back_populates="machines")


class SparePart(Base):
    __tablename__ = "spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("models.id"), index=True)
    code: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(200))
    part_type: Mapped[str | None] = mapped_column(String(80))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    model: Mapped[ReeferModel] = relationship()


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    technician_id: Mapped[int] = mapped_column(ForeignKey("technicians.id"), index=True)
    assigned_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), index=True, default="pendiente")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    machine: Mapped[Machine] = relationship()
    technician: Mapped[Technician] = relationship()
    inspection: Mapped[Inspection | None] = relationship(back_populates="assignment")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), unique=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    technician_id: Mapped[int] = mapped_column(ForeignKey("technicians.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True, default="en_proceso")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    assignment: Mapped[Assignment] = relationship(back_populates="inspection")
    machine: Mapped[Machine] = relationship()
    technician: Mapped[Technician] = relationship()
    items: Mapped[list[InspectionItem]] = relationship(back_populates="inspection", cascade="all, delete-orphan")


class InspectionItem(Base):
    __tablename__ = "inspection_items"
    __table_args__ = (UniqueConstraint("inspection_id", "spare_part_id", name="uq_item_part"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), index=True)
    spare_part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    condition: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    inspection: Mapped[Inspection] = relationship(back_populates="items")
    spare_part: Mapped[SparePart] = relationship()
    photos: Mapped[list[InspectionPhoto]] = relationship(back_populates="item", cascade="all, delete-orphan")


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inspection_items.id"), index=True)
    filename: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    item: Mapped[InspectionItem] = relationship(back_populates="photos")


Index("uq_brands_name_lower", func.lower(Brand.name), unique=True)
Index("uq_models_brand_name", ReeferModel.brand_id, func.lower(ReeferModel.name), unique=True)
Index("uq_parts_model_code", SparePart.model_id, func.lower(SparePart.code), unique=True)
Index("uq_parts_model_description", SparePart.model_id, func.lower(SparePart.description), unique=True)
