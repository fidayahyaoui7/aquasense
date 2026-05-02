"""Modèle Device pour ESP32 — gestion des dispositifs de capture."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Identifiant unique du dispositif ESP32 (ex: "ESP32-A1B2C3")

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Lien vers le propriétaire (table users)

    name: Mapped[str] = mapped_column(String(128), default="ESP32-CAM")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)

    # ─── Relation vers User ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="devices")
