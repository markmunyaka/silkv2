"""Output validation using Guardrails AI"""

import json
import logging
from typing import Optional, Any

from pydantic import BaseModel, ValidationError
from langsmith import trace

logger = logging.getLogger(__name__)


class OutputValidationError(Exception):
    """Raised when output validation fails"""

    pass


class OutputValidator:
    """
    Validates LLM output against a defined schema.
    Uses Guardrails AI for structured validation.
    """

    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    @trace("output_validation")
    async def validate(self, output: dict[str, Any], schema: BaseModel) -> tuple[dict, dict]:
        """
        Validate JSON output against Pydantic schema.

        Args:
            output: Dictionary output from LLM
            schema: Pydantic model defining expected structure

        Returns:
            Tuple of (validated_data, validation_metadata)

        Raises:
            OutputValidationError: If validation fails
        """
        if not self.enabled:
            return output, {"status": "skipped", "validation_enabled": False}

        try:
            logger.info("Validating LLM output against schema")

            # Validate output against schema
            validated = schema(**output)

            metadata = {
                "status": "valid",
                "schema_name": schema.__class__.__name__,
                "validation_method": "pydantic",
                "required_fields": list(schema.__fields__.keys()),
                "missing_fields": [],
            }

            logger.info(f"Output validation passed for {schema.__class__.__name__}")
            return validated.model_dump(), metadata

        except ValidationError as e:
            logger.error(f"Output validation failed: {str(e)}")

            # Extract missing fields
            missing_fields = [
                err.get("loc", ["unknown"])[0] for err in e.errors()
                if "required" in str(err).lower()
            ]

            raise OutputValidationError(
                f"Output does not match schema: {str(e)}\nMissing fields: {missing_fields}"
            ) from e

        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            raise OutputValidationError(f"Failed to validate output: {str(e)}") from e

    def validate_json_structure(self, text: str) -> tuple[dict, dict]:
        """
        Ensure output is valid JSON and parse it.

        Args:
            text: Text that should contain JSON

        Returns:
            Tuple of (parsed_dict, parse_metadata)
        """
        try:
            logger.info("Validating JSON structure")
            
            # Handle potential markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(text)

            metadata = {
                "status": "valid_json",
                "parser": "json",
                "contains_markdown_blocks": False,
            }

            logger.info("JSON structure validation passed")
            return parsed, metadata

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {str(e)}")
            raise OutputValidationError(f"Output is not valid JSON: {str(e)}") from e
