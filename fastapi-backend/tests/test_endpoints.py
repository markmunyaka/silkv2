"""Health and basic endpoint tests"""

from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    """Test health check endpoint"""
    client = TestClient(app)
    response = client.get("/health")
    
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["service"] == "pdf-summarizer"


def test_root_endpoint():
    """Test root API info endpoint"""
    client = TestClient(app)
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "security_features" in data
    assert data["version"] == "1.0.0"


def test_summarize_missing_file():
    """Test summarize endpoint without file"""
    client = TestClient(app)
    response = client.post("/summarize")
    
    assert response.status_code == 422  # Unprocessable Entity


def test_summarize_invalid_file_type():
    """Test summarize endpoint with invalid file type"""
    client = TestClient(app)
    
    response = client.post(
        "/summarize",
        files={"file": ("test.txt", b"plain text content", "text/plain")},
    )
    
    assert response.status_code == 403  # Security Violation
    data = response.json()
    assert data["status"] == "Security Violation"
    assert "Invalid file type" in data["message"]
