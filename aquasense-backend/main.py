"""
AquaSense — API FastAPI (surveillance compteurs d'eau).
Lancement : ``uvicorn main:app --reload --port 8000`` depuis ce dossier.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db, seed_database
from routes import alerts, auth, devices, readings, settings_api, users
from routes.database_admin import router as db_admin_router
from settings import settings as app_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_database()
    yield


app = FastAPI(title=app_settings.APP_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.CORS_ORIGINS,
    allow_origin_regex=app_settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(readings.router)
app.include_router(alerts.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(settings_api.router)
app.include_router(db_admin_router)

# ✅ Servir les images uploadées (photos ESP32 et app mobile)
app.mount("/uploads", StaticFiles(directory=str(app_settings.UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "app": app_settings.APP_NAME}


@app.get("/")
def root():
    return {"message": "AquaSense API", "docs": "/docs"}