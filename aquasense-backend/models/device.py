"""Modèle Device pour ESP32."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Exemple : "ESP32-A1B2C3" — identifiant unique de la carte

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Lien vers la table users

    building_type: Mapped[str] = mapped_column(String(64), default="maison")
    # Type de bâtiment : "maison", "appartement", "bureau", etc.

    capture_interval: Mapped[int] = mapped_column(Integer, default=900)
    # Intervalle de capture en secondes (défaut : 15 min)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)

    # ─── Relation vers User ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="devices")
