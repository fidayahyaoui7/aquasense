"""Upload a specific image file to backend as ESP32 device."""
import urllib.request
from pathlib import Path
import sys

# Get image path from command line or use default
default_path = Path(__file__).parent / "uploads" / "4" / "Capture d'écran 2026-05-03 130802.png"
image_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path

device_id = "ESP32-AQUASENSE-01"

if not image_path.is_file():
    print(f"Image introuvable: {image_path}")
    # List available images
    upload_dir = Path(__file__).parent / "uploads" / "4"
    if upload_dir.exists():
        print("Available images:")
        for f in sorted(upload_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)[:10]:
            print(f"  - {f.name}")
    raise SystemExit(1)

url = f"http://127.0.0.1:8000/readings/esp32/device/{device_id}"
image_bytes = image_path.read_bytes()

print(f"Uploading {image_path.name} ({len(image_bytes)} bytes) to {url}...")
req = urllib.request.Request(url, data=image_bytes, headers={"Content-Type": "application/octet-stream"}, method="POST")
resp = urllib.request.urlopen(req)
print(f"Status: {resp.status}")
print(resp.read().decode())
