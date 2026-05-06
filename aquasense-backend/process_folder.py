"""Process all images in uploads/4 folder via API to trigger OCR."""
import urllib.request
from pathlib import Path
import sys

upload_dir = Path(__file__).parent / "uploads" / "4"
device_id = "ESP32-AQUASENSE-01"

if not upload_dir.exists():
    raise SystemExit(f"Folder not found: {upload_dir}")

# Get all image files sorted by modification time (newest first)
files = sorted(
    [f for f in upload_dir.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')],
    key=lambda p: p.stat().st_mtime,
    reverse=True
)

if not files:
    raise SystemExit("No images found")

print(f"Found {len(files)} images")

# Process the most recent image
latest = files[0]
print(f"\nProcessing latest: {latest.name}")

url = f"http://127.0.0.1:8000/readings/esp32/device/{device_id}"
image_bytes = latest.read_bytes()

req = urllib.request.Request(url, data=image_bytes, headers={"Content-Type": "application/octet-stream"}, method="POST")
resp = urllib.request.urlopen(req)
result = resp.read().decode()

print(f"Status: {resp.status}")
print(result[:800])
