"""Paramètres globaux (prix SONEDE)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import AppSetting, get_db
from settings import settings as app_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class PriceBody(BaseModel):
    price_per_m3: float = Field(..., gt=0, le=100)


def _get_row(db: Session) -> AppSetting:
    row = db.query(AppSetting).filter(AppSetting.key == "price_per_m3").first()
    if not row:
        row = AppSetting(key="price_per_m3", value=str(app_settings.DEFAULT_PRICE_PER_M3))
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/price")
def get_price(db: Session = Depends(get_db)):
    row = _get_row(db)
    try:
        p = float(row.value)
    except ValueError:
        p = app_settings.DEFAULT_PRICE_PER_M3
    return {"price_per_m3": p, "currency": app_settings.CURRENCY}


@router.put("/price")
def put_price(body: PriceBody, db: Session = Depends(get_db)):
    row = _get_row(db)
    row.value = str(round(body.price_per_m3, 4))
    db.commit()
    return {"message": "Prix mis à jour"}
