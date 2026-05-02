"""
SQLite + SQLAlchemy ORM (AquaSense - FULL VERSION)
Includes: users, devices, readings, alerts, history, settings
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Generator

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


# ============================================================
# BASE
# ============================================================
class Base(DeclarativeBase):
    pass


# ============================================================
# USERS
# ============================================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    prenom: Mapped[str] = mapped_column(String(120), nullable=False)
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    telephone: Mapped[str] = mapped_column(String(64), default="")
    adresse: Mapped[str] = mapped_column(Text, default="")
    building_type: Mapped[str] = mapped_column(String(64), default="maison")

    is_configured: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # relations
    readings: Mapped[list["Reading"]] = relationship(back_populates="user")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")
    devices: Mapped[list["Device"]] = relationship(back_populates="user")


# ============================================================
# DEVICES ( NEW - IMPORTANT FOR ESP32)
# ============================================================
class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    device_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
        nullable=False,
    )

    building_type: Mapped[str] = mapped_column(String(64), default="maison")
    capture_interval: Mapped[int] = mapped_column(Integer, default=900)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # relation
    user: Mapped["User"] = relationship(back_populates="devices")


# ============================================================
# READINGS
# ============================================================
class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    raw_reading: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Volume consommé sur l'intervalle depuis le dernier relevé (m³) — utilisé graphes / alertes.
    consumption_m3: Mapped[float] = mapped_column(Float, nullable=False)
    # Index cumulatif affiché sur le compteur (m³), pour calculer le delta au relevé suivant.
    meter_index_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    anomaly_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    anomaly_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # relations
    user: Mapped["User"] = relationship(back_populates="readings")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="reading")


# ============================================================
# ALERTS
# ============================================================
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    reading_id: Mapped[int | None] = mapped_column(ForeignKey("readings.id"), nullable=True)

    anomaly_type: Mapped[int] = mapped_column(Integer, default=0)
    anomaly_name: Mapped[str] = mapped_column(String(64), nullable=False)

    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str] = mapped_column(Text, default="")

    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    consumption_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    # relations
    user: Mapped["User"] = relationship(back_populates="alerts")
    reading: Mapped["Reading | None"] = relationship(back_populates="alerts")


# ============================================================
# HISTORY
# ============================================================
class History(Base):
    __tablename__ = "history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    date: Mapped[date] = mapped_column(Date, index=True)

    total_consumption_m3: Mapped[float] = mapped_column(Float, default=0.0)
    avg_consumption: Mapped[float] = mapped_column(Float, default=0.0)

    price_estimate_dt: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0)


# ============================================================
# SETTINGS
# ============================================================
class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(String(512), nullable=False)


# ============================================================
# DATABASE ENGINE
# ============================================================
from settings import settings as app_settings  # noqa

_sqlite_path = app_settings.DATA_DIR / "aquasense.db"

_engine = create_engine(
    f"sqlite:///{_sqlite_path}",
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


# ============================================================
# INIT DB
# ============================================================
def _ensure_readings_meter_index_column() -> None:
    with _engine.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(readings)")).fetchall()
        cols = {r[1] for r in rows}
        if "meter_index_m3" not in cols:
            conn.execute(text("ALTER TABLE readings ADD COLUMN meter_index_m3 FLOAT"))
            conn.commit()


def init_db():
    Base.metadata.create_all(bind=_engine)
    _ensure_readings_meter_index_column()


# ============================================================
# GET DB SESSION
# ============================================================
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# SEED DATABASE (DEMO DATA)
# ============================================================
def seed_database():
    from utils.security import hash_password

    db = SessionLocal()

    try:
        if db.query(User).first():
            return

        # USERS
        u1 = User(
            prenom="Demo",
            nom="User",
            email="demo@aquasense.tn",
            password_hash=hash_password("1234"),
            building_type="maison",
        )

        db.add(u1)
        db.flush()

        # DEVICE LINKED TO USER
        d1 = Device(
            device_id="ESP32-AQUASENSE-01",
            user_id=u1.id,
            name="Salon ESP32",
        )

        db.add(d1)

        db.commit()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()