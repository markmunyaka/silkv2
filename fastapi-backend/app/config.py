"""Configuration management using environment variables"""

import os
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server
    fastapi_env: str = os.getenv("FASTAPI_ENV", "development")
    fastapi_debug: bool = os.getenv("FASTAPI_DEBUG", "true").lower() == "true"
    fastapi_host: str = os.getenv("FASTAPI_HOST", "0.0.0.0")
    fastapi_port: int = int(os.getenv("FASTAPI_PORT", "8000"))

    # API Keys
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    langsmith_api_key: str = os.getenv("LANGSMITH_API_KEY", "")
    langsmith_project: str = os.getenv("LANGSMITH_PROJECT", "pdf-summarizer")
    lakera_guard_api_key: str = os.getenv("LAKERA_GUARD_API_KEY", "")
    votiro_api_key: Optional[str] = os.getenv("VOTIRO_API_KEY")
    cloudconvert_api_key: Optional[str] = os.getenv("CLOUDCONVERT_API_KEY")

    # Feature Flags
    lakera_guard_enabled: bool = os.getenv("LAKERA_GUARD_ENABLED", "true").lower() == "true"
    votiro_enabled: bool = os.getenv("VOTIRO_ENABLED", "false").lower() == "true"
    presidio_enabled: bool = os.getenv("PRESIDIO_ENABLED", "true").lower() == "true"
    guardrails_enabled: bool = os.getenv("GUARDRAILS_ENABLED", "true").lower() == "true"
    trace_requests: bool = os.getenv("TRACE_REQUESTS", "true").lower() == "true"
    anonymize_trace_data: bool = os.getenv("ANONYMIZE_TRACE_DATA", "false").lower() == "true"
    cloudconvert_enabled: bool = os.getenv("CLOUDCONVERT_ENABLED", "false").lower() == "true"

    # File Upload
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    max_file_size_bytes: int = max_file_size_mb * 1024 * 1024
    upload_temp_dir: str = os.getenv("UPLOAD_TEMP_DIR", "/tmp/pdf_uploads")
    allowed_content_types: list[str] = ["application/pdf"]

    # Watermarking
    watermark_secret_key: str = os.getenv("WATERMARK_SECRET_KEY", "default-secret-key-must-be-32-chars-or-more")
    watermark_algorithm: str = os.getenv("WATERMARK_ALGORITHM", "HS256")

    # CORS
    enable_cors: bool = os.getenv("ENABLE_CORS", "true").lower() == "true"
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_file_path: str = os.getenv("LOG_FILE_PATH", "./logs/security_audit.log")

    class Config:
        env_file = ".env"
        case_sensitive = False

    def validate_required_keys(self) -> None:
        """Validate that all required API keys are present"""
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required")
        if self.lakera_guard_enabled and not self.lakera_guard_api_key:
            raise ValueError("LAKERA_GUARD_API_KEY is required when LAKERA_GUARD_ENABLED=true")
        if self.trace_requests and not self.langsmith_api_key:
            raise ValueError("LANGSMITH_API_KEY is required when TRACE_REQUESTS=true")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    settings = Settings()
    settings.validate_required_keys()
    return settings
