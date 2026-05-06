"""
Orchestration relevé : OCR → features → anomalie → persistance.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Alert, AppSetting, History, Reading, User
from models.anomaly import AnomalyContext, SEASON_COEF, anomaly_detector, season_from_month
from models.yolo_ocr import meter_ocr
from settings import settings

logger = logging.getLogger(__name__)


def _today_start_utc() -> datetime:
    now = datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _last_meter_index(db: Session, user_id: int) -> float | None:
    r = (
        db.query(Reading)
        .filter(Reading.user_id == user_id, Reading.meter_index_m3.isnot(None))
        .order_by(Reading.timestamp.desc())
        .first()
    )
    if r is None:
        return None
    return float(r.meter_index_m3)


def _rolling_and_prev(db: Session, user_id: int) -> tuple[float, float | None]:
    prev_rows = (
        db.query(Reading)
        .filter(Reading.user_id == user_id)
        .order_by(Reading.timestamp.desc())
        .limit(8)
        .all()
    )
    if not prev_rows:
        return 0.0, None
    prev_consumption = float(prev_rows[0].consumption_m3)
    vals = [float(r.consumption_m3) for r in prev_rows[:7]]
    rolling = sum(vals) / len(vals) if vals else prev_consumption
    return rolling, prev_consumption


def _get_price(db: Session) -> float:
    row = db.query(AppSetting).filter(AppSetting.key == "price_per_m3").first()
    if row:
        try:
            return float(row.value)
        except ValueError:
            pass
    return settings.DEFAULT_PRICE_PER_M3


def _upsert_history(db: Session, user_id: int) -> None:
    start = _today_start_utc()
    rows = (
        db.query(Reading)
        .filter(Reading.user_id == user_id, Reading.timestamp >= start)
        .order_by(Reading.timestamp.asc())
        .all()
    )
    total = sum(float(r.consumption_m3) for r in rows)
    n = len(rows) or 1
    avg = total / n
    price = _get_price(db)
    anom = sum(1 for r in rows if (r.anomaly_name or "normal") != "normal")
    d = start.date()
    h = db.query(History).filter(History.user_id == user_id, History.date == d).first()
    if h is None:
        h = History(
            user_id=user_id,
            date=d,
            total_consumption_m3=total,
            avg_consumption=avg,
            price_estimate_dt=round(total * price, 2),
            anomaly_count=anom,
        )
        db.add(h)
    else:
        h.total_consumption_m3 = total
        h.avg_consumption = avg
        h.price_estimate_dt = round(total * price, 2)
        h.anomaly_count = anom


def process_image_upload(
    db: Session,
    *,
    user_id: int,
    building_type: str,
    image_bytes: bytes,
    filename: str,
) -> dict[str, Any]:
    logger.info(f"[UPLOAD] Starting upload for user_id={user_id}, image_size={len(image_bytes)} bytes")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"[UPLOAD] User {user_id} not found")
        raise ValueError("Utilisateur introuvable")
    logger.info(f"[UPLOAD] User found: {user.email}")

    try:
        ocr = meter_ocr.read_meter(image_bytes)
        logger.info(f"[UPLOAD] OCR result: {ocr}")
    except Exception as e:
        logger.error(f"[UPLOAD] OCR failed: {e}")
        raise

    raw = str(ocr.get("raw_reading") or "")
    meter_index_m3 = float(
        ocr.get("meter_index_m3")
        if ocr.get("meter_index_m3") is not None
        else ocr.get("consumption_m3")
        or 0.0
    )
    backend = ocr.get("backend", "")
    logger.info(f"[UPLOAD] Parsed: raw={raw}, meter_index={meter_index_m3}, backend={backend}")

    # Save image first (always save, even if OCR is simulated)
    ts = datetime.utcnow()
    subdir = settings.UPLOAD_DIR / str(user_id)
    subdir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "capture.jpg").suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png"):
        ext = ".jpg"
    rel = f"{user_id}/{uuid.uuid4().hex}{ext}"
    out_path = settings.UPLOAD_DIR / rel
    logger.info(f"[UPLOAD] Saving to: {out_path}")

    try:
        out_path.write_bytes(image_bytes)
        logger.info(f"[UPLOAD] File saved successfully")
    except Exception as e:
        logger.error(f"[UPLOAD] File save failed: {e}")
        raise

    # Skip reading/alert if OCR is simulated (no actual detection)
    # But create a dummy reading with consumption=0 so frontend can show image
    if backend == "simulated":
        logger.warning(f"[UPLOAD] OCR simulated, creating dummy reading with consumption=0")
        reading = Reading(
            user_id=user_id,
            raw_reading=raw,
            consumption_m3=0.0,
            meter_index_m3=meter_index_m3,
            timestamp=ts,
            image_path=rel,
            anomaly_name="normal",
            anomaly_confidence=0.0,
        )
        db.add(reading)
        db.commit()
        logger.info(f"[UPLOAD] Dummy reading saved with image_path={rel}")
        return {
            "raw_reading": raw,
            "meter_index_m3": meter_index_m3,
            "meter_index_m3": meter_index_m3,
            "consumption_m3": 0.0,
            "confidence": ocr.get("confidence", 0),
            "backend": backend,
            "note": ocr.get("note", ""),
            "skipped": True,
            "image_path": rel,
        }

    prev_index = _last_meter_index(db, user_id)
    if prev_index is not None:
        consumption_delta_m3 = max(0.0, round(meter_index_m3 - prev_index, 6))
    else:
        consumption_delta_m3 = 0.0

    rolling, prev = _rolling_and_prev(db, user_id)
    logger.info(
        f"[UPLOAD] History: rolling_avg={rolling}, prev_delta={prev}, "
        f"meter_index={meter_index_m3}, delta={consumption_delta_m3}"
    )

    ctx = AnomalyContext(
        building_type=building_type or user.building_type,
        consumption_m3=consumption_delta_m3,
        timestamp=ts,
        rolling_avg_7d=rolling if rolling > 0 else consumption_delta_m3,
        prev_consumption=prev,
    )
    logger.info(f"[UPLOAD] AnomalyContext created")

    try:
        pred = anomaly_detector.predict(ctx)
        logger.info(f"[UPLOAD] Anomaly prediction: {pred}")
    except Exception as e:
        logger.error(f"[UPLOAD] Anomaly detection failed: {e}")
        raise

    reading = Reading(
        user_id=user_id,
        raw_reading=raw,
        consumption_m3=consumption_delta_m3,
        meter_index_m3=meter_index_m3,
        timestamp=ts,
        image_path=rel,
        anomaly_name=pred["anomaly_name"],
        anomaly_confidence=pred["confidence"],
    )
    db.add(reading)
    logger.info(f"[UPLOAD] Reading added to session")

    try:
        db.flush()
        logger.info(f"[UPLOAD] DB flush successful, reading.id={reading.id}")
    except Exception as e:
        logger.error(f"[UPLOAD] DB flush failed: {e}")
        raise

    if pred["anomaly_name"] != "normal":
        logger.info(f"[UPLOAD] Creating alert for anomaly: {pred['anomaly_name']}")
        alert = Alert(
            user_id=user_id,
            reading_id=reading.id,
            anomaly_type=int(pred["anomaly_type"]),
            anomaly_name=pred["anomaly_name"],
            confidence=float(pred["confidence"]),
            message=str(pred.get("message") or ""),
            resolved=False,
            created_at=ts,
            consumption_m3=consumption_delta_m3,
        )
        db.add(alert)

    try:
        _upsert_history(db, user_id)
        logger.info(f"[UPLOAD] History upserted")
    except Exception as e:
        logger.error(f"[UPLOAD] History upsert failed: {e}")
        raise

    try:
        db.commit()
        logger.info(f"[UPLOAD] DB committed")
    except Exception as e:
        logger.error(f"[UPLOAD] DB commit failed: {e}")
        raise

    db.refresh(reading)
    logger.info(f"[UPLOAD] Complete!")

    return {
        "reading_id": reading.id,
        "raw_reading": raw,
        "meter_index_m3": meter_index_m3,
        "consumption_m3": consumption_delta_m3,
        "ocr_confidence": ocr.get("confidence"),
        "ocr_backend": ocr.get("backend"),
        "anomaly": pred,
        "image_stored": rel,
    }


def current_reading_payload(db: Session, user_id: int) -> dict[str, Any]:
    from settings import settings as app_settings
    from models.yolo_ocr import meter_ocr
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Utilisateur introuvable")
    r = (
        db.query(Reading)
        .filter(Reading.user_id == user_id)
        .order_by(Reading.timestamp.desc())
        .first()
    )
    # Check for newer image in filesystem
    user_dir = app_settings.UPLOAD_DIR / str(user_id)
    latest_file = None
    latest_mtime = 0.0
    if user_dir.exists():
        files = sorted(
            [f for f in user_dir.iterdir() if f.is_file()],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )
        if files:
            latest_file = files[0]
            latest_mtime = latest_file.stat().st_mtime
    # Always use latest image from filesystem for live OCR
    if latest_file:
        image_bytes = latest_file.read_bytes()
        ocr = meter_ocr.read_meter(image_bytes)
        idx = ocr.get("meter_index_m3")
        raw = ocr.get("raw_reading")
        season = season_from_month(datetime.utcnow().month)
        
        # Compute delta if we have a previous reading
        consumption = 0.0
        if r and r.meter_index_m3 is not None and idx is not None:
            consumption = max(0.0, float(idx) - float(r.meter_index_m3))
        
        # Check if this exact image file was already processed by ANY reading
        image_ts = datetime.fromtimestamp(latest_mtime)
        rel_path = f"{user_id}/{latest_file.name}"
        existing_reading = db.query(Reading).filter(Reading.user_id == user_id, Reading.image_path == rel_path).first()
        
        if existing_reading:
            # File already processed — return the existing reading data
            season = season_from_month(existing_reading.timestamp.month)
            status = "alert" if (existing_reading.anomaly_name and existing_reading.anomaly_name != "normal") else "normal"
            return {
                "consumption_m3": float(existing_reading.consumption_m3),
                "meter_index_m3": float(existing_reading.meter_index_m3) if existing_reading.meter_index_m3 is not None else None,
                "raw_reading": existing_reading.raw_reading,
                "anomaly_name": existing_reading.anomaly_name or "normal",
                "status": status,
                "timestamp": existing_reading.timestamp.isoformat() + "Z",
                "building_type": user.building_type,
                "season": season,
                "season_coefficient": SEASON_COEF[season],
                "ocr_backend": ocr.get("backend"),
                "ocr_note": ocr.get("note"),
            }
        
        # New file — process it, run anomaly detection and save to DB
        from models.anomaly import anomaly_detector
        ctx = AnomalyContext(
            building_type=user.building_type,
            consumption_m3=consumption,
            timestamp=image_ts,
            rolling_avg_7d=consumption,
            prev_consumption=consumption,
        )
        pred = anomaly_detector.predict(ctx)
        
        new_reading = Reading(
            user_id=user_id,
            raw_reading=raw or "",
            consumption_m3=consumption,
            meter_index_m3=float(idx) if idx else None,
            timestamp=image_ts,
            image_path=rel_path,
            anomaly_name=pred["anomaly_name"],
            anomaly_confidence=pred["confidence"],
        )
        db.add(new_reading)
        db.commit()
        
        # Create alert if anomaly detected
        if pred["anomaly_name"] != "normal":
            alert = Alert(
                user_id=user_id,
                reading_id=new_reading.id,
                anomaly_type=int(pred["anomaly_type"]),
                anomaly_name=pred["anomaly_name"],
                confidence=float(pred["confidence"]),
                message=str(pred.get("message") or ""),
                resolved=False,
                created_at=image_ts,
                consumption_m3=consumption,
            )
            db.add(alert)
            db.commit()
        
        return {
            "consumption_m3": consumption,
            "meter_index_m3": float(idx) if idx is not None else None,
            "raw_reading": raw,
            "anomaly_name": pred["anomaly_name"],
            "status": "alert" if pred["anomaly_name"] != "normal" else "normal",
            "timestamp": image_ts.isoformat() + "Z",
            "building_type": user.building_type,
            "season": season,
            "season_coefficient": SEASON_COEF[season],
            "ocr_backend": ocr.get("backend"),
            "ocr_note": ocr.get("note"),
        }
    if not r:
        return {
            "consumption_m3": 0.0,
            "meter_index_m3": None,
            "raw_reading": None,
            "anomaly_name": "normal",
            "status": "Aucun relevé",
            "timestamp": None,
            "building_type": user.building_type,
            "season": season_from_month(datetime.utcnow().month),
            "season_coefficient": SEASON_COEF[season_from_month(datetime.utcnow().month)],
        }
    season = season_from_month(r.timestamp.month)
    status = "normal" if (r.anomaly_name or "normal") == "normal" else "alert"
    return {
        "consumption_m3": float(r.consumption_m3),
        "meter_index_m3": float(r.meter_index_m3) if r.meter_index_m3 is not None else None,
        "raw_reading": r.raw_reading,
        "anomaly_name": r.anomaly_name or "normal",
        "status": status,
        "timestamp": r.timestamp.isoformat() + "Z",
        "building_type": user.building_type,
        "season": season,
        "season_coefficient": SEASON_COEF[season],
    }


def history_payload(db: Session, user_id: int, period: str) -> list[dict[str, Any]]:
    now = datetime.utcnow()
    if period == "day":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    rows = (
        db.query(Reading)
        .filter(Reading.user_id == user_id, Reading.timestamp >= start)
        .order_by(Reading.timestamp.asc())
        .all()
    )
    return [
        {
            "date": r.timestamp.date().isoformat(),
            "consumption_m3": float(r.consumption_m3),
            "anomaly_name": r.anomaly_name or "normal",
            "timestamp": r.timestamp.isoformat() + "Z",
        }
        for r in rows
    ]


def chart_payload(db: Session, user_id: int) -> list[dict[str, Any]]:
    start = _today_start_utc()
    rows = (
        db.query(Reading)
        .filter(Reading.user_id == user_id, Reading.timestamp >= start)
        .order_by(Reading.timestamp.asc())
        .all()
    )
    buckets: dict[int, float] = {h: 0.0 for h in range(24)}
    for r in rows:
        buckets[r.timestamp.hour] += float(r.consumption_m3)
    out = []
    for hour in range(24):
        is_night = hour >= 22 or hour <= 5
        out.append({"hour": hour, "consumption_m3": round(buckets[hour], 4), "is_night": is_night})
    return out


def stats_payload(db: Session, user_id: int) -> dict[str, Any]:
    now = datetime.utcnow()
    start_m = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start_m.month == 1:
        prev_start = datetime(start_m.year - 1, 12, 1)
    else:
        prev_start = datetime(start_m.year, start_m.month - 1, 1)

    def sum_range(start: datetime, end_exclusive: datetime | None) -> tuple[float, int]:
        q = db.query(func.coalesce(func.sum(Reading.consumption_m3), 0.0), func.count(Reading.id)).filter(
            Reading.user_id == user_id,
            Reading.timestamp >= start,
            Reading.timestamp <= now,
        )
        if end_exclusive is not None:
            q = q.filter(Reading.timestamp < end_exclusive)
        row = q.one()
        return float(row[0] or 0), int(row[1] or 0)

    total_cur, n_cur = sum_range(start_m, None)
    total_prev, n_prev = sum_range(prev_start, start_m)

    days_cur = max((now - start_m).days + 1, 1)
    avg_daily = total_cur / days_cur
    price = _get_price(db)
    alerts_m = (
        db.query(func.count(Alert.id))
        .filter(
            Alert.user_id == user_id,
            Alert.created_at >= start_m,
        )
        .scalar()
        or 0
    )
    cmp_pct = 0.0
    if total_prev > 1e-6:
        cmp_pct = round((total_cur - total_prev) / total_prev * 100.0, 1)

    price_dt = 0.0 if total_cur <= 0 else round(total_cur * price, 2)

    return {
        "total_month_m3": round(total_cur, 3),
        "avg_daily_m3": round(avg_daily, 4),
        "price_estimate_dt": price_dt,
        "nb_alerts_month": int(alerts_m),
        "comparison_last_month_percent": cmp_pct,
    }
