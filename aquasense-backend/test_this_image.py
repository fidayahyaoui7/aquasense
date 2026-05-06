"""Test OCR on the specific meter image."""
from pathlib import Path
from models.yolo_ocr import meter_ocr
import shutil

def main():
    # Path to the image
    src = Path(__file__).parent / "uploads" / "4" / "Compteur_Eau_01.jpg"
    
    if not src.is_file():
        print(f"Image not found: {src}")
        # List available images
        upload_dir = Path(__file__).parent / "uploads" / "4"
        if upload_dir.exists():
            print("Available images:")
            for f in upload_dir.glob("*.jpg"):
                print(f"  - {f.name}")
        return
    
    print(f"Testing image: {src}")
    image_bytes = src.read_bytes()
    ocr = meter_ocr.read_meter(image_bytes)
    
    print(f"\n=== OCR RESULT ===")
    print(f"Raw reading: {ocr.get('raw_reading')}")
    print(f"Meter index: {ocr.get('meter_index_m3')} m³")
    print(f"Backend: {ocr.get('backend')}")
    print(f"Note: {ocr.get('note')}")
    
    # Expected from image: 0895672 → 895.672 m³
    print(f"\nExpected: 0895672 → 895.672 m³")
    
    # Now upload this to backend
    print(f"\n=== UPLOADING TO BACKEND ===")
    import urllib.request
    device_id = "ESP32-AQUASENSE-01"
    url = f"http://127.0.0.1:8000/readings/esp32/device/{device_id}"
    
    req = urllib.request.Request(url, data=image_bytes, 
                                  headers={"Content-Type": "application/octet-stream"}, 
                                  method="POST")
    resp = urllib.request.urlopen(req)
    result = resp.read().decode()
    print(f"Response: {result[:500]}...")

if __name__ == "__main__":
    main()
