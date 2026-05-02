from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db, User, Reading, Device
from services import reading_service
from settings import settings as app_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/readings", tags=["readings"])


# ============================================================
# ESP32 UPLOAD (DEVICE-BASED - FINAL ARCHITECTURE)
# ============================================================
@router.post("/esp32/device/{device_id}")
async def upload_from_esp32(
    device_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    print(f"[ESP32] Received upload from device_id: {device_id}")
    
    data = await request.body()

    if not data:
        raise HTTPException(status_code=400, detail="Image vide")

    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 10 Mo)")

    # 🔥 Find device
    device = db.query(Device).filter(Device.device_id == device_id).first()
    print(f"[ESP32] Found device: {device}")

    if not device:
        print(f"[ESP32] ERROR: Device {device_id} not found")
        raise HTTPException(status_code=404, detail="Device introuvable")

    # 🔥 Find user linked to device
    user = db.query(User).filter(User.id == device.user_id).first()
    print(f"[ESP32] Device {device_id} belongs to user {device.user_id}")

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    building_type = getattr(user, "building_type", "maison") or "maison"

    try:
        out = reading_service.process_image_upload(
            db,
            user_id=user.id,
            building_type=building_type,
            image_bytes=data,
            filename="esp32_capture.jpg",
        )

        print(f"[ESP32] Saved image for user {user.id} in uploads/{user.id}/")
        return {
            "success": True,
            "device_id": device_id,
            "user_id": user.id,
            "data": out,
        }

    except Exception as e:
        import traceback
        error_msg = f"ESP32 upload error: {e}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# LATEST IMAGE (CLEAN VERSION)
# ============================================================
@router.get("/latest-image")
def latest_image(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    base_url = str(request.base_url).rstrip("/")

    user_dir = app_settings.UPLOAD_DIR / str(user_id)

    # 1. check filesystem
    if user_dir.exists():
        files = sorted(
            [f for f in user_dir.iterdir() if f.is_file()],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        if files:
            latest = files[0]
            return {
                "image_url": f"{base_url}/uploads/{user_id}/{latest.name}",
                "timestamp": datetime.fromtimestamp(latest.stat().st_mtime).isoformat() + "Z",
            }

    # 2. fallback DB
    r = (
        db.query(Reading)
        .filter(Reading.user_id == user_id, Reading.image_path.isnot(None))
        .order_by(Reading.timestamp.desc())
        .first()
    )

    if not r:
        return {"image_url": None, "timestamp": None}

    path = str(r.image_path).lstrip("/")
    return {
        "image_url": f"{base_url}/{path}",
        "timestamp": r.timestamp.isoformat() + "Z",
    }


# ============================================================
# CURRENT READING (USER-BASED - BACKWARD COMPATIBILITY)
# ============================================================
@router.get("/current")
def current_reading(user_id: int, db: Session = Depends(get_db)):
    return reading_service.current_reading_payload(db, user_id)


# ============================================================
# CURRENT READING (DEVICE-BASED - FOR ESP32/MONITORING)
# ============================================================
@router.get("/current/device/{device_id}")
def current_reading_by_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device introuvable")
    return reading_service.current_reading_payload(db, device.user_id)


# ============================================================
# LATEST IMAGE (DEVICE-BASED - FOR ESP32/MONITORING)
# ============================================================
@router.get("/latest-image/device/{device_id}")
def latest_image_by_device(
    device_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    print(f"[LATEST] Request for device {device_id}")
    
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        print(f"[LATEST] ERROR: Device {device_id} not found")
        raise HTTPException(status_code=404, detail="Device introuvable")

    user = db.query(User).filter(User.id == device.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    print(f"[LATEST] Device {device_id} -> user {device.user_id}, checking uploads/{device.user_id}/")
    
    base_url = str(request.base_url).rstrip("/")
    user_dir = app_settings.UPLOAD_DIR / str(user.id)

    # 1. check filesystem
    if user_dir.exists():
        files = sorted(
            [f for f in user_dir.iterdir() if f.is_file()],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        if files:
            latest = files[0]
            result = {
                "image_url": f"{base_url}/uploads/{user.id}/{latest.name}",
                "timestamp": datetime.fromtimestamp(latest.stat().st_mtime).isoformat() + "Z",
            }
            print(f"[LATEST] Found file: {latest.name} for user {user.id}")
            return result

    # 2. fallback DB
    r = (
        db.query(Reading)
        .filter(Reading.user_id == user.id, Reading.image_path.isnot(None))
        .order_by(Reading.timestamp.desc())
        .first()
    )

    if not r:
        return {"image_url": None, "timestamp": None}

    path = str(r.image_path).lstrip("/")
    return {
        "image_url": f"{base_url}/{path}",
        "timestamp": r.timestamp.isoformat() + "Z",
    }


# ============================================================
# OTHER ROUTES (USER-BASED - BACKWARD COMPATIBILITY)
# ============================================================
@router.get("/history")
def readings_history(user_id: int, period: str = "week", db: Session = Depends(get_db)):
    return reading_service.history_payload(db, user_id, period)


@router.get("/chart")
def readings_chart(user_id: int, db: Session = Depends(get_db)):
    return reading_service.chart_payload(db, user_id)


@router.get("/stats")
def readings_stats(user_id: int, db: Session = Depends(get_db)):
    return reading_service.stats_payload(db, user_id)