"""PDF Sanitization (Votiro/CDR mock)"""

import logging
from datetime import datetime
from typing import Optional

from langsmith import trace

logger = logging.getLogger(__name__)


class SanitizationError(Exception):
    """Raised when PDF sanitization fails"""

    pass


class PDFSanitizer:
    """
    Sanitizes PDFs by stripping macros, JavaScript, and malicious content.
    Uses Votiro/CDR API or mock sanitization for testing.
    """

    def __init__(self, api_key: Optional[str] = None, enabled: bool = True):
        self.api_key = api_key
        self.enabled = enabled

    @trace("pdf_sanitization")
    async def sanitize(self, pdf_bytes: bytes, filename: str) -> tuple[bytes, dict]:
        """
        Sanitize PDF content by removing potentially dangerous elements.

        Args:
            pdf_bytes: Raw PDF file bytes
            filename: Original filename for logging

        Returns:
            Tuple of (sanitized_bytes, metadata_dict)

        Raises:
            SanitizationError: If sanitization fails
        """
        if not self.enabled:
            return self._mock_sanitization(pdf_bytes, filename)

        try:
            logger.info(f"Sanitizing PDF: {filename}")

            # In production: Call Votiro API
            # response = httpx.post(
            #     "https://api.votiro.com/v1/file/disarm",
            #     headers={"Authorization": f"Bearer {self.api_key}"},
            #     files={"file": pdf_bytes},
            #     timeout=30.0,
            # )

            # For now, use mock sanitization
            sanitized = self._mock_sanitization(pdf_bytes, filename)

            logger.info(
                f"PDF sanitization successful: {filename}, "
                f"original size: {len(pdf_bytes)}, "
                f"sanitized size: {len(sanitized[0])}"
            )

            return sanitized

        except Exception as e:
            logger.error(f"Sanitization failed for {filename}: {str(e)}")
            raise SanitizationError(f"Failed to sanitize PDF: {str(e)}") from e

    def _mock_sanitization(self, pdf_bytes: bytes, filename: str) -> tuple[bytes, dict]:
        """Mock sanitization for testing (no actual content modification)"""
        metadata = {
            "status": "sanitized",
            "sanitization_method": "mock_votiro_cdr",
            "timestamp": datetime.utcnow().isoformat(),
            "filename": filename,
            "original_size_bytes": len(pdf_bytes),
            "macros_removed": 0,
            "scripts_removed": 0,
            "threats_detected": [],
        }

        # In real implementation, this would parse and clean the PDF
        # For now, return as-is to preserve structure for text extraction
        return pdf_bytes, metadata
