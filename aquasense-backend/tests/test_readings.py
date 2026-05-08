"""Tests unitaires pour les endpoints readings."""
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db, SessionLocal, Base, engine

client = TestClient(app)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_get_current_no_user():
    response = client.get("/readings/current?user_id=999")
    assert response.status_code == 404


def test_latest_image_no_user():
    response = client.get("/readings/latest-image?user_id=999")
    assert response.status_code == 404
