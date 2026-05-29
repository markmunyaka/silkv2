"""Digital watermarking and signature generation"""

import hmac
import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Optional

from langsmith import trace

logger = logging.getLogger(__name__)


class WatermarkingError(Exception):
    """Raised when watermarking fails"""

    pass


class Watermarker:
    """
    Adds digital signatures and watermarks to output for IP protection
    and integrity verification.
    """

    def __init__(self, secret_key: str, algorithm: str = "sha256"):
        """
        Initialize watermarker with signing key.

        Args:
            secret_key: Secret key for HMAC (minimum 32 characters)
            algorithm: Hashing algorithm (sha256, sha512)
        """
        if len(secret_key) < 32:
            raise WatermarkingError("Secret key must be at least 32 characters long")

        self.secret_key = secret_key
        self.algorithm = algorithm
        self.brand = "silk_summary"

    @trace("watermarking")
    async def watermark(self, output: dict[str, Any], request_id: str) -> tuple[dict, str]:
        """
        Add watermark signature to output for integrity and authenticity.

        Args:
            output: Output dictionary to watermark
            request_id: Unique request identifier for audit trail

        Returns:
            Tuple of (watermarked_output, signature)

        Raises:
            WatermarkingError: If watermarking fails
        """
        try:
            logger.info(f"Generating watermark for request {request_id}")

            # Create canonical JSON representation (sorted keys for consistency)
            output_json = json.dumps(output, sort_keys=True, separators=(",", ":"))

            # Generate HMAC signature
            signature = self._generate_signature(
                output_json,
                request_id,
            )

            # Add watermark metadata
            watermarked = output.copy()
            watermarked.update({
                "watermark_signature": signature,
                "watermark_timestamp": datetime.utcnow().isoformat(),
                "watermark_brand": self.brand,
                "watermark_algorithm": self.algorithm,
            })

            logger.info(f"Watermark generated successfully for {request_id}")
            return watermarked, signature

        except Exception as e:
            logger.error(f"Watermarking failed: {str(e)}")
            raise WatermarkingError(f"Failed to apply watermark: {str(e)}") from e

    def _generate_signature(self, payload: str, request_id: str) -> str:
        """
        Generate HMAC signature for payload.

        Args:
            payload: Data to sign (canonical JSON)
            request_id: Request ID for additional entropy

        Returns:
            Hex-encoded HMAC signature
        """
        # Combine payload with request ID for additional security
        message = f"{payload}:{request_id}"

        if self.algorithm == "sha256":
            signature = hmac.new(
                self.secret_key.encode(),
                message.encode(),
                hashlib.sha256,
            ).hexdigest()
        elif self.algorithm == "sha512":
            signature = hmac.new(
                self.secret_key.encode(),
                message.encode(),
                hashlib.sha512,
            ).hexdigest()
        else:
            raise WatermarkingError(f"Unknown algorithm: {self.algorithm}")

        return signature

    def verify_signature(self, output: dict[str, Any], request_id: str) -> bool:
        """
        Verify integrity of watermarked output.

        Args:
            output: Watermarked output dictionary
            request_id: Original request ID

        Returns:
            True if signature is valid, False otherwise
        """
        if "watermark_signature" not in output:
            logger.warning("No watermark signature found in output")
            return False

        stored_signature = output["watermark_signature"]

        # Reconstruct payload without watermark
        payload_copy = {k: v for k, v in output.items() if not k.startswith("watermark")}
        payload_json = json.dumps(payload_copy, sort_keys=True, separators=(",", ":"))

        # Regenerate signature
        expected_signature = self._generate_signature(payload_json, request_id)

        # Use constant-time comparison to prevent timing attacks
        is_valid = hmac.compare_digest(stored_signature, expected_signature)

        if is_valid:
            logger.info(f"Watermark signature verified for {request_id}")
        else:
            logger.warning(f"Watermark signature verification failed for {request_id}")

        return is_valid
