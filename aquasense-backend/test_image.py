"""Test de l'OCR et de la détection d'anomalies sur une image locale."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from models.anomaly import AnomalyContext, anomaly_detector
from models.yolo_ocr import meter_ocr


def main() -> None:
    path = Path(__file__).parent / "uploads" / "4" / "65dc7d660e884cc2aad8621477a4c6f4.jpg"
    if not path.is_file():
        raise SystemExit(f"Fichier introuvable : {path}")

    image_bytes = path.read_bytes()
    ocr_result = meter_ocr.read_meter(image_bytes)

    print("--- OCR RESULT ---")
    for key, value in ocr_result.items():
        print(f"{key}: {value}")

    ctx = AnomalyContext(
        building_type="cafe",
        consumption_m3=float(ocr_result.get("consumption_m3", 0.0) or 0.0),
        timestamp=datetime.utcnow(),
        rolling_avg_7d=float(ocr_result.get("consumption_m3", 0.0) or 0.0),
        prev_consumption=None,
    )

    anomaly = anomaly_detector.predict(ctx)
    print("\n--- ANOMALY RESULT ---")
    for key, value in anomaly.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
