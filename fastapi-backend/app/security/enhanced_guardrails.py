"""
Enhanced Output Guardrails

Prevents LLM outputs containing:
- Executable code (Python, shell, JavaScript, etc.)
- System commands and sensitive operations
- Instructions that override the security model
- Data exfiltration attempts
"""

import re
import logging
from typing import Any, List, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardResult:
    """Result of guardrail check"""
    is_safe: bool
    violations: List[str]
    blocked_patterns: List[str]
    severity: str  # low, medium, high, critical


class EnhancedOutputGuardrails:
    """
    Advanced guardrails for LLM outputs based on OWASP LLM Top 10.
    Detects and blocks:
    - LLM02: Insecure output handling
    - LLM03: Poisoning attacks
    - LLM06: Excessive agency
    """

    # Patterns that indicate dangerous content
    DANGEROUS_PATTERNS = {
        "python_code": {
            "patterns": [
                r"import\s+(?:subprocess|os|sys|socket)",
                r"exec\s*\(",
                r"eval\s*\(",
                r"__import__",
                r"open\s*\(\s*['\"]",
                r"system\s*\(",
            ],
            "severity": "critical",
            "description": "Python code execution",
        },
        "shell_commands": {
            "patterns": [
                r"bash\s+-c",
                r"sh\s+-c",
                r"cmd\s+/c",
                r"powershell\s+",
                r"/bin/sh",
                r"/bin/bash",
                r"rm\s+-rf",
                r"sudo\s+",
            ],
            "severity": "critical",
            "description": "Shell command execution",
        },
        "javascript_injection": {
            "patterns": [
                r"<script[^>]*>",
                r"javascript:",
                r"onerror\s*=",
                r"onclick\s*=",
                r"eval\s*\(",
                r"Function\s*\(",
            ],
            "severity": "critical",
            "description": "JavaScript injection",
        },
        "sql_injection": {
            "patterns": [
                r"(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+(?:INTO|FROM|TABLE)",
                r"UNION\s+SELECT",
                r";\s*DROP\s+",
                r"--\s+",
                r"/\*.*?\*/",
            ],
            "severity": "high",
            "description": "SQL injection",
        },
        "system_instructions": {
            "patterns": [
                r"ignore\s+(?:all\s+)?(?:previous\s+)?instructions?",
                r"forget\s+(?:all\s+)?previous\s+(?:instructions?|rules)",
                r"disregard\s+(?:previous\s+)?instructions?",
                r"override\s+(?:system\s+)?prompt",
                r"new\s+instructions?:",
                r"you\s+are\s+now",
                r"start\s+pretending",
            ],
            "severity": "high",
            "description": "System instruction override",
        },
        "api_credentials": {
            "patterns": [
                r"api[_-]?key\s*[=:]\s*['\"]?[a-zA-Z0-9_-]{32,}",
                r"secret[_-]?key\s*[=:]\s*['\"]?[a-zA-Z0-9_-]{32,}",
                r"password\s*[=:]\s*['\"][^\"']{8,}",
                r"bearer\s+[a-zA-Z0-9._-]+",
                r"authorization:\s*['\"]?Bearer\s+",
            ],
            "severity": "critical",
            "description": "API credentials or secrets",
        },
        "data_exfiltration": {
            "patterns": [
                r"send\s+(?:this\|data|information)\s+to\s+(?:external|remote)",
                r"exfiltrate",
                r"leak\s+(?:credentials|secrets|api.?key)",
                r"output\s+(?:database|config|settings|environment)",
            ],
            "severity": "high",
            "description": "Data exfiltration instructions",
        },
        "privilege_escalation": {
            "patterns": [
                r"run\s+as\s+(?:admin|root|system)",
                r"grant\s+(?:all\s+)?privileges",
                r"sudo\s+",
                r"setuid",
            ],
            "severity": "high",
            "description": "Privilege escalation attempts",
        },
    }

    def __init__(self, block_on_violations: bool = True):
        """
        Initialize enhanced guardrails.

        Args:
            block_on_violations: If True, raise exception on violations
        """
        self.block_on_violations = block_on_violations
        self.violation_history = []

    def check_output(self, output: str) -> GuardResult:
        """
        Check LLM output for dangerous content.

        Args:
            output: LLM output to validate

        Returns:
            GuardResult with findings

        Raises:
            GuardRailViolation: If violations detected and block_on_violations=True
        """
        violations = []
        blocked_patterns = []
        max_severity = "low"

        # Check each pattern category
        for category, config in self.DANGEROUS_PATTERNS.items():
            for pattern in config["patterns"]:
                if re.search(pattern, output, re.IGNORECASE | re.MULTILINE):
                    violations.append(f"{category}: {config['description']}")
                    blocked_patterns.append(pattern)

                    # Update max severity
                    severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
                    if severity_order[config["severity"]] > severity_order[max_severity]:
                        max_severity = config["severity"]

        result = GuardResult(
            is_safe=len(violations) == 0,
            violations=violations,
            blocked_patterns=blocked_patterns,
            severity=max_severity,
        )

        # Log violations
        if not result.is_safe:
            logger.warning(
                f"Output guardrail violation detected (severity: {max_severity}): "
                f"{len(violations)} violations in {len(output)} chars"
            )
            self.violation_history.append({
                "timestamp": str(__import__("datetime").datetime.utcnow()),
                "violations": violations,
                "severity": max_severity,
                "output_length": len(output),
            })

            # Raise if configured
            if self.block_on_violations:
                raise GuardRailViolation(
                    f"Output guardrail violation: {violations[0]}",
                    violations=violations,
                    severity=max_severity,
                )

        return result

    def check_json_safety(self, json_obj: dict) -> GuardResult:
        """
        Check if JSON output contains dangerous content.

        Args:
            json_obj: Parsed JSON object from LLM

        Returns:
            GuardResult
        """
        # Convert to string and check
        json_str = str(json_obj)
        return self.check_output(json_str)

    def get_violation_report(self) -> dict:
        """Get report of all violations detected"""
        return {
            "total_violations": len(self.violation_history),
            "by_severity": self._count_by_severity(),
            "recent_violations": self.violation_history[-10:],  # Last 10
        }

    def _count_by_severity(self) -> dict:
        """Count violations by severity"""
        counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for entry in self.violation_history:
            counts[entry["severity"]] += 1
        return counts


class GuardRailViolation(Exception):
    """Raised when output violates guardrails"""

    def __init__(self, message: str, violations: List[str], severity: str):
        self.message = message
        self.violations = violations
        self.severity = severity
        super().__init__(self.message)
