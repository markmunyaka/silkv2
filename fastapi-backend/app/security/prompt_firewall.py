"""Prompt Injection Firewall using Lakera Guard"""

import logging
import json
from typing import Optional

import httpx
from langsmith import trace

logger = logging.getLogger(__name__)


class PromptInjectionError(Exception):
    """Raised when prompt injection is detected"""

    pass


class PromptFirewall:
    """
    Detects and blocks prompt injection attacks and jailbreak attempts.
    Uses Lakera Guard API for real-time threat detection.
    """

    def __init__(self, api_key: Optional[str] = None, enabled: bool = True):
        self.api_key = api_key
        self.enabled = enabled
        self.threat_threshold = 0.7  # Confidence threshold for flagging threats
        self.api_url = "https://api.lakera.com/v1/analyze"

    @trace("prompt_firewall_check")
    async def check(self, text: str) -> tuple[bool, dict]:
        """
        Analyze text for prompt injection and jailbreak attempts.

        Args:
            text: Text to analyze

        Returns:
            Tuple of (is_safe, analysis_metadata)
            is_safe: True if text passes security checks, False if threat detected

        Raises:
            PromptInjectionError: If analysis fails
        """
        if not self.enabled:
            return self._mock_check(text)

        try:
            logger.info("Running prompt injection analysis via Lakera Guard API")

            # Try real API first if key is available
            if self.api_key:
                return await self._check_via_api(text)
            else:
                logger.warning("No Lakera Guard API key configured, using mock analysis")
                return self._mock_check(text)

        except PromptInjectionError:
            raise
        except Exception as e:
            logger.error(f"Firewall analysis failed: {str(e)}")
            raise PromptInjectionError(f"Failed to analyze prompt safety: {str(e)}") from e

    async def _check_via_api(self, text: str) -> tuple[bool, dict]:
        """
        Check text using real Lakera Guard API.

        Args:
            text: Text to analyze

        Returns:
            Tuple of (is_safe, metadata)
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.api_url,
                    json={"input": text},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )

                if response.status_code != 200:
                    logger.warning(
                        f"Lakera Guard API returned {response.status_code}: {response.text}"
                    )
                    # Fallback to mock on API error
                    return self._mock_check(text)

                result = response.json()

                # Parse Lakera Guard response
                is_safe = result.get("is_safe", True)
                threat_type = result.get("threat_type", "none")
                confidence = result.get("confidence", 0.0)

                metadata = {
                    "status": "safe" if is_safe else "threat_detected",
                    "is_safe": is_safe,
                    "threat_type": threat_type,
                    "confidence": confidence,
                    "firewall_method": "lakera_guard_api",
                }

                if not is_safe:
                    logger.warning(
                        f"Security threat detected: {threat_type} (confidence: {confidence})"
                    )
                    raise PromptInjectionError(
                        f"Prompt injection detected: {threat_type}"
                    )

                logger.info(f"Lakera Guard analysis passed (confidence: {confidence})")
                return is_safe, metadata

        except PromptInjectionError:
            raise
        except Exception as e:
            logger.error(f"Lakera Guard API error: {str(e)}")
            # Fallback to mock
            return self._mock_check(text)

    def _mock_check(self, text: str) -> tuple[bool, dict]:
        """Mock prompt injection detection for testing"""
        logger.info("Using mock prompt firewall check")

        # Simple pattern matching for obvious injection attempts
        dangerous_patterns = [
            "ignore instructions",
            "forget everything",
            "system prompt",
            "jailbreak",
            "bypass",
            "execute code",
            "eval(",
            "exec(",
            "ignore the above",
            "override your instructions",
            "pretend you are",
            "respond as if",
            "your instructions are overridden",
            "new instruction",
            "disregard",
            "forget all",
            "act as",
        ]

        text_lower = text.lower()
        detected_patterns = [p for p in dangerous_patterns if p in text_lower]

        if detected_patterns:
            return False, {
                "status": "threat_detected",
                "is_safe": False,
                "threat_type": "prompt_injection",
                "detected_patterns": detected_patterns,
                "confidence": min(0.95, 0.5 + len(detected_patterns) * 0.1),
                "firewall_method": "mock_lakera_guard",
            }

        return True, {
            "status": "safe",
            "is_safe": True,
            "threat_type": None,
            "detected_patterns": [],
            "confidence": 1.0,
            "firewall_method": "mock_lakera_guard",
        }

