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

    # En production, le modèle d’anomalie reçoit l’incrément (delta) entre deux relevés, pas l’index compteur.
    idx = float(ocr_result.get("meter_index_m3") or ocr_result.get("consumption_m3") or 0.0)
    demo_delta = 0.02
    ctx = AnomalyContext(
        building_type="cafe",
        consumption_m3=demo_delta,
        timestamp=datetime.utcnow(),
        rolling_avg_7d=demo_delta,
        prev_consumption=None,
    )
    print(f"(index compteur OCR: {idx} m³ — test anomalie avec delta fictif {demo_delta} m³)")

    anomaly = anomaly_detector.predict(ctx)
    print("\n--- ANOMALY RESULT ---")
    for key, value in anomaly.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
