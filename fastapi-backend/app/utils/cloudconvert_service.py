"""CloudConvert API integration for PDF conversion"""

import logging
from typing import Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


class CloudConvertError(Exception):
    """Raised when CloudConvert API call fails"""
    pass


class CloudConvertService:
    """Service for converting PDFs using CloudConvert API"""

    BASE_URL = "https://api.cloudconvert.com"

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.cloudconvert_api_key
        self.enabled = self.settings.cloudconvert_enabled

    def is_available(self) -> bool:
        """Check if CloudConvert is enabled and API key is set"""
        return self.enabled and bool(self.api_key)

    async def convert_pdf_to_images(
        self, pdf_bytes: bytes, output_format: str = "png"
    ) -> list[bytes]:
        """
        Convert PDF to images using CloudConvert API

        Args:
            pdf_bytes: Raw PDF file bytes
            output_format: Output image format (png, jpg, webp, etc.)

        Returns:
            List of image bytes, one per page

        Raises:
            CloudConvertError: If conversion fails
        """
        if not self.is_available():
            raise CloudConvertError(
                "CloudConvert is not enabled. Set CLOUDCONVERT_ENABLED=true "
                "and provide CLOUDCONVERT_API_KEY"
            )

        try:
            async with httpx.AsyncClient() as client:
                # Create conversion job
                job_response = await self._create_job(
                    client, pdf_bytes, output_format
                )
                job_id = job_response.get("data", {}).get("id")

                if not job_id:
                    raise CloudConvertError("Failed to create conversion job")

                logger.info(f"Created CloudConvert job: {job_id}")

                # Poll for completion
                images = await self._wait_for_completion(client, job_id)
                return images

        except httpx.HTTPError as e:
            logger.error(f"CloudConvert API error: {str(e)}")
            raise CloudConvertError(f"CloudConvert API error: {str(e)}") from e
        except Exception as e:
            logger.error(f"PDF conversion failed: {str(e)}")
            raise CloudConvertError(f"PDF conversion failed: {str(e)}") from e

    async def _create_job(
        self, client: httpx.AsyncClient, pdf_bytes: bytes, output_format: str
    ) -> dict:
        """Create a CloudConvert conversion job"""
        headers = {"Authorization": f"Bearer {self.api_key}"}

        # Upload file and create job
        files = {"file": ("document.pdf", pdf_bytes, "application/pdf")}
        data = {
            "tasks": {
                "upload-file": {"file": pdf_bytes},
                "convert-file": {
                    "input": "upload-file",
                    "output_format": output_format,
                    "engine": "imagemagick",
                },
                "export-file": {"input": "convert-file"},
            }
        }

        response = await client.post(
            f"{self.BASE_URL}/v2/jobs",
            headers=headers,
            json=data,
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()

    async def _wait_for_completion(
        self, client: httpx.AsyncClient, job_id: str, max_polls: int = 60
    ) -> list[bytes]:
        """Poll job status until completion and download results"""
        import asyncio
        import time

        headers = {"Authorization": f"Bearer {self.api_key}"}

        for attempt in range(max_polls):
            response = await client.get(
                f"{self.BASE_URL}/v2/jobs/{job_id}",
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
            job_data = response.json()

            status = job_data.get("data", {}).get("status")

            if status == "finished":
                return await self._download_results(client, job_data)
            elif status == "error":
                error = job_data.get("data", {}).get("message", "Unknown error")
                raise CloudConvertError(f"Conversion failed: {error}")

            # Wait before next poll
            await asyncio.sleep(2 ** min(attempt // 10, 3))  # Exponential backoff

        raise CloudConvertError("Conversion job timed out")

    async def _download_results(
        self, client: httpx.AsyncClient, job_data: dict
    ) -> list[bytes]:
        """Download converted images from CloudConvert"""
        tasks = job_data.get("data", {}).get("tasks", [])
        export_task = next(
            (t for t in tasks if t.get("name") == "export-file"), None
        )

        if not export_task:
            raise CloudConvertError("No export task found in job response")

        files = export_task.get("result", {}).get("files", [])
        images = []

        for file_info in files:
            download_url = file_info.get("url")
            if not download_url:
                continue

            response = await client.get(download_url, timeout=30.0)
            response.raise_for_status()
            images.append(response.content)

        if not images:
            raise CloudConvertError("No images returned from conversion")

        return images


# Global instance
_cloudconvert_service: Optional[CloudConvertService] = None


def get_cloudconvert_service() -> CloudConvertService:
    """Get or create CloudConvert service instance"""
    global _cloudconvert_service
    if _cloudconvert_service is None:
        _cloudconvert_service = CloudConvertService()
    return _cloudconvert_service
