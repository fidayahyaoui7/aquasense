"""
Pipeline YOLOv8 deux étages pour lecture compteur d'eau (water-meter-digit-recognition-final.ipynb).

Étape 1 : YOLOv8-seg — détecte la zone des chiffres dans l'image complète du compteur
Étape 2 : YOLOv8-det — reconnaît chaque chiffre individuel (0-9) dans la zone cropped

Features :
- Rotation automatique portrait → landscape
- Essai tous les 4 orientations + mirroring pour correction image inversée
- Tri gauche→droite avec suppression chevauchements (x_iou > 0.3)
- Heuristique : les compteurs ont toujours des zéros au début, jamais à la fin
  → pénalise les images mirrored/upside-down
- Si modèles absents → relevé simulé (backend démarre quand même)
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
        self._seg_model: Any = None
        self._det_model: Any = None
        self._seg_weights = settings.AI_MODELS_DIR / "water_meter_models" / "seg_train" / "weights" / "best.pt"  # Stage-1 segmentation
        self._det_weights = settings.AI_MODELS_DIR / "water_meter_models" / "det_train" / "weights" / "best.pt"  # Stage-2 detection

    def _lazy_seg_model(self) -> Any:
        """Lazy load YOLOv8n-seg (digit window segmentation)."""
        if self._seg_model is None and self._seg_weights.is_file():
            try:
                from ultralytics import YOLO
                self._seg_model = YOLO(str(self._seg_weights))
            except Exception:
                self._seg_model = False
        return self._seg_model if self._seg_model not in (None, False) else None

    def _lazy_det_model(self) -> Any:
        """Lazy load YOLOv8n-det (digit recognition)."""
        if self._det_model is None and self._det_weights.is_file():
            try:
                from ultralytics import YOLO
                self._det_model = YOLO(str(self._det_weights))
            except Exception:
                self._det_model = False
        return self._det_model if self._det_model not in (None, False) else None

    def _crop_digit_window(self, image: np.ndarray, result: Any) -> np.ndarray | None:
        """Extract & auto-rotate the digit window from a Stage-1 result."""
        cv2 = _import_cv2()
        if cv2 is None or result.masks is None or len(result.masks.xy) == 0:
            return None

        poly = result.masks.xy[0].astype(int)
        if len(poly) == 0:
            return None

        h, w = image.shape[:2]
        x1 = int(np.clip(poly[:, 0].min(), 0, w - 1))
        y1 = int(np.clip(poly[:, 1].min(), 0, h - 1))
        x2 = int(np.clip(poly[:, 0].max(), 0, w))
        y2 = int(np.clip(poly[:, 1].max(), 0, h))

        if x2 <= x1 or y2 <= y1:
            return None

        crop = image[y1:y2, x1:x2]

        # auto-rotate portrait crops to landscape
        if crop.shape[0] > crop.shape[1]:
            crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)

        return crop

    def _read_meter_digits(self, img: np.ndarray, mdl: Any, conf: float = 0.08, max_digits: int = 8) -> str:
        """Run Stage-2 detection on a digit-window image. Returns left-to-right digit string."""
        cv2 = _import_cv2()
        if cv2 is None or mdl is None:
            return ""

        h, w = img.shape[:2]
        if h > w:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            w, h = h, w

        results = mdl.predict(img, conf=conf, iou=0.3, verbose=False)
        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return ""

        digits = []
        for b in boxes:
            x1, x2 = float(b.xyxy[0][0]), float(b.xyxy[0][2])
            cx = (x1 + x2) / 2
            digits.append((cx, x1, x2, int(b.cls[0]), float(b.conf[0])))

        digits.sort(key=lambda d: d[0])

        # Supprime chevauchements (x_iou > 0.3), garde conf la plus élevée
        def x_iou(a: tuple, b: tuple) -> float:
            inter = max(0, min(a[2], b[2]) - max(a[1], b[1]))
            union = max(a[2], b[2]) - min(a[1], b[1])
            return inter / union if union > 0 else 0

        filtered = []
        for d in digits:
            if not filtered:
                filtered.append(d)
            elif x_iou(filtered[-1], d) > 0.3:
                if d[4] > filtered[-1][4]:
                    filtered[-1] = d
            else:
                filtered.append(d)

        if len(filtered) > max_digits:
            filtered = sorted(filtered, key=lambda d: -d[4])[:max_digits]
            filtered.sort(key=lambda d: d[0])

        return "".join(str(d[3]) for d in filtered)

    def _read_meter_digits_allrot(self, img: np.ndarray, mdl: Any, conf: float = 0.25, max_digits: int = 8) -> str:
        """Try all 4 orientations + mirroring. Pick the one with best meter-reading score.
        
        Heuristique : compteurs d'eau ont toujours des zéros au début (jamais à la fin).
        Une image mirrored/upside-down produirait des zéros à la fin → pénalisée.
        """
        cv2 = _import_cv2()
        if cv2 is None or mdl is None:
            return ""

        h, w = img.shape[:2]
        if h > w:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

        variants = [
            img,
            cv2.flip(img, 1),                               # mirror horizontal
            cv2.rotate(img, cv2.ROTATE_180),                # upside down
            cv2.flip(cv2.rotate(img, cv2.ROTATE_180), 1),   # mirror + 180
        ]

        def predict_variant(v: np.ndarray) -> tuple[str, float, int]:
            results = mdl.predict(v, conf=conf, iou=0.3, verbose=False)
            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                return "", 0.0, 0

            digits = []
            for b in boxes:
                x1, x2 = float(b.xyxy[0][0]), float(b.xyxy[0][2])
                cx = (x1 + x2) / 2
                digits.append((cx, x1, x2, int(b.cls[0]), float(b.conf[0])))

            digits.sort(key=lambda d: d[0])

            def x_iou(a: tuple, b: tuple) -> float:
                inter = max(0, min(a[2], b[2]) - max(a[1], b[1]))
                union = max(a[2], b[2]) - min(a[1], b[1])
                return inter / union if union > 0 else 0

            filtered = []
            for d in digits:
                if not filtered:
                    filtered.append(d)
                elif x_iou(filtered[-1], d) > 0.3:
                    if d[4] > filtered[-1][4]:
                        filtered[-1] = d
                else:
                    filtered.append(d)

            if len(filtered) > max_digits:
                filtered = sorted(filtered, key=lambda d: -d[4])[:max_digits]
                filtered.sort(key=lambda d: d[0])

            pred = "".join(str(d[3]) for d in filtered)
            avg_conf = sum(d[4] for d in filtered) / len(filtered) if filtered else 0.0
            return pred, avg_conf, len(filtered)

        def orientation_score(pred: str, avg_conf: float, count: int) -> float:
            """Score how meter-like a reading is.
            Real meter readings have leading zeros, never trailing zeros."""
            if not pred:
                return -1.0
            score = avg_conf
            leading_zeros = len(pred) - len(pred.lstrip("0"))
            trailing_zeros = len(pred) - len(pred.rstrip("0"))
            score += leading_zeros * 0.15    # bonus – meters start with zeros
            score -= trailing_zeros * 0.20   # penalty – trailing zeros = flipped
            if count == max_digits:
                score += 0.2                 # bonus for correct digit count
            return score

        best_pred, best_score = "", -999.0
        for v in variants:
            pred, avg_conf, count = predict_variant(v)
            if not pred:
                continue
            score = orientation_score(pred, avg_conf, count)
            if score > best_score:
                best_score = score
                best_pred = pred

        return best_pred

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
        """Convert digit string to consumption in m³."""
        digits_only = re.sub(r"\D", "", raw) or "0"
        v = float(int(digits_only[:8] or 0)) / 10000.0
        return round(min(max(v, 0.0001), 50.0), 4)

    def read_meter(self, image_bytes: bytes) -> dict[str, Any]:
        """Pipeline complet : Stage-1 crop → Stage-2 recognition."""
        try:
            cv2 = _import_cv2()
            if cv2 is None:
                return self._simulated("opencv manquant — exécutez: pip install opencv-python-headless")

            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return self._simulated("image illisible")

            # --- Stage 1: Segment digit window ---
            seg_model = self._lazy_seg_model()
            if seg_model is None:
                # Fallback: try Stage-2 on full image if Stage-1 unavailable
                det_model = self._lazy_det_model()
                if det_model is None:
                    return self._simulated("modèles YOLO absents dans ai_models/")
                raw = self._read_meter_digits_allrot(img, det_model, conf=0.25)
            else:
                seg_results = seg_model.predict(img, conf=0.25, verbose=False)
                crop = self._crop_digit_window(img, seg_results[0])

                if crop is None or crop.size == 0:
                    # Fallback: try full image if Stage-1 doesn't detect window
                    det_model = self._lazy_det_model()
                    if det_model is None:
                        return self._simulated("aucune zone chiffres détectée")
                    crop = img

                # --- Stage 2: Read digits from crop ---
                det_model = self._lazy_det_model()
                if det_model is None:
                    return self._simulated("modèle Stage-2 absent dans ai_models/")

                raw = self._read_meter_digits_allrot(crop, det_model, conf=0.25)

            if not raw:
                return self._simulated("aucun chiffre détecté après traitement")

            return {
                "raw_reading": raw[:8],
                "consumption_m3": self._consumption_from_digits(raw),
                "confidence": 0.75,  # Confiance fixe pour pipeline YOLO complet
                "backend": "yolov8_two_stage",
            }
        except Exception as e:
            return self._simulated(f"erreur pipeline: {e!s}")


meter_ocr = YoloMeterOCR()
