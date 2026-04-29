"""Relevés compteur (upload + consultations)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models.anomaly import BUILDING_TYPES
from services import reading_service

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post("/upload")
async def upload_reading(
    db: Session = Depends(get_db),
    image: UploadFile = File(...),
    user_id: int = Form(...),
    building_type: str = Form("maison"),
):
    bt = (building_type or "maison").lower().strip()
    if bt not in BUILDING_TYPES:
        bt = "maison"
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Fichier image requis")
    data = await image.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 10 Mo)")
    try:
        out = reading_service.process_image_upload(
            db,
            user_id=user_id,
            building_type=bt,
            image_bytes=data,
            filename=image.filename or "capture.jpg",
        )
        return {"success": True, "data": out}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Traitement impossible: {e!s}")


@router.get("/current")
def readings_current(user_id: int, db: Session = Depends(get_db)):
    try:
        return reading_service.current_reading_payload(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/history")
def readings_history(user_id: int, period: str = "week", db: Session = Depends(get_db)):
    if period not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="period doit être day, week ou month")
    return reading_service.history_payload(db, user_id, period)


@router.get("/chart")
def readings_chart(user_id: int, db: Session = Depends(get_db)):
    return reading_service.chart_payload(db, user_id)


@router.get("/stats")
def readings_stats(user_id: int, db: Session = Depends(get_db)):
    return reading_service.stats_payload(db, user_id)
