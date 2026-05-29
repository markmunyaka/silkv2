"""PDF Summarization request/response schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class KeyPoint(BaseModel):
    """A single key point from the summary"""

    point: str = Field(..., description="The key point text")
    importance: str = Field("high", description="Importance level: high, medium, low")


class SummarizationResponse(BaseModel):
    """Structured summary response with security metadata"""

    title: str = Field(..., description="Document title/main topic")
    summary: str = Field(..., description="Comprehensive summary (3-5 sentences)")
    key_points: list[KeyPoint] = Field(..., description="5 most important key points")
    
    # Watermarking & Security
    watermark_signature: str = Field(..., description="HMAC signature for integrity verification")
    watermark_timestamp: datetime = Field(default_factory=datetime.utcnow, description="Generation timestamp")
    
    # Tracing & Forensics
    request_id: str = Field(..., description="Unique request ID for audit trail")
    processing_time_ms: int = Field(..., description="Total processing time in milliseconds")
    security_checks_passed: dict[str, bool] = Field(..., description="Status of each security check")
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Climate Change Report",
                "summary": "This report discusses the impacts of climate change on global ecosystems. Rising temperatures are causing significant changes in wildlife migration patterns and vegetation zones. The analysis presents data from multiple regions showing increased frequency of extreme weather events.",
                "key_points": [
                    {"point": "Global temperature rise is accelerating", "importance": "high"},
                    {"point": "Ocean acidification threatens marine ecosystems", "importance": "high"},
                    {"point": "Sustainable practices can mitigate impacts", "importance": "medium"},
                    {"point": "Policy intervention is critical", "importance": "high"},
                    {"point": "Technology offers some solutions", "importance": "medium"}
                ],
                "watermark_signature": "sha256_hmac_signature_here",
                "watermark_timestamp": "2024-01-15T10:30:00Z",
                "request_id": "req_abc123def456",
                "processing_time_ms": 2450,
                "security_checks_passed": {
                    "sanitization": True,
                    "pii_redaction": True,
                    "prompt_injection_check": True,
                    "output_validation": True
                }
            }
        }


class SummarizationRequest(BaseModel):
    """Request metadata (file is multipart)"""

    anonymize: bool = Field(False, description="Whether to anonymize PII in output")
    include_key_points: bool = Field(True, description="Include 5 key points in response")
