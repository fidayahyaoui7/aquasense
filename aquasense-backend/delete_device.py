from database import get_db, Device

db = next(get_db())
# Delete device ESP32-AQUASENSE-01
device = db.query(Device).filter(Device.device_id == 'ESP32-AQUASENSE-01').first()
if device:
    db.delete(device)
    db.commit()
    print(f'Deleted device: {device.device_id}')
else:
    print('Device not found')
