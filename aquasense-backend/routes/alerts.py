"""Alertes anomalies."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Alert, get_db

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(user_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Alert)
        .filter(Alert.user_id == user_id)
        .order_by(Alert.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": a.id,
            "anomaly_type": a.anomaly_type,
            "anomaly_name": a.anomaly_name,
            "message": a.message or "",
            "confidence": float(a.confidence or 0),
            "timestamp": a.created_at.isoformat() + "Z",
            "resolved": bool(a.resolved),
            "consumption_m3": float(a.consumption_m3) if a.consumption_m3 is not None else None,
        }
        for a in rows
    ]


@router.patch("/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    a.resolved = True
    db.commit()
    return {"message": "Alerte résolue"}


@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    db.delete(a)
    db.commit()
    return {"message": "Alerte supprimée"}
