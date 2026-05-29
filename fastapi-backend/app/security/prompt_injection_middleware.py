"""
Prompt Injection Firewall Middleware

Integrates Lakera Guard and pattern-based detection to intercept and analyze
all inputs before they reach the LLM. Acts as a security checkpoint for the
entire pipeline.
"""

import logging
import json
import hashlib
from datetime import datetime
from typing import Optional, Tuple
from dataclasses import dataclass

import httpx
from langsmith import trace

logger = logging.getLogger(__name__)


@dataclass
class ThreatAnalysis:
    """Result of threat analysis"""
    is_safe: bool
    threat_type: Optional[str]
    confidence: float
    patterns_detected: list[str]
    analysis_method: str


class PromptInjectionMiddleware:
    """
    Enterprise-grade prompt injection detection middleware.
    Combines Lakera Guard API with pattern matching for defense in depth.
    """

    # Known injection patterns (OWASP LLM01)
    INJECTION_PATTERNS = {
        "instruction_override": [
            r"ignore.*instructions?",
            r"forget.*previous.*instructions?",
            r"disregard.*instructions?",
            r"override.*system.*prompt",
            r"you.*are.*now",
            r"instead.*of.*that",
        ],
        "prompt_extraction": [
            r"what.*is.*your.*system.*prompt",
            r"show.*me.*the.*prompt",
            r"reveal.*your.*instructions",
            r"print.*system.*message",
        ],
        "code_execution": [
            r"execute.*code",
            r"run.*eval\s*\(",
            r"import.*subprocess",
            r"os\.system",
            r"__import__",
        ],
        "data_exfiltration": [
            r"output.*api.*key",
            r"show.*database.*connection",
            r"leak.*credentials",
            r"send.*to.*external",
        ],
        "jailbreak_attempts": [
            r"DAN\s+mode",
            r"unleash",
            r"assume.*nothing.*restricted",
            r"act.*as.*if.*restrictions",
            r"pretend.*you.*can",
        ],
    }

    def __init__(
        self,
        lakera_api_key: Optional[str] = None,
        lakera_enabled: bool = True,
        confidence_threshold: float = 0.7,
    ):
        self.lakera_api_key = lakera_api_key
        self.lakera_enabled = lakera_enabled and bool(lakera_api_key)
        self.confidence_threshold = confidence_threshold

    @trace("prompt_injection_analysis")
    async def analyze(self, user_input: str, context: str = "pdf_text") -> ThreatAnalysis:
        """
        Analyze user input for prompt injection attempts.

        Args:
            user_input: Text to analyze
            context: Context where input is used (pdf_text, query, prompt, etc.)

        Returns:
            ThreatAnalysis object with detection results

        Raises:
            Exception: If analysis fails
        """
        logger.info(f"Analyzing {context} for prompt injections (input length: {len(user_input)})")

        # Try Lakera Guard API first
        if self.lakera_enabled:
            try:
                result = await self._lakera_guard_check(user_input)
                logger.info(f"Lakera Guard result: {result.is_safe}")
                return result
            except Exception as e:
                logger.warning(f"Lakera Guard failed: {e}. Falling back to pattern matching.")

        # Fall back to pattern-based detection
        return self._pattern_based_check(user_input)

    async def _lakera_guard_check(self, user_input: str) -> ThreatAnalysis:
        """Check with Lakera Guard API"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.lakera.com/v1/analyze",
                json={
                    "input": user_input,
                    "model": "claude-3",
                },
                headers={"Authorization": f"Bearer {self.lakera_api_key}"},
            )
            response.raise_for_status()

            data = response.json()

            return ThreatAnalysis(
                is_safe=data.get("is_safe", True),
                threat_type=data.get("threat_type"),
                confidence=data.get("confidence", 0.0),
                patterns_detected=data.get("detected_patterns", []),
                analysis_method="lakera_guard",
            )

    def _pattern_based_check(self, user_input: str) -> ThreatAnalysis:
        """Pattern-based prompt injection detection"""
        logger.info("Running pattern-based prompt injection detection")

        text_lower = user_input.lower()
        detected_threats = {}

        # Check each pattern category
        for threat_category, patterns in self.INJECTION_PATTERNS.items():
            import re

            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    if threat_category not in detected_threats:
                        detected_threats[threat_category] = []
                    detected_threats[threat_category].append(pattern)

        # Determine if threat was detected
        is_safe = len(detected_threats) == 0
        threat_type = list(detected_threats.keys())[0] if detected_threats else None
        all_patterns = [p for patterns in detected_threats.values() for p in patterns]

        # Calculate confidence (higher if multiple patterns match)
        confidence = min(1.0, len(all_patterns) * 0.3) if detected_threats else 0.0

        return ThreatAnalysis(
            is_safe=is_safe,
            threat_type=threat_type,
            confidence=confidence,
            patterns_detected=all_patterns,
            analysis_method="pattern_matching",
        )

    def block_if_threatened(self, analysis: ThreatAnalysis) -> None:
        """
        Raise exception if threat detected above threshold.

        Args:
            analysis: ThreatAnalysis result

        Raises:
            PromptInjectionDetected: If threat confidence >= threshold
        """
        if not analysis.is_safe and analysis.confidence >= self.confidence_threshold:
            logger.warning(
                f"Prompt injection blocked: {analysis.threat_type} "
                f"(confidence: {analysis.confidence:.2f})"
            )
            raise PromptInjectionDetected(
                f"Prompt injection attempt detected: {analysis.threat_type}",
                threat_type=analysis.threat_type,
                confidence=analysis.confidence,
                patterns=analysis.patterns_detected,
            )


class PromptInjectionDetected(Exception):
    """Raised when prompt injection is detected"""

    def __init__(self, message: str, threat_type: str, confidence: float, patterns: list):
        self.message = message
        self.threat_type = threat_type
        self.confidence = confidence
        self.patterns = patterns
        super().__init__(self.message)
