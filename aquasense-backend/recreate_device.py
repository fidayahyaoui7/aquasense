from database import get_db, Device
from datetime import datetime

db = next(get_db())
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
