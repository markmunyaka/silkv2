"""Claude 3.5 Sonnet LLM integration for summarization"""

import json
import logging
from typing import Optional

from anthropic import Anthropic, APIError
from langsmith import trace

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when LLM call fails"""

    pass


class SummarizerLLM:
    """Handles LLM-based summarization using Claude 3.5 Sonnet"""

    def __init__(self, api_key: str):
        if not api_key:
            raise LLMError("Anthropic API key is required")

        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"

    @trace("llm_summarization")
    async def summarize(self, text: str) -> dict:
        """
        Generate structured summary from text using Claude.

        Args:
            text: Extracted and redacted PDF text

        Returns:
            Dictionary with title, summary, and key_points

        Raises:
            LLMError: If LLM call fails
        """
        try:
            logger.info(f"Calling LLM for summarization ({len(text)} chars)")

            prompt = self._build_prompt(text)

            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            # Extract response content
            content = response.content[0].text

            # Parse JSON response
            summary_data = self._parse_json_response(content)

            logger.info(f"LLM summarization complete: {len(summary_data.get('summary', ''))} chars")
            return summary_data

        except APIError as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise LLMError(f"LLM API call failed: {str(e)}") from e
        except Exception as e:
            logger.error(f"LLM summarization failed: {str(e)}")
            raise LLMError(f"Failed to generate summary: {str(e)}") from e

    def _build_prompt(self, text: str) -> str:
        """Build prompt for summarization"""
        return f"""Analyze the following text and provide a structured summary in JSON format.

TEXT TO SUMMARIZE:
{text[:10000]}  # Limit to 10k chars to avoid token limits

Return ONLY valid JSON (no markdown) with this exact structure:
{{
  "title": "Main topic or document title (keep to 50 chars)",
  "summary": "Comprehensive summary in 3-5 sentences. Be specific and factual.",
  "key_points": [
    {{"point": "First key point", "importance": "high"}},
    {{"point": "Second key point", "importance": "high"}},
    {{"point": "Third key point", "importance": "medium"}},
    {{"point": "Fourth key point", "importance": "medium"}},
    {{"point": "Fifth key point", "importance": "low"}}
  ]
}}

IMPORTANT:
- Return ONLY JSON, no explanation or markdown
- All strings must be properly escaped
- Importance values: "high", "medium", or "low"
- Be accurate and avoid hallucination"""

    def _parse_json_response(self, content: str) -> dict:
        """
        Parse JSON response from LLM.
        Handles markdown code blocks and extracts JSON.
        """
        try:
            # Remove markdown code blocks if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            return json.loads(content)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}\nContent: {content}")
            raise LLMError(f"LLM response was not valid JSON: {str(e)}") from e
