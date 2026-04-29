"""
Détection d'anomalies — 15 features et 6 classes (notebook Colab export).

Fichiers attendus dans ``ai_models/`` (joblib + metadata.json du notebook) :
  best_model.pkl, scaler.pkl (si MLP), le_building.pkl, le_season.pkl, metadata.json

Sans ces fichiers : classification heuristique calibrée sur les mêmes seuils SONEDE.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from settings import settings

# ── Paramètres notebook (seuils tunisiens) ─────────────────────────────────
BUILDING_TYPES = ["maison", "appartement", "cafe", "restaurant", "hotel", "immeuble", "usine"]
SEASONS = ["hiver", "printemps", "ete", "automne"]

THRESHOLDS: dict[str, float] = {
    "maison": 0.70,
    "appartement": 0.50,
    "cafe": 2.00,
    "restaurant": 4.00,
    "hotel": 8.00,
    "immeuble": 5.00,
    "usine": 15.00,
}

ALERT_THRESHOLDS: dict[str, float] = {
    "maison": 1.20,
    "appartement": 0.90,
    "cafe": 3.50,
    "restaurant": 7.00,
    "hotel": 14.00,
    "immeuble": 9.00,
    "usine": 28.00,
}

SEASON_COEF: dict[str, float] = {
    "hiver": 0.75,
    "printemps": 1.00,
    "ete": 1.50,
    "automne": 0.90,
}

NIGHT_RATIO: dict[str, float] = {
    "maison": 0.02,
    "appartement": 0.02,
    "cafe": 0.00,
    "restaurant": 0.00,
    "hotel": 0.08,
    "immeuble": 0.03,
    "usine": 0.01,
}

ANOMALY_NAMES: dict[int, str] = {
    0: "normal",
    1: "surconsommation",
    2: "fuite_nocturne",
    3: "anomalie_saisonniere",
    4: "conso_nulle",
    5: "pic_inhabituel",
}

FEATURE_ORDER = [
    "building_type_enc",
    "season_enc",
    "hour",
    "day_of_week",
    "is_night",
    "threshold_m3",
    "alert_threshold_m3",
    "consumption_m3",
    "consumption_ratio",
    "rolling_avg_7d",
    "delta_vs_prev",
    "ratio_vs_history",
    "over_alert",
    "near_zero",
    "night_spike",
]

MSGS: dict[str, str] = {
    "normal": "Consommation normale, aucune action requise.",
    "surconsommation": "Consommation dépasse le seuil autorisé !",
    "fuite_nocturne": "Possible fuite détectée pendant la nuit !",
    "anomalie_saisonniere": "Consommation anormale pour cette saison.",
    "conso_nulle": "Compteur bloqué ou coupure d'eau ?",
    "pic_inhabituel": "Pic suspect — vérifier la canalisation.",
}


def season_from_month(month: int) -> str:
    if month in (12, 1, 2):
        return "hiver"
    if month in (3, 4, 5):
        return "printemps"
    if month in (6, 7, 8):
        return "ete"
    return "automne"


def _encode_building_fallback(bt: str) -> int:
    classes = sorted(BUILDING_TYPES)
    b = (bt or "maison").lower().strip()
    return classes.index(b) if b in classes else classes.index("maison")


def _encode_season_fallback(season: str) -> int:
    classes = sorted(SEASONS)
    s = (season or "printemps").lower().strip()
    return classes.index(s) if s in classes else classes.index("printemps")


@dataclass
class AnomalyContext:
    building_type: str
    consumption_m3: float
    timestamp: datetime
    rolling_avg_7d: float
    prev_consumption: float | None


class AnomalyDetector:
    def __init__(self) -> None:
        self._dir = settings.AI_MODELS_DIR
        self._model: Any = None
        self._scaler: Any = None
        self._le_b: Any = None
        self._le_s: Any = None
        self._metadata: dict[str, Any] | None = None
        self._feature_cols: list[str] = list(FEATURE_ORDER)
        self._load_artifacts()

    def _paths(self) -> dict[str, Path]:
        return {
            "model": self._dir / "best_model.pkl",
            "scaler": self._dir / "scaler.pkl",
            "le_b": self._dir / "le_building.pkl",
            "le_s": self._dir / "le_season.pkl",
            "meta": self._dir / "metadata.json",
        }

    def _load_artifacts(self) -> None:
        import joblib

        p = self._paths()
        try:
            if p["meta"].is_file():
                self._metadata = json.loads(p["meta"].read_text(encoding="utf-8"))
                feats = self._metadata.get("features")
                if isinstance(feats, list) and len(feats) == 15:
                    self._feature_cols = feats
            if p["model"].is_file():
                self._model = joblib.load(p["model"])
            if p["scaler"].is_file():
                self._scaler = joblib.load(p["scaler"])
            if p["le_b"].is_file():
                self._le_b = joblib.load(p["le_b"])
            if p["le_s"].is_file():
                self._le_s = joblib.load(p["le_s"])
        except Exception:
            self._model = None

    def _encode_building(self, bt: str) -> int:
        if self._le_b is not None and hasattr(self._le_b, "transform"):
            try:
                return int(self._le_b.transform([bt])[0])
            except Exception:
                pass
        return _encode_building_fallback(bt)

    def _encode_season(self, season: str) -> int:
        if self._le_s is not None and hasattr(self._le_s, "transform"):
            try:
                return int(self._le_s.transform([season])[0])
            except Exception:
                pass
        return _encode_season_fallback(season)

    def build_row(self, ctx: AnomalyContext) -> pd.DataFrame:
        bt = (ctx.building_type or "maison").lower()
        if bt not in THRESHOLDS:
            bt = "maison"
        season = season_from_month(ctx.timestamp.month)
        hour = ctx.timestamp.hour
        dow = ctx.timestamp.weekday()
        is_night = 1 if (hour >= 22 or hour <= 5) else 0
        thr = THRESHOLDS[bt]
        alert = ALERT_THRESHOLDS[bt]
        conso = float(ctx.consumption_m3)
        prev = float(ctx.prev_consumption) if ctx.prev_consumption is not None else conso
        hist_avg = float(ctx.rolling_avg_7d) if ctx.rolling_avg_7d > 0 else conso

        consumption_ratio = conso / thr if thr > 0 else 0.0
        over_alert = 1 if conso > alert else 0
        near_zero = 1 if conso < thr * 0.01 else 0
        night_spike = 1 if (is_night == 1 and conso > thr * 0.04) else 0
        delta_vs_prev = conso - prev
        ratio_vs_history = conso / hist_avg if hist_avg > 0 else 0.0

        row = {
            "building_type_enc": self._encode_building(bt),
            "season_enc": self._encode_season(season),
            "hour": hour,
            "day_of_week": dow,
            "is_night": is_night,
            "threshold_m3": thr,
            "alert_threshold_m3": alert,
            "consumption_m3": conso,
            "consumption_ratio": round(consumption_ratio, 6),
            "rolling_avg_7d": round(hist_avg, 6),
            "delta_vs_prev": round(delta_vs_prev, 6),
            "ratio_vs_history": round(ratio_vs_history, 6),
            "over_alert": over_alert,
            "near_zero": near_zero,
            "night_spike": night_spike,
        }
        return pd.DataFrame([row])[self._feature_cols]

    def _needs_scaling(self) -> bool:
        if self._model is None or self._metadata is None:
            return False
        name = str(self._metadata.get("model_name", "")).lower()
        if "mlp" in name:
            return True
        mod = str(type(self._model))
        return "mlp" in mod.lower()

    def _predict_ml(self, X: pd.DataFrame) -> tuple[int, dict[int, float], str]:
        assert self._model is not None
        Xv = X.values.astype(np.float32)
        if self._needs_scaling() and self._scaler is not None:
            Xv = self._scaler.transform(Xv)
        pred = int(self._model.predict(Xv)[0])
        probs: dict[int, float] = {}
        if hasattr(self._model, "predict_proba"):
            pr = self._model.predict_proba(Xv)[0]
            for i, p in enumerate(pr):
                probs[i] = float(p)
        else:
            probs[pred] = 1.0
        name = (self._metadata or {}).get("model_name", "ml")
        return pred, probs, str(name).lower().replace(" ", "_")

    def _heuristic(self, ctx: AnomalyContext, row: pd.DataFrame) -> tuple[int, dict[int, float], str]:
        bt = (ctx.building_type or "maison").lower()
        if bt not in THRESHOLDS:
            bt = "maison"
        thr = THRESHOLDS[bt]
        alert = ALERT_THRESHOLDS[bt]
        coef = SEASON_COEF[season_from_month(ctx.timestamp.month)]
        conso = float(ctx.consumption_m3)
        hour = ctx.timestamp.hour
        is_night = hour >= 22 or hour <= 5

        scores = {i: 0.05 for i in ANOMALY_NAMES}

        if conso < thr * 0.01:
            scores[4] += 0.9
        if is_night and conso > thr * 0.04:
            scores[2] += 0.55
        if conso > alert * 2.0:
            scores[5] += 0.45
        elif conso > alert:
            scores[1] += 0.45

        expected = thr * coef * (NIGHT_RATIO[bt] if is_night else 1.0) * 0.8
        if expected > 0 and conso > expected * 2.2 and season_from_month(ctx.timestamp.month) in ("hiver", "automne"):
            scores[3] += 0.25

        scores[0] += 0.35
        z = np.array([max(scores[i], 1e-6) for i in range(6)], dtype=float)
        z = np.exp(z - z.max())
        z = z / z.sum()
        probs = {i: float(z[i]) for i in range(6)}
        pred = int(max(probs, key=probs.get))
        return pred, probs, "heuristic"

    def predict(self, ctx: AnomalyContext) -> dict[str, Any]:
        row = self.build_row(ctx)
        try:
            if self._model is not None:
                pred, probs, backend = self._predict_ml(row)
            else:
                pred, probs, backend = self._heuristic(ctx, row)
        except Exception:
            pred, probs, backend = self._heuristic(ctx, row)

        name = ANOMALY_NAMES.get(pred, "normal")
        confidence = float(probs.get(pred, 0.0))
        all_probs = {ANOMALY_NAMES[i]: float(probs.get(i, 0.0)) for i in ANOMALY_NAMES}

        return {
            "anomaly_type": pred,
            "anomaly_name": name,
            "confidence": round(confidence, 4),
            "all_probabilities": all_probs,
            "message": MSGS.get(name, ""),
            "backend": backend,
            "season": season_from_month(ctx.timestamp.month),
            "season_coefficient": SEASON_COEF[season_from_month(ctx.timestamp.month)],
        }


anomaly_detector = AnomalyDetector()
