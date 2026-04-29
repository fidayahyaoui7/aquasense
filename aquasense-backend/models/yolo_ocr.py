"""
Lecture compteur : YOLOv8-seg (zone chiffres) + EasyOCR, d'après water-meter-pcd (1).ipynb.

- Masque YOLO → bbox poly → crop
- Essai rotations 0 / 90 / 180 / 270 puis, si h > w, rotation 90° horaire (comme le notebook)
- EasyOCR : allowlist 0-9, conf > 0.4, tri gauche → droite, max 8 digits
- Si ``ai_models/best.pt`` absent ou erreur → relevé simulé (backend démarre quand même)
"""

from __future__ import annotations

import random
import re
from typing import Any

import numpy as np

from settings import settings


def _import_cv2():
    try:
        import cv2

        return cv2
    except ImportError:
        return None


class YoloMeterOCR:
    def __init__(self) -> None:
        self._model: Any = None
        self._reader: Any = None
        self._weights = settings.AI_MODELS_DIR / "best.pt"

    def _lazy_model(self) -> Any:
        if self._model is None and self._weights.is_file():
            try:
                from ultralytics import YOLO

                self._model = YOLO(str(self._weights))
            except Exception:
                self._model = False
        return self._model if self._model not in (None, False) else None

    def _lazy_reader(self) -> Any:
        if self._reader is None:
            try:
                import easyocr

                self._reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            except Exception:
                self._reader = False
        return self._reader if self._reader not in (None, False) else None

    def _crop_from_segmentation(self, image_bgr: np.ndarray) -> np.ndarray | None:
        model = self._lazy_model()
        if model is None:
            return None
        try:
            results = model(image_bgr, verbose=False)
            r0 = results[0]
            if r0.masks is None:
                return None
            poly = r0.masks.xy[0].astype(np.int32)
            x1, y1 = poly[:, 0].min(), poly[:, 1].min()
            x2, y2 = poly[:, 0].max(), poly[:, 1].max()
            if x2 <= x1 or y2 <= y1:
                return None
            return image_bgr[y1:y2, x1:x2].copy()
        except Exception:
            return None

    def _read_digits_easyocr(self, crop_bgr: np.ndarray) -> tuple[str, float]:
        cv2 = _import_cv2()
        if cv2 is None:
            return "", 0.0
        reader = self._lazy_reader()
        if reader is None:
            return "", 0.0
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        results = reader.readtext(gray, allowlist="0123456789", detail=1)
        digits: list[tuple[float, str, float]] = []
        for box, text, conf in results:
            if text.isdigit() and conf > 0.4:
                x_left = float(box[0][0])
                digits.append((x_left, text, float(conf)))
        digits.sort(key=lambda x: x[0])
        reading = "".join(d[1] for d in digits)[:8]
        confs = [d[2] for d in digits]
        avg_conf = float(sum(confs) / len(confs)) if confs else 0.0
        return reading, avg_conf

    def _rotate_90k(self, img: np.ndarray, k: int) -> np.ndarray:
        cv2 = _import_cv2()
        if cv2 is None:
            return img
        out = img
        for _ in range(k % 4):
            out = cv2.rotate(out, cv2.ROTATE_90_COUNTERCLOCKWISE)
        return out

    def _best_rotation_reading(self, crop_bgr: np.ndarray) -> tuple[str, float]:
        cv2 = _import_cv2()
        if cv2 is None:
            return "", 0.0
        best_s, best_score = "", -1.0
        for k in range(4):
            rot = self._rotate_90k(crop_bgr, k)
            h, w = rot.shape[:2]
            if h > w:
                rot = cv2.rotate(rot, cv2.ROTATE_90_CLOCKWISE)
            s, c = self._read_digits_easyocr(rot)
            score = len(s) * 10.0 + c
            if score > best_score:
                best_s, best_score = s, score
        return best_s, max(0.0, best_score - len(best_s) * 10.0)

    def _simulated(self, reason: str) -> dict[str, Any]:
        n = random.randint(4, 7)
        sim = "".join(str(random.randint(0, 9)) for _ in range(n))
        val = round(float(int(sim[:6] or "1")) / 10000.0, 4)
        return {
            "raw_reading": sim,
            "consumption_m3": min(max(val, 0.001), 5.0),
            "confidence": 0.35,
            "backend": "simulated",
            "note": reason,
        }

    def _consumption_from_digits(self, raw: str) -> float:
        digits_only = re.sub(r"\D", "", raw) or "0"
        v = float(int(digits_only[:8] or 0)) / 10000.0
        return round(min(max(v, 0.0001), 50.0), 4)

    def read_meter(self, image_bytes: bytes) -> dict[str, Any]:
        try:
            if not self._weights.is_file():
                return self._simulated("best.pt absent dans ai_models/")

            cv2 = _import_cv2()
            if cv2 is None:
                return self._simulated(
                    "opencv manquant — exécutez: py -3.14 -m pip install opencv-python-headless"
                )

            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return self._simulated("image illisible")

            crop = self._crop_from_segmentation(img)
            if crop is None or crop.size == 0:
                return self._simulated("aucune zone chiffres détectée")

            raw, conf = self._best_rotation_reading(crop)
            if not raw:
                return self._simulated("OCR vide après rotations")

            return {
                "raw_reading": raw[:8],
                "consumption_m3": self._consumption_from_digits(raw),
                "confidence": round(float(conf or 0.5), 4),
                "backend": "yolo_seg_easyocr",
            }
        except Exception as e:
            return self._simulated(f"erreur pipeline: {e!s}")


meter_ocr = YoloMeterOCR()
