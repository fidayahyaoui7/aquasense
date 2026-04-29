"""Modèle Device pour ESP32 — gestion des dispositifs de capture."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Identifiant unique du dispositif ESP32 (ex: "ESP32-A1B2C3")

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Lien vers le propriétaire (table users)

    building_type: Mapped[str] = mapped_column(String(64), default="maison")
    # Type de bâtiment : "maison", "appartement", "cafe", "restaurant", "hotel", "immeuble", "usine"
    # Valeurs SONEDE 2023 alignées avec models.anomaly.BUILDING_TYPES

    capture_interval: Mapped[int] = mapped_column(Integer, default=900)
    # Intervalle de capture en secondes (défaut : 15 min = 900 s)
    # Relevé compteur toutes les heures pour calibration SONEDE

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)

    # ─── Relation vers User ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="devices")
