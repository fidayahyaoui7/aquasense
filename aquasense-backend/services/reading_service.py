"""
Orchestration relevé : OCR → features → anomalie → persistance.
"""

from __future__ import annotations

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


def _today_start_utc() -> datetime:
    now = datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


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
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Utilisateur introuvable")

    ocr = meter_ocr.read_meter(image_bytes)
    raw = str(ocr.get("raw_reading") or "")
    consumption_m3 = float(ocr.get("consumption_m3") or 0.0)

    rolling, prev = _rolling_and_prev(db, user_id)
    ts = datetime.utcnow()
    ctx = AnomalyContext(
        building_type=building_type or user.building_type,
        consumption_m3=consumption_m3,
        timestamp=ts,
        rolling_avg_7d=rolling if rolling > 0 else consumption_m3,
        prev_consumption=prev,
    )
    pred = anomaly_detector.predict(ctx)

    subdir = settings.UPLOAD_DIR / str(user_id)
    subdir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "capture.jpg").suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png"):
        ext = ".jpg"
    rel = f"{user_id}/{uuid.uuid4().hex}{ext}"
    out_path = settings.UPLOAD_DIR / rel
    out_path.write_bytes(image_bytes)

    reading = Reading(
        user_id=user_id,
        raw_reading=raw,
        consumption_m3=consumption_m3,
        timestamp=ts,
        image_path=f"uploads/{rel}",
        anomaly_name=pred["anomaly_name"],
        anomaly_confidence=pred["confidence"],
    )
    db.add(reading)
    db.flush()

    if pred["anomaly_name"] != "normal":
        alert = Alert(
            user_id=user_id,
            reading_id=reading.id,
            anomaly_type=int(pred["anomaly_type"]),
            anomaly_name=pred["anomaly_name"],
            confidence=float(pred["confidence"]),
            message=str(pred.get("message") or ""),
            resolved=False,
            created_at=ts,
            consumption_m3=consumption_m3,
        )
        db.add(alert)

    _upsert_history(db, user_id)
    db.commit()
    db.refresh(reading)

    return {
        "reading_id": reading.id,
        "raw_reading": raw,
        "consumption_m3": consumption_m3,
        "ocr_confidence": ocr.get("confidence"),
        "ocr_backend": ocr.get("backend"),
        "anomaly": pred,
        "image_stored": rel,
    }


def current_reading_payload(db: Session, user_id: int) -> dict[str, Any]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Utilisateur introuvable")
    r = (
        db.query(Reading)
        .filter(Reading.user_id == user_id)
        .order_by(Reading.timestamp.desc())
        .first()
    )
    if not r:
        return {
            "consumption_m3": 0.0,
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
