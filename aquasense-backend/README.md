# AquaSense Backend

API FastAPI pour le traitement OCR des compteurs d'eau via IA (YOLOv8) et détection d'anomalies.

## Démarrage rapide

```bash
# 1. Créer l'environnement virtuel
python -m venv venv

# 2. Activer
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Lancer le serveur
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Structure

```
aquasense-backend/
├── routes/         # Endpoints FastAPI
├── models/         # Modèles IA (YOLO OCR, Anomaly)
├── services/       # Logique métier
├── database.py     # SQLAlchemy + SQLite
├── main.py         # Point d'entrée
└── requirements.txt
```

## API Endpoints principaux

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/readings/esp32/device/{id}` | POST | Upload image depuis ESP32 |
| `/readings/current` | GET | Dernière lecture + OCR live |
| `/readings/latest-image` | GET | URL dernière image + OCR |
| `/readings/history` | GET | Historique des consommations |
| `/readings/stats` | GET | Statistiques mensuelles |

## Modèles IA

Les modèles YOLOv8 sont requis dans `ai_models/water_meter_models/` :
- `seg_train/weights/best.pt` — segmentation zone chiffres
- `det_train/weights/best.pt` — reconnaissance des chiffres

> Ces fichiers ne sont pas versionnés (`.gitignore`). Placez-les manuellement.

## Base de données

SQLite par défaut (`data/aquasense.db`). Tables principales :
- `users` — utilisateurs
- `readings` — relevés OCR
- `alerts` — alertes anomalie
- `devices` — appareils ESP32
