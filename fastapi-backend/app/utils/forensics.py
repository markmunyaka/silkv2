"""Forensics logging and tracing via LangSmith"""

import logging
import json
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ForensicsLogger:
    """
    Logs security and processing events for audit trail.
    Integrates with LangSmith for distributed tracing.
    """

    def __init__(self, project_name: str = "pdf-summarizer", enabled: bool = True):
        self.project_name = project_name
        self.enabled = enabled
        self.logger = logging.getLogger("forensics")

    async def log_security_event(
        self,
        request_id: str,
        event_type: str,
        stage: str,
        input_data: Optional[Any] = None,
        output_data: Optional[Any] = None,
        status: str = "success",
        error: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Log a security event to audit trail.

        Args:
            request_id: Unique request identifier
            event_type: Type of event (sanitization, redaction, firewall, etc.)
            stage: Pipeline stage name
            input_data: Input to the stage
            output_data: Output from the stage
            status: success, failed, blocked
            error: Error message if status is failed
            metadata: Additional metadata

        Returns:
            Dictionary with logged event details
        """
        event = {
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "stage": stage,
            "status": status,
            "error": error,
            "metadata": metadata or {},
        }

        # Include input/output for tracing (sanitized)
        if input_data and not isinstance(input_data, bytes):
            event["input_sample"] = str(input_data)[:200]
        if output_data and not isinstance(output_data, bytes):
            event["output_sample"] = str(output_data)[:200]

        self.logger.info(json.dumps(event))

        return event

    async def log_pipeline_summary(
        self,
        request_id: str,
        total_time_ms: int,
        stages_results: dict[str, bool],
        final_output_size: int,
    ) -> None:
        """
        Log summary of entire security pipeline.

        Args:
            request_id: Unique request ID
            total_time_ms: Total processing time
            stages_results: Dictionary of stage->success mapping
            final_output_size: Size of final output
        """
        summary = {
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "pipeline_summary",
            "total_time_ms": total_time_ms,
            "all_stages_passed": all(stages_results.values()),
            "stages": stages_results,
            "final_output_bytes": final_output_size,
        }

        self.logger.info(json.dumps(summary))
