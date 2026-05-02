"""Device management endpoints for ESP32 devices."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import Device, User, get_db

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceCreateBody(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=255)
    building_type: str = Field(default="maison", max_length=64)
    capture_interval: int = Field(default=900, ge=60, le=3600)


class DeviceResponse(BaseModel):
    id: int
    device_id: str
    user_id: int
    building_type: str
    capture_interval: int
    created_at: str

    @classmethod
    def from_db(cls, device: Device) -> "DeviceResponse":
        return cls(
            id=device.id,
            device_id=device.device_id,
            user_id=device.user_id,
            building_type=device.building_type,
            capture_interval=device.capture_interval,
            created_at=device.created_at.isoformat(),
        )


def _to_response(device: Device) -> dict:
    return {
        "id": device.id,
        "device_id": device.device_id,
        "user_id": device.user_id,
        "building_type": device.building_type,

        "capture_interval": device.capture_interval,
        "created_at": device.created_at.isoformat(),
    }


@router.get("")
def list_devices(user_id: int, db: Session = Depends(get_db)):
    """List all devices for a given user."""
    devices = db.query(Device).filter(Device.user_id == user_id).all()
    return [_to_response(d) for d in devices]


@router.post("")
def create_device(user_id: int, body: DeviceCreateBody, db: Session = Depends(get_db)):
    """Register a new device for a user."""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Check if device_id already exists
    existing = db.query(Device).filter(Device.device_id == body.device_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device ID déjà utilisé")

    device = Device(
        device_id=body.device_id,
        user_id=user_id,
        building_type=body.building_type,
        capture_interval=body.capture_interval,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {"message": "Device enregistré", "device": _to_response(device)}


@router.get("/{device_id}")
def get_device(device_id: str, db: Session = Depends(get_db)):
    """Get device details by device_id."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device introuvable")
    return _to_response(device)


@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Delete a device by device_id."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device introuvable")
    
    db.delete(device)
    db.commit()
    return {"message": "Device supprimé"}
