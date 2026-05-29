"""
Security Incident Logging System

Logs all security violations, jailbreak attempts, rate limit breaches,
and other suspicious activities in a structured, tamper-evident format.
"""

import json
import logging
import hashlib
import hmac
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class SecurityIncident:
    """Structured security incident record"""
    timestamp: str
    incident_type: str  # jailbreak, injection, rate_limit, pii_exposure, etc.
    severity: str  # low, medium, high, critical
    client_ip: str
    user_id: Optional[str]
    description: str
    details: Dict[str, Any]
    
    # Integrity verification
    hash: Optional[str] = None
    previous_hash: Optional[str] = None


class SecurityIncidentLogger:
    """
    Comprehensive security logging with tamper detection.
    Creates a chain of hashed logs (like a blockchain) to detect
    if logs have been modified.
    """

    def __init__(
        self,
        log_file: Path,
        signing_key: str = "default-signing-key",
    ):
        self.log_file = Path(log_file)
        self.signing_key = signing_key.encode()
        self.previous_hash = None
        self.incident_count = 0

        # Create log file if it doesn't exist
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.log_file.exists():
            self.log_file.write_text("")

        # Load last hash from existing logs
        self._load_last_hash()

    def _load_last_hash(self) -> None:
        """Load the last hash from the log file for chain integrity"""
        try:
            lines = self.log_file.read_text().strip().split("\n")
            if lines and lines[-1]:
                last_log = json.loads(lines[-1])
                self.previous_hash = last_log.get("hash")
        except Exception as e:
            logger.warning(f"Could not load last hash: {e}")

    def _compute_hash(
        self,
        incident_data: str,
        previous_hash: Optional[str] = None,
    ) -> str:
        """
        Compute HMAC-SHA256 hash for log integrity.

        Args:
            incident_data: JSON string of incident
            previous_hash: Hash of previous log entry (for chain)

        Returns:
            Hex-encoded HMAC hash
        """
        message = f"{incident_data}:{previous_hash or '0'}"
        return hmac.new(
            self.signing_key,
            message.encode(),
            hashlib.sha256,
        ).hexdigest()

    def log_jailbreak_attempt(
        self,
        client_ip: str,
        threat_type: str,
        patterns_detected: list,
        user_id: Optional[str] = None,
    ) -> SecurityIncident:
        """
        Log a jailbreak/prompt injection attempt.

        Args:
            client_ip: Client IP address
            threat_type: Type of threat (instruction_override, code_execution, etc.)
            patterns_detected: List of patterns that matched
            user_id: Optional user ID if authenticated
        """
        incident = SecurityIncident(
            timestamp=datetime.utcnow().isoformat(),
            incident_type="jailbreak_attempt",
            severity="high",
            client_ip=client_ip,
            user_id=user_id,
            description=f"Prompt injection attempt: {threat_type}",
            details={
                "threat_type": threat_type,
                "patterns_detected": patterns_detected[:5],  # First 5 patterns
                "pattern_count": len(patterns_detected),
            },
        )
        return self._write_incident(incident)

    def log_output_violation(
        self,
        client_ip: str,
        violation_type: str,
        violations: list,
        severity: str,
        user_id: Optional[str] = None,
    ) -> SecurityIncident:
        """
        Log an output guardrail violation.

        Args:
            client_ip: Client IP address
            violation_type: Type of violation (code_execution, credentials, etc.)
            violations: List of violations detected
            severity: Severity level
            user_id: Optional user ID
        """
        incident = SecurityIncident(
            timestamp=datetime.utcnow().isoformat(),
            incident_type="output_violation",
            severity=severity,
            client_ip=client_ip,
            user_id=user_id,
            description=f"Output guardrail violation: {violation_type}",
            details={
                "violation_type": violation_type,
                "violations": violations[:3],  # First 3
                "violation_count": len(violations),
            },
        )
        return self._write_incident(incident)

    def log_rate_limit_breach(
        self,
        client_ip: str,
        operation: str,
        tokens_requested: int,
        tokens_available: int,
        user_id: Optional[str] = None,
    ) -> SecurityIncident:
        """
        Log a rate limit violation.

        Args:
            client_ip: Client IP address
            operation: Operation that was rate limited
            tokens_requested: Tokens requested
            tokens_available: Tokens available
            user_id: Optional user ID
        """
        incident = SecurityIncident(
            timestamp=datetime.utcnow().isoformat(),
            incident_type="rate_limit_exceeded",
            severity="medium",
            client_ip=client_ip,
            user_id=user_id,
            description=f"Rate limit exceeded for operation: {operation}",
            details={
                "operation": operation,
                "tokens_requested": tokens_requested,
                "tokens_available": tokens_available,
                "deficit": tokens_requested - tokens_available,
            },
        )
        return self._write_incident(incident)

    def log_pii_exposure(
        self,
        client_ip: str,
        pii_type: str,
        detection_method: str,
        user_id: Optional[str] = None,
    ) -> SecurityIncident:
        """
        Log a potential PII exposure.

        Args:
            client_ip: Client IP address
            pii_type: Type of PII (email, phone, ssn, etc.)
            detection_method: How it was detected
            user_id: Optional user ID
        """
        incident = SecurityIncident(
            timestamp=datetime.utcnow().isoformat(),
            incident_type="pii_exposure",
            severity="critical",
            client_ip=client_ip,
            user_id=user_id,
            description=f"Potential PII exposure detected: {pii_type}",
            details={
                "pii_type": pii_type,
                "detection_method": detection_method,
            },
        )
        return self._write_incident(incident)

    def log_suspicious_activity(
        self,
        client_ip: str,
        activity_type: str,
        description: str,
        details: Dict,
        severity: str = "medium",
        user_id: Optional[str] = None,
    ) -> SecurityIncident:
        """
        Log other suspicious activities.

        Args:
            client_ip: Client IP address
            activity_type: Type of suspicious activity
            description: Human-readable description
            details: Additional details
            severity: Severity level
            user_id: Optional user ID
        """
        incident = SecurityIncident(
            timestamp=datetime.utcnow().isoformat(),
            incident_type=activity_type,
            severity=severity,
            client_ip=client_ip,
            user_id=user_id,
            description=description,
            details=details,
        )
        return self._write_incident(incident)

    def _write_incident(self, incident: SecurityIncident) -> SecurityIncident:
        """Write incident to log file with integrity verification"""
        # Serialize incident
        incident_dict = asdict(incident)
        incident_json = json.dumps(incident_dict, default=str)

        # Compute hash for integrity
        incident.hash = self._compute_hash(incident_json, self.previous_hash)
        incident.previous_hash = self.previous_hash

        # Update serialized data with hash
        incident_dict = asdict(incident)
        log_line = json.dumps(incident_dict, default=str)

        # Append to log file
        try:
            with open(self.log_file, "a") as f:
                f.write(log_line + "\n")

            self.previous_hash = incident.hash
            self.incident_count += 1

            logger.warning(
                f"Security incident logged: {incident.incident_type} "
                f"(severity: {incident.severity}, IP: {incident.client_ip})"
            )

        except Exception as e:
            logger.error(f"Failed to write security incident: {e}")

        return incident

    def get_incident_report(
        self,
        incident_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
    ) -> list:
        """
        Retrieve incidents from log file.

        Args:
            incident_type: Filter by incident type
            severity: Filter by severity
            limit: Maximum incidents to return

        Returns:
            List of incidents
        """
        incidents = []
        try:
            lines = self.log_file.read_text().strip().split("\n")

            for line in lines[-limit:]:
                if not line:
                    continue

                incident_dict = json.loads(line)

                if incident_type and incident_dict.get("incident_type") != incident_type:
                    continue

                if severity and incident_dict.get("severity") != severity:
                    continue

                incidents.append(incident_dict)

        except Exception as e:
            logger.error(f"Failed to read incident report: {e}")

        return incidents

    def verify_log_integrity(self) -> Tuple[bool, str]:
        """
        Verify the integrity of the log file by checking hashes.

        Returns:
            Tuple of (is_valid, report)
        """
        try:
            lines = self.log_file.read_text().strip().split("\n")

            if not lines or not lines[0]:
                return True, "Log file is empty"

            previous_hash = None

            for i, line in enumerate(lines):
                if not line:
                    continue

                incident_dict = json.loads(line)
                stored_hash = incident_dict.get("hash")

                # Reconstruct the incident data without hash
                incident_dict_copy = incident_dict.copy()
                incident_dict_copy.pop("hash", None)
                incident_json = json.dumps(incident_dict_copy, default=str)

                # Recompute hash
                expected_hash = self._compute_hash(incident_json, previous_hash)

                if stored_hash != expected_hash:
                    return False, f"Hash mismatch at line {i+1}: log may have been tampered"

                previous_hash = stored_hash

            return True, f"Log integrity verified ({len(lines)} entries)"

        except Exception as e:
            return False, f"Failed to verify log integrity: {e}"

    def get_statistics(self) -> dict:
        """Get statistics about security incidents"""
        incidents = self.get_incident_report(limit=10000)

        incident_types = {}
        severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        top_ips = {}

        for incident in incidents:
            # Count by type
            itype = incident.get("incident_type")
            incident_types[itype] = incident_types.get(itype, 0) + 1

            # Count by severity
            sev = incident.get("severity")
            if sev in severity_counts:
                severity_counts[sev] += 1

            # Track top IPs
            ip = incident.get("client_ip")
            if ip:
                top_ips[ip] = top_ips.get(ip, 0) + 1

        return {
            "total_incidents": len(incidents),
            "by_type": incident_types,
            "by_severity": severity_counts,
            "top_offending_ips": sorted(top_ips.items(), key=lambda x: x[1], reverse=True)[:10],
        }
