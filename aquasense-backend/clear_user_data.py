from database import get_db, Reading, Alert, History

db = next(get_db())
# Clear readings for user 4
readings = db.query(Reading).filter(Reading.user_id == 4).all()
for r in readings:
    db.delete(r)

# Clear alerts for user 4
alerts = db.query(Alert).filter(Alert.user_id == 4).all()
for a in alerts:
    db.delete(a)

# Clear history for user 4
history = db.query(History).filter(History.user_id == 4).all()
for h in history:
    db.delete(h)

db.commit()
print(f'Cleared {len(readings)} readings, {len(alerts)} alerts, {len(history)} history records for user 4')
