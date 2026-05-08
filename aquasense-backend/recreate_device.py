from database import get_db, Device
from datetime import datetime

db = next(get_db())

# Delete existing device if exists
existing = db.query(Device).filter(Device.device_id == 'ESP32-AQUASENSE-01').first()
if existing:
    db.delete(existing)
    db.commit()
    print(f'Deleted existing device: {existing.device_id} from user {existing.user_id}')

# Recreate device ESP32-AQUASENSE-01 for user 4
device = Device(
    device_id='ESP32-AQUASENSE-01',
    user_id=4,
    building_type='hotel',
    capture_interval=900,
    created_at=datetime.utcnow()
)
db.add(device)
db.commit()
print(f'Created device: {device.device_id} for user {device.user_id}')
