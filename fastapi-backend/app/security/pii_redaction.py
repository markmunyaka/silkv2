"""PII Redaction using Presidio"""

import logging
from typing import Optional

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from langsmith import trace

logger = logging.getLogger(__name__)


class PIIRedactionError(Exception):
    """Raised when PII redaction fails"""

    pass


class PIIRedactor:
    """
    Identifies and redacts Personally Identifiable Information (PII)
    including names, emails, phone numbers, ID numbers, etc.
    Uses Microsoft Presidio for PII detection and anonymization.
    """

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.analyzer_engine: Optional[AnalyzerEngine] = None
        self.anonymizer_engine: Optional[AnonymizerEngine] = None

        if self.enabled:
            try:
                self.analyzer_engine = AnalyzerEngine()
                self.anonymizer_engine = AnonymizerEngine()
                logger.info("Presidio PII detection engine initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Presidio: {e}. Using mock PII redaction.")
                self.enabled = False

    @trace("pii_redaction")
    async def redact(self, text: str) -> tuple[str, dict]:
        """
        Identify and redact PII from text.

        Args:
            text: Input text that may contain PII

        Returns:
            Tuple of (redacted_text, redaction_metadata)

        Raises:
            PIIRedactionError: If redaction fails
        """
        if not self.enabled:
            return self._mock_redaction(text)

        try:
            logger.info("Starting PII redaction analysis")

            # Analyze text for PII
            results = self.analyzer_engine.analyze(
                text=text,
                language="en",
                score_threshold=0.5,
            )

            if not results:
                logger.info("No PII detected in text")
                return text, {
                    "status": "completed",
                    "pii_found": False,
                    "entities_redacted": 0,
                    "redaction_method": "presidio",
                }

            # Anonymize detected entities
            redacted = self.anonymizer_engine.anonymize(
                text=text,
                analyzer_results=results,
                operators={
                    "PERSON": OperatorConfig("replace", {"new_value": "[PERSON_NAME]"}),
                    "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL]"}),
                    "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE]"}),
                    "CREDIT_CARD": OperatorConfig("replace", {"new_value": "[CREDIT_CARD]"}),
                    "IBAN_CODE": OperatorConfig("replace", {"new_value": "[IBAN]"}),
                    "US_SSN": OperatorConfig("replace", {"new_value": "[SSN]"}),
                    "ID_NUMBER": OperatorConfig("replace", {"new_value": "[ID]"}),
                    "ADDRESS": OperatorConfig("replace", {"new_value": "[ADDRESS]"}),
                    "DATE_TIME": OperatorConfig("replace", {"new_value": "[DATE]"}),
                    "IP_ADDRESS": OperatorConfig("replace", {"new_value": "[IP]"}),
                    "URL": OperatorConfig("replace", {"new_value": "[URL]"}),
                },
            )

            # Collect entity statistics
            entity_counts = {}
            for result in results:
                entity_type = result.entity_type
                entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1

            metadata = {
                "status": "completed",
                "pii_found": True,
                "entities_redacted": len(results),
                "entity_breakdown": entity_counts,
                "redaction_method": "presidio",
            }

            logger.info(f"PII redaction complete: {len(results)} entities masked")
            return redacted.text, metadata

        except Exception as e:
            logger.error(f"PII redaction failed: {str(e)}")
            raise PIIRedactionError(f"Failed to redact PII: {str(e)}") from e

    def _mock_redaction(self, text: str) -> tuple[str, dict]:
        """Mock PII redaction for testing"""
        logger.info("Using mock PII redaction")
        
        # Simple pattern matching for demonstration
        import re
        
        redacted = text
        patterns = {
            r'\b[A-Za-z]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b': '[EMAIL]',
            r'\b\d{3}-\d{3}-\d{4}\b': '[PHONE]',
            r'\b(?:\d{3}-){2}\d{4}\b': '[SSN]',
        }
        
        for pattern, replacement in patterns.items():
            redacted = re.sub(pattern, replacement, redacted)
        
        return redacted, {
            "status": "completed",
            "pii_found": False,
            "entities_redacted": 0,
            "redaction_method": "mock",
        }
