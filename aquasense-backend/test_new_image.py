"""Test OCR on the latest uploaded image."""
from __future__ import annotations
from pathlib import Path
from models.yolo_ocr import meter_ocr

def main() -> None:
    # Use the latest uploaded image
    path = Path(__file__).parent / "uploads" / "4" / "lire-compteur-deau.jpg"
    
    if not path.is_file():
        print(f"Image not found: {path}")
        raise SystemExit("Image file required")
    
    print(f"Testing image: {path}")
    image_bytes = path.read_bytes()
    ocr_result = meter_ocr.read_meter(image_bytes)

    print("\n--- OCR RESULT ---")
    for key, value in ocr_result.items():
        print(f"{key}: {value}")
    
    idx = float(ocr_result.get("meter_index_m3") or ocr_result.get("consumption_m3") or 0.0)
    raw = ocr_result.get("raw_reading", "")
    print(f"\nDetected meter index: {idx} m³")
    print(f"Raw reading: {raw}")
    print(f"\nExpected from image (0013405): 134.05 m³")
    print(f"Expected raw: 0013405")

if __name__ == "__main__":
    main()
