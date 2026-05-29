"""
Enhanced Security Middleware Pipeline

Integrates all security controls:
- Rate limiting (token-based)
- Request tracking
- Security incident logging
- Jailbreak attempt detection and logging
"""

import logging
import time
from typing import Optional, Tuple, Dict, Any
from functools import wraps

from .rate_limiter import RateLimiter, RateLimitConfig
from .security_incident_logger import SecurityIncidentLogger
from .prompt_firewall import PromptFirewall
from .context_isolation import ContextIsolationManager
from .pii_redaction import PIIRedactor
from .pii_deanonymization import PIIDeanonymizer
from .enhanced_guardrails import EnhancedOutputGuardrails
from pathlib import Path

logger = logging.getLogger(__name__)


class SecurityMiddlewareStack:
    """
    Comprehensive security middleware integrating all OWASP LLM Top 10 controls.
    """

    def __init__(
        self,
        lakera_api_key: Optional[str] = None,
        security_log_path: str = "./logs/security_incidents.jsonl",
        rate_limit_config: Optional[RateLimitConfig] = None,
    ):
        self.rate_limiter = RateLimiter(config=rate_limit_config or RateLimitConfig())
        self.incident_logger = SecurityIncidentLogger(
            log_file=Path(security_log_path),
            signing_key="secure-llm-incident-logger",
        )
        self.firewall = PromptFirewall(api_key=lakera_api_key, enabled=True)
        self.context_isolation = ContextIsolationManager()
        self.pii_redactor = PIIRedactor(enabled=True)
        self.pii_deanonymizer = PIIDeanonymizer()
        self.guardrails = EnhancedOutputGuardrails(enabled=True)

    async def process_user_input(
        self,
        text: str,
        client_ip: str,
        user_id: Optional[str] = None,
        operation: str = "api_call",
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Process user input through complete security pipeline.

        Args:
            text: User input text
            client_ip: Client IP address
            user_id: Authenticated user ID
            operation: Type of operation (pdf_upload, llm_call, etc.)

        Returns:
            Tuple of (processed_text, security_metadata)

        Raises:
            SecurityException: If any security check fails
        """
        metadata = {
            "client_ip": client_ip,
            "user_id": user_id,
            "operation": operation,
            "checks_passed": {},
        }

        try:
            # 1. RATE LIMITING
            allowed, rate_limit_reason = self.rate_limiter.is_allowed(
                client_ip=client_ip,
                operation=operation,
                user_id=user_id,
            )

            if not allowed:
                logger.warning(f"Rate limit violation: {rate_limit_reason}")
                self.incident_logger.log_rate_limit_breach(
                    client_ip=client_ip,
                    operation=operation,
                    tokens_requested=500,  # Estimated
                    tokens_available=0,
                    user_id=user_id,
                )
                raise Exception(f"Rate limit exceeded: {rate_limit_reason}")

            metadata["checks_passed"]["rate_limiting"] = True

            # 2. PROMPT INJECTION FIREWALL
            is_safe, firewall_metadata = await self.firewall.check(text)

            if not is_safe:
                logger.warning("Prompt injection detected")
                self.incident_logger.log_jailbreak_attempt(
                    client_ip=client_ip,
                    threat_type=firewall_metadata.get("threat_type", "unknown"),
                    patterns_detected=firewall_metadata.get("detected_patterns", []),
                    user_id=user_id,
                )
                raise Exception(
                    f"Security threat detected: {firewall_metadata.get('threat_type')}"
                )

            metadata["checks_passed"]["prompt_firewall"] = True
            metadata["firewall_metadata"] = firewall_metadata

            # 3. CONTEXT ISOLATION
            isolated_text, isolation_id = self.context_isolation.wrap_untrusted_data(
                text, data_source="user_input"
            )
            metadata["isolation_id"] = isolation_id
            metadata["checks_passed"]["context_isolation"] = True

            # 4. PII REDACTION
            redacted_text, redaction_metadata = await self.pii_redactor.redact(text)
            metadata["pii_redaction"] = redaction_metadata
            metadata["checks_passed"]["pii_redaction"] = True

            # 5. Store de-anonymization mapping (securely)
            if redaction_metadata.get("pii_found"):
                self.pii_deanonymizer.store_mapping(
                    request_id=isolation_id,
                    original_text=text,
                    redacted_text=redacted_text,
                )
                metadata["deanon_available"] = True

            logger.info(
                f"Security pipeline passed for {client_ip}: "
                f"isolation_id={isolation_id}, pii_found={redaction_metadata.get('pii_found')}"
            )

            return isolated_text if redacted_text == text else redacted_text, metadata

        except Exception as e:
            logger.error(f"Security pipeline failed: {str(e)}")
            raise

    async def validate_llm_output(
        self,
        output: str,
        client_ip: str,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate LLM output against security guardrails.

        Args:
            output: LLM output text
            client_ip: Client IP address
            user_id: Authenticated user ID
            request_id: Request ID for tracking

        Returns:
            Tuple of (is_valid, validation_metadata)
        """
        try:
            logger.info(f"Validating LLM output for request {request_id}")

            result = self.guardrails.check_output(output)

            if violations:
                logger.warning(f"Output validation failed: {violations}")
                severity = "critical" if any(v["severity"] == "critical" for v in violations) else "high"
                self.incident_logger.log_output_violation(
                    client_ip=client_ip,
                    violation_type="guardrail_breach",
                    violations=result.violations,
                    severity=severity,
                    user_id=user_id,
                )
                return False, {
                    "valid": False,
                    "violations": result.violations,
                    "request_id": request_id,
                }

            logger.info(f"Output validation passed for request {request_id}")
            return True, {
                "valid": True,
                "violations": [],
                "request_id": request_id,
            }

        except Exception as e:
            logger.error(f"Output validation error: {str(e)}")
            raise

    def get_security_status(self, client_ip: str, user_id: Optional[str] = None) -> dict:
        """Get current security status for a client"""
        return {
            "rate_limit_status": self.rate_limiter.get_status(client_ip, user_id),
            "incident_stats": self.incident_logger.get_statistics(),
            "isolation_stats": self.context_isolation.get_isolation_stats(),
        }

    def get_incident_report(
        self,
        incident_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
    ) -> list:
        """Get security incident report"""
        return self.incident_logger.get_incident_report(
            incident_type=incident_type,
            severity=severity,
            limit=limit,
        )

    def verify_log_integrity(self) -> Tuple[bool, str]:
        """Verify security log integrity"""
        return self.incident_logger.verify_log_integrity()
