"""Authentification JWT + inscription."""

from __future__ import annotations

import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import User, get_db
from models.anomaly import BUILDING_TYPES
from utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(value: str) -> str:
    """Même normalisation à l'inscription et au login (strip + minuscules)."""
    return (value or "").strip().lower()


def _normalize_building_type(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return normalized.encode('ascii', 'ignore').decode('utf-8').strip().lower()


class RegisterBody(BaseModel):
    prenom: str = Field(..., min_length=1, max_length=120)
    nom: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    telephone: str = ""
    adresse: str = ""
    building_type: str = "maison"
    password: str = Field(..., min_length=6, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _user_public(u: User) -> dict:
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


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    email_norm = _normalize_email(str(body.email))
    if not email_norm:
        raise HTTPException(status_code=400, detail="Email invalide")
    if db.query(User).filter(User.email == email_norm).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    bt = _normalize_building_type(body.building_type or "maison")
    if bt not in BUILDING_TYPES:
        bt = "maison"
    u = User(
        prenom=body.prenom.strip(),
        nom=body.nom.strip(),
        email=email_norm,
        telephone=(body.telephone or "").strip(),
        adresse=(body.adresse or "").strip(),
        building_type=bt,
        password_hash=hash_password(body.password),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"message": "Inscription réussie", "user_id": u.id}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    email_norm = _normalize_email(str(body.email))
    u = db.query(User).filter(User.email == email_norm).first() if email_norm else None
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides")
    token = create_access_token(str(u.id), {"email": u.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_public(u),
    }