"""Configuration loading tests"""

import os
import pytest
from app.config import Settings


def test_settings_from_env(monkeypatch):
    """Test settings loading from environment"""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-123")
    monkeypatch.setenv("FASTAPI_PORT", "9000")
    
    settings = Settings()
    
    assert settings.anthropic_api_key == "sk-test-123"
    assert settings.fastapi_port == 9000


def test_settings_defaults():
    """Test default settings"""
    # Create minimal settings
    os.environ["ANTHROPIC_API_KEY"] = "sk-test-123"
    
    settings = Settings()
    
    assert settings.fastapi_host == "0.0.0.0"
    assert settings.fastapi_port == 8000
    assert settings.max_file_size_mb == 10
    assert settings.enable_cors is True


def test_settings_validation(monkeypatch):
    """Test settings validation"""
    # Clear required keys
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("LAKERA_GUARD_ENABLED", "true")
    
    settings = Settings()
    
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        settings.validate_required_keys()
