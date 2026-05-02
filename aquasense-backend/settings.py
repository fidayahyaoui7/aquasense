"""
Configuration application (env + chemins modèles).
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path


def _get_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [x.strip() for x in raw.split(",") if x.strip()]


class AppConfig:
    APP_NAME: str = "AquaSense API"
    SECRET_KEY: str = os.getenv("AQUASENSE_SECRET_KEY", secrets.token_urlsafe(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.getenv("AQUASENSE_JWT_DAYS", "30"))

    DATABASE_URL: str = os.getenv("AQUASENSE_DATABASE_URL", "sqlite:///./data/aquasense.db")
    CORS_ORIGINS: list[str] = _get_list(
        "AQUASENSE_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:5176,http://127.0.0.1:5176"
    )
    CORS_ORIGIN_REGEX: str = os.getenv(
        "AQUASENSE_CORS_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$"
    )
    DEFAULT_PRICE_PER_M3: float = float(os.getenv("AQUASENSE_PRICE_PER_M3", "1.85"))
    CURRENCY: str = os.getenv("AQUASENSE_CURRENCY", "DT")

    BASE_DIR: Path = Path(__file__).resolve().parent
    DATA_DIR: Path = BASE_DIR / "data"
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    AI_MODELS_DIR: Path = BASE_DIR / "ai_models"


settings = AppConfig()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.AI_MODELS_DIR.mkdir(parents=True, exist_ok=True)
