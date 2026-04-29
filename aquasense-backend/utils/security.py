"""Hachage mots de passe (bcrypt) et JWT."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import User
from settings import settings


def hash_password(plain: str) -> str:
    """Hachage bcrypt ; chaîne ASCII stockée en base (colonne str)."""
    raw = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return raw.decode("ascii")


def verify_password(plain: str, password_hash: str) -> bool:
    """Compare le mot de passe au hash bcrypt (robuste aux espaces / encodage)."""
    if not plain or not password_hash:
        return False
    stored = (password_hash or "").strip()
    if not stored.startswith("$2"):
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("ascii"))
    except (ValueError, TypeError):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except (ValueError, TypeError):
            return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def get_user_from_token(db: Session, token: str) -> User | None:
    try:
        data = decode_token(token)
        uid = int(data.get("sub", "0"))
    except (JWTError, ValueError, TypeError):
        return None
    return db.query(User).filter(User.id == uid).first()
