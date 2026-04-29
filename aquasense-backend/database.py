"""
SQLite + SQLAlchemy ORM (tables users, readings, alerts, history, app_settings).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Generator

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prenom: Mapped[str] = mapped_column(String(120), nullable=False)
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    telephone: Mapped[str] = mapped_column(String(64), default="")
    adresse: Mapped[str] = mapped_column(Text, default="")
    building_type: Mapped[str] = mapped_column(String(64), nullable=False, default="maison")
    is_configured: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    readings: Mapped[list["Reading"]] = relationship(back_populates="user")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    raw_reading: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consumption_m3: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    anomaly_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    anomaly_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="readings")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="reading")


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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    consumption_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="alerts")
    reading: Mapped["Reading | None"] = relationship(back_populates="alerts")


class History(Base):
    __tablename__ = "history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    total_consumption_m3: Mapped[float] = mapped_column(Float, default=0.0)
    avg_consumption: Mapped[float] = mapped_column(Float, default=0.0)
    price_estimate_dt: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(String(512), nullable=False)


from settings import settings as app_settings  # noqa: E402

_sqlite_path = app_settings.DATA_DIR / "aquasense.db"
_engine = create_engine(
    f"sqlite:///{_sqlite_path}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def init_db() -> None:
    Base.metadata.create_all(bind=_engine)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_database() -> None:
    """Données de démo (sans ESP32) si la base est vide."""
    from datetime import timedelta

    from utils.security import hash_password

    db = SessionLocal()
    try:
        if not db.query(AppSetting).filter(AppSetting.key == "price_per_m3").first():
            db.add(AppSetting(key="price_per_m3", value="1.85"))
            db.commit()

        if db.query(User).first():
            return

        u1 = User(
            prenom="Demo",
            nom="AquaSense",
            email="demo@aquasense.tn",
            telephone="+216 12 345 678",
            adresse="Avenue Habib Bourguiba, Tunis",
            building_type="maison",
            password_hash=hash_password("password123"),
        )
        u2 = User(
            prenom="Fatma",
            nom="Ben Ali",
            email="fatma@aquasense.tn",
            telephone="+216 98 765 432",
            adresse="Sousse",
            building_type="appartement",
            password_hash=hash_password("password123"),
        )
        db.add_all([u1, u2])
        db.flush()

        now = datetime.utcnow()
        demo_readings: list[Reading] = []
        for hours_ago in range(24):
            ts = now - timedelta(hours=hours_ago)
            base = 0.04 + (hours_ago % 4) * 0.015
            if ts.hour in (23, 2, 3) and hours_ago < 8:
                conso = 0.18
                anom, conf = "fuite_nocturne", 0.72
            elif ts.hour == 14 and hours_ago < 12:
                conso = 0.95
                anom, conf = "surconsommation", 0.68
            else:
                conso = round(base, 4)
                anom, conf = "normal", 0.55
            demo_readings.append(
                Reading(
                    user_id=u1.id,
                    raw_reading="".join(str((hours_ago + i) % 10) for i in range(5)),
                    consumption_m3=conso,
                    timestamp=ts,
                    image_path=None,
                    anomaly_name=anom,
                    anomaly_confidence=conf,
                )
            )
        db.add_all(demo_readings)
        db.flush()

        for r in demo_readings:
            if (r.anomaly_name or "") != "normal":
                db.add(
                    Alert(
                        user_id=u1.id,
                        reading_id=r.id,
                        anomaly_type=2 if r.anomaly_name == "fuite_nocturne" else 1,
                        anomaly_name=r.anomaly_name or "normal",
                        confidence=float(r.anomaly_confidence or 0),
                        message="Alerte générée (données de démo)",
                        resolved=False,
                        created_at=r.timestamp,
                        consumption_m3=float(r.consumption_m3),
                    )
                )

        today = now.date()
        today_rows = [r for r in demo_readings if r.timestamp.date() == today]
        tot_today = sum(float(r.consumption_m3) for r in today_rows)
        avg_today = tot_today / max(len(today_rows), 1)
        anom_today = sum(1 for r in today_rows if (r.anomaly_name or "normal") != "normal")
        db.add(
            History(
                user_id=u1.id,
                date=today,
                total_consumption_m3=tot_today,
                avg_consumption=round(avg_today, 4),
                price_estimate_dt=round(tot_today * 1.85, 2),
                anomaly_count=anom_today,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
