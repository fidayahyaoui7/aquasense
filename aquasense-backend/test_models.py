"""Test if YOLO models load correctly."""
from pathlib import Path
from settings import settings

seg_weights = settings.AI_MODELS_DIR / "water_meter_models" / "seg_train" / "weights" / "best.pt"
det_weights = settings.AI_MODELS_DIR / "water_meter_models" / "det_train" / "weights" / "best.pt"

print(f"Seg model path: {seg_weights}")
print(f"Seg exists: {seg_weights.is_file()}")
print(f"Det model path: {det_weights}")
print(f"Det exists: {det_weights.is_file()}")

try:
    from ultralytics import YOLO
    print("\nUltralytics OK")
    
    print("\nLoading seg model...")
    seg_model = YOLO(str(seg_weights))
    print("Seg model loaded!")
    
    print("\nLoading det model...")
    det_model = YOLO(str(det_weights))
    print("Det model loaded!")
    
except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()
