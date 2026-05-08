"""Upload test image to backend as ESP32 device."""
import urllib.request
from pathlib import Path

# Image path and device - use the latest image in uploads/4
upload_dir = Path(__file__).parent / "uploads" / "4"
files = sorted(upload_dir.glob("*.*"), key=lambda p: p.stat().st_mtime, reverse=True)
files = [f for f in files if f.suffix.lower() in (".jpg", ".jpeg", ".png")]
if not files:
    raise SystemExit(f"Aucune image dans {upload_dir}")

image_path = files[0]
print(f"Using latest image: {image_path.name}")
device_id = "ESP32-AQUASENSE-01"

url = f"http://127.0.0.1:8000/readings/esp32/device/{device_id}"
image_bytes = image_path.read_bytes()

print(f"Uploading {len(image_bytes)} bytes to {url}...")
req = urllib.request.Request(url, data=image_bytes, headers={"Content-Type": "application/octet-stream"}, method="POST")
resp = urllib.request.urlopen(req)
print(f"Status: {resp.status}")
print(resp.read().decode())
