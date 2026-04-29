"""Administration base de données - Requêtes SQL directes."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal
from settings import settings as app_settings

router = APIRouter(prefix="/db", tags=["database"])


class QueryRequest(BaseModel):
    sql: str


class QueryResponse(BaseModel):
    message: str
    results: list[dict] | None = None
    error: str | None = None


def _get_db_path() -> Path:
    return app_settings.DATA_DIR / "aquasense.db"


@router.post("/query", response_model=QueryResponse)
def execute_query(req: QueryRequest):
    """Exécute une requête SQL sur la base de données."""
    db_path = _get_db_path()
    
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Base de données introuvable")
    
    sql = req.sql.strip()
    
    # Liste blanche des opérations autorisées
    allowed_keywords = ['SELECT', 'PRAGMA', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']
    
    if not any(sql.upper().startswith(kw) for kw in allowed_keywords):
        raise HTTPException(
            status_code=400, 
            detail="Requête non autorisée. Utilisez SELECT, INSERT, UPDATE, DELETE, PRAGMA, etc."
        )
    
    # Interdire certaines opérations dangereuses
    forbidden = ['DROP TABLE users', 'DROP TABLE readings', 'DROP TABLE alerts']
    if any(f in sql.upper() for f in ['DROP TABLE users', 'DROP TABLE readings', 'DROP TABLE alerts']):
        raise HTTPException(status_code=400, detail="Suppression de tables principales interdite")
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Exécution de la requête
        cursor.execute(sql)
        
        if sql.upper().startswith(('SELECT', 'PRAGMA')):
            rows = cursor.fetchall()
            results = [dict(row) for row in rows]
            conn.close()
            return QueryResponse(
                message=f"{len(results)} résultat(s) trouvé(s)",
                results=results
            )
        else:
            # INSERT, UPDATE, DELETE
            conn.commit()
            affected = cursor.rowcount
            conn.close()
            return QueryResponse(
                message=f"Requête exécutée. {affected} ligne(s) affectée(s)",
                results=None
            )
            
    except sqlite3.Error as e:
        raise HTTPException(status_code=400, detail=f"Erreur SQL: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@router.get("/tables")
def list_tables():
    """Liste toutes les tables de la base de données."""
    db_path = _get_db_path()
    
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Base de données introuvable")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/table/{table_name}")
def get_table_data(table_name: str, limit: int = 100):
    """Affiche les données d'une table spécifique."""
    db_path = _get_db_path()
    
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Base de données introuvable")
    
    # Vérifier que la table existe
    allowed_tables = ['users', 'readings', 'alerts', 'history', 'app_settings']
    if table_name not in allowed_tables:
        raise HTTPException(status_code=400, detail=f"Table non autorisée. Tables: {allowed_tables}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name} LIMIT ?;", (limit,))
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        conn.close()
        return {"table": table_name, "count": len(results), "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))