"""Test OCR on the latest uploaded image."""
from pathlib import Path
from models.yolo_ocr import meter_ocr

# Find latest image in uploads/4
upload_dir = Path(__file__).parent / "uploads" / "4"
files = sorted(upload_dir.glob("*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
if not files:
    raise SystemExit("No images found")

latest = files[0]
print(f"Testing: {latest.name}")

image_bytes = latest.read_bytes()
ocr = meter_ocr.read_meter(image_bytes)

print(f"Raw: {ocr.get('raw_reading')}")
print(f"Index: {ocr.get('meter_index_m3')}")
print(f"Backend: {ocr.get('backend')}")
print(f"Note: {ocr.get('note')}")
