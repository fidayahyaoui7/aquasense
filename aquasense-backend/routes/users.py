"""Profil utilisateur."""

from __future__ import annotations

import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import User, get_db
from models.anomaly import BUILDING_TYPES
from utils.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdateBody(BaseModel):
    prenom: str | None = None
    nom: str | None = None
    email: str | None = None
    telephone: str | None = None
    adresse: str | None = None
    building_type: str | None = None


class PasswordUpdateBody(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


def _normalize_building_type(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return normalized.encode('ascii', 'ignore').decode('utf-8').strip().lower()


def _public(u: User) -> dict:
    return {
        "id": u.id,
        "prenom": u.prenom,
        "nom": u.nom,
        "email": u.email,
        "telephone": u.telephone or "",
        "adresse": u.adresse or "",
        "building_type": u.building_type,
        "is_configured": u.is_configured,
    }


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return _public(u)


@router.put("/{user_id}")
def update_user(user_id: int, body: UserUpdateBody, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if body.prenom is not None:
        u.prenom = body.prenom.strip()
    if body.nom is not None:
        u.nom = body.nom.strip()
    if body.email is not None:
        exists = db.query(User).filter(User.email == str(body.email).lower(), User.id != user_id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        u.email = str(body.email).lower().strip()
    if body.telephone is not None:
        u.telephone = body.telephone.strip()
    if body.adresse is not None:
        u.adresse = body.adresse.strip()
    if body.building_type is not None:
        bt_normalized = _normalize_building_type(body.building_type)
        if bt_normalized in BUILDING_TYPES:
            u.building_type = bt_normalized
            # Sync building_type to all user's devices
            for device in u.devices:
                device.building_type = bt_normalized
    # Set is_configured to True when both building_type and adresse are provided
    if body.building_type is not None and body.adresse is not None:
        if body.building_type.strip() and body.adresse.strip():
            u.is_configured = True
    db.commit()
    db.refresh(u)
    return {"message": "Profil mis à jour", "user": _public(u)}


@router.put("/{user_id}/password")
def update_password(user_id: int, body: PasswordUpdateBody, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if not verify_password(body.old_password, u.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    u.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Mot de passe mis à jour"}
