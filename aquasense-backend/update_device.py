from database import get_db, Device

db = next(get_db())
devices = db.query(Device).filter(Device.user_id == 4).all()
for d in devices:
    d.building_type = 'hotel'
db.commit()
print(f'Updated {len(devices)} devices to hotel')
