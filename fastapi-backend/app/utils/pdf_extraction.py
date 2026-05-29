"""PDF text extraction and parsing"""

import logging
from io import BytesIO

try:
    from pdf2image import convert_from_bytes
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

from PyPDF2 import PdfReader
from app.utils.cloudconvert_service import get_cloudconvert_service

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when PDF extraction fails"""

    pass


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using multiple methods.
    Falls back to CloudConvert OCR, then local Tesseract.

    Args:
        pdf_bytes: Raw PDF file bytes

    Returns:
        Extracted text

    Raises:
        PDFExtractionError: If extraction fails
    """
    try:
        # First, try PDF text extraction
        text = await _extract_text_via_pdf_parser(pdf_bytes)

        if text.strip():
            logger.info(f"Extracted {len(text)} characters via PDF parser")
            return text

        # Fallback to CloudConvert OCR if available
        cloudconvert = get_cloudconvert_service()
        if cloudconvert.is_available():
            logger.info("No text found via PDF parser, falling back to CloudConvert OCR")
            return await _extract_text_via_cloudconvert_ocr(pdf_bytes)

        # Fallback to local Tesseract if available
        if TESSERACT_AVAILABLE:
            logger.info("No text found via PDF parser, falling back to local OCR")
            return await _extract_text_via_ocr(pdf_bytes)

        raise PDFExtractionError("No text found and all OCR methods unavailable")

    except Exception as e:
        logger.error(f"PDF extraction failed: {str(e)}")
        raise PDFExtractionError(f"Failed to extract PDF text: {str(e)}") from e


async def _extract_text_via_pdf_parser(pdf_bytes: bytes) -> str:
    """Extract text directly from PDF structure"""
    try:
        pdf_reader = PdfReader(BytesIO(pdf_bytes))
        text_parts = []

        for page_num, page in enumerate(pdf_reader.pages):
            try:
                text = page.extract_text()
                if text:
                    text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            except Exception as e:
                logger.warning(f"Failed to extract page {page_num + 1}: {e}")
                continue

        return "\n\n".join(text_parts)

    except Exception as e:
        raise PDFExtractionError(f"PDF parsing failed: {str(e)}") from e


async def _extract_text_via_cloudconvert_ocr(pdf_bytes: bytes) -> str:
    """Extract text from PDF via CloudConvert OCR"""
    try:
        cloudconvert = get_cloudconvert_service()
        images = await cloudconvert.convert_pdf_to_images(pdf_bytes, output_format="png")
        text_parts = []

        for page_num, image_bytes in enumerate(images):
            try:
                if TESSERACT_AVAILABLE:
                    from PIL import Image
                    image = Image.open(BytesIO(image_bytes))
                    text = pytesseract.image_to_string(image)
                    if text.strip():
                        text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
                else:
                    logger.warning(f"Pytesseract not available for page {page_num + 1} OCR")
            except Exception as e:
                logger.warning(f"OCR failed for page {page_num + 1}: {e}")
                continue

        if not text_parts:
            raise PDFExtractionError("No text extracted via CloudConvert OCR")

        return "\n\n".join(text_parts)

    except Exception as e:
        raise PDFExtractionError(f"CloudConvert OCR extraction failed: {str(e)}") from e


async def _extract_text_via_ocr(pdf_bytes: bytes) -> str:
    """Extract text from PDF via local OCR (requires Tesseract)"""
    if not TESSERACT_AVAILABLE:
        raise PDFExtractionError("OCR not available (pytesseract not installed)")

    try:
        images = convert_from_bytes(pdf_bytes)
        text_parts = []

        for page_num, image in enumerate(images):
            try:
                text = pytesseract.image_to_string(image)
                if text.strip():
                    text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            except Exception as e:
                logger.warning(f"OCR failed for page {page_num + 1}: {e}")
                continue

        return "\n\n".join(text_parts)

    except Exception as e:
        raise PDFExtractionError(f"OCR extraction failed: {str(e)}") from e
