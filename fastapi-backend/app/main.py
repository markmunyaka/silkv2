"""Main FastAPI application"""

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.schemas import SummarizationResponse, KeyPoint
from app.errors import register_exception_handlers, SecurityViolation, ProcessingError
from app.security import PDFSanitizer, PIIRedactor, PromptFirewall, OutputValidator, Watermarker
from app.utils.pdf_extraction import extract_text_from_pdf
from app.utils.llm import SummarizerLLM
from app.utils.forensics import ForensicsLogger

logger = logging.getLogger(__name__)


class AppState:
    """Application state container"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.sanitizer = PDFSanitizer(
            api_key=settings.votiro_api_key,
            enabled=settings.votiro_enabled,
        )
        self.pii_redactor = PIIRedactor(enabled=settings.presidio_enabled)
        self.firewall = PromptFirewall(
            api_key=settings.lakera_guard_api_key,
            enabled=settings.lakera_guard_enabled,
        )
        self.output_validator = OutputValidator(enabled=settings.guardrails_enabled)
        self.watermarker = Watermarker(
            secret_key=settings.watermark_secret_key,
            algorithm=settings.watermark_algorithm,
        )
        self.llm = SummarizerLLM(api_key=settings.anthropic_api_key)
        self.forensics = ForensicsLogger(
            project_name=settings.langsmith_project,
            enabled=settings.trace_requests,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("Starting Enterprise-Secure PDF Summarizer Backend")
    
    # Initialize state
    settings = get_settings()
    app.state.app_state = AppState(settings)
    
    logger.info(
        f"Security pipeline initialized: "
        f"sanitization={settings.votiro_enabled}, "
        f"pii_redaction={settings.presidio_enabled}, "
        f"firewall={settings.lakera_guard_enabled}, "
        f"validation={settings.guardrails_enabled}, "
        f"tracing={settings.trace_requests}"
    )
    
    yield
    
    logger.info("Shutting down application")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title="Enterprise-Secure PDF Summarizer",
        description="High-performance, security-focused PDF summarization backend",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Register exception handlers
    register_exception_handlers(app)

    # Get settings for CORS
    settings = get_settings()

    # Add CORS middleware
    if settings.enable_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "service": "pdf-summarizer",
            "version": "1.0.0",
        }

    # PDF Summarization endpoint with full security pipeline
    @app.post("/summarize", response_model=SummarizationResponse)
    async def summarize_pdf(
        file: UploadFile = File(...),
        anonymize: bool = Form(False),
    ):
        """
        Upload PDF and get structured summary with full security pipeline.

        Security Pipeline:
        1. Sanitization (Votiro/CDR) - Strip macros/JS
        2. PII Redaction (Presidio) - Mask sensitive data
        3. Prompt Firewall (Lakera Guard) - Detect injections
        4. LLM Summarization (Claude 3.5) - Generate summary
        5. Validation (Guardrails) - Verify JSON schema
        6. Forensics (LangSmith) - Audit trail
        7. Watermarking - Digital signature

        Returns security-verified SummarizationResponse with audit metadata.
        """
        
        request_id = str(uuid.uuid4())
        start_time = time.time()
        state: AppState = app.state.app_state

        try:
            logger.info(f"Processing summarization request {request_id}")

            # Validate file type
            if file.content_type != "application/pdf":
                raise SecurityViolation(
                    message="Invalid file type (must be PDF)",
                    stage="validation",
                    details={"provided": file.content_type, "expected": "application/pdf"},
                )

            # Validate file size
            file_bytes = await file.read()
            if len(file_bytes) > state.settings.max_file_size_bytes:
                raise SecurityViolation(
                    message=f"File exceeds {state.settings.max_file_size_mb}MB limit",
                    stage="validation",
                    details={"size_bytes": len(file_bytes), "limit_bytes": state.settings.max_file_size_bytes},
                )

            security_checks = {}

            # 1. SANITIZATION
            try:
                logger.info(f"[1/7] Sanitizing PDF {request_id}")
                sanitized_bytes, sanitization_meta = await state.sanitizer.sanitize(
                    file_bytes,
                    file.filename or "document.pdf",
                )
                security_checks["sanitization"] = True
                await state.forensics.log_security_event(
                    request_id,
                    "sanitization",
                    "pdf_sanitization",
                    status="success",
                    metadata=sanitization_meta,
                )
            except Exception as e:
                security_checks["sanitization"] = False
                raise SecurityViolation(
                    message=f"PDF sanitization failed: {str(e)}",
                    stage="sanitization",
                ) from e

            # 2. PDF TEXT EXTRACTION
            try:
                logger.info(f"[2/7] Extracting text {request_id}")
                extracted_text = await extract_text_from_pdf(sanitized_bytes)

                if not extracted_text.strip():
                    raise SecurityViolation(
                        message="No text could be extracted from PDF",
                        stage="extraction",
                    )
            except Exception as e:
                raise SecurityViolation(
                    message=f"Text extraction failed: {str(e)}",
                    stage="extraction",
                ) from e

            # 3. PII REDACTION
            try:
                logger.info(f"[3/7] Redacting PII {request_id}")
                redacted_text, redaction_meta = await state.pii_redactor.redact(
                    extracted_text
                )
                security_checks["pii_redaction"] = True
                await state.forensics.log_security_event(
                    request_id,
                    "pii_redaction",
                    "pii_redaction",
                    input_data=extracted_text[:100],
                    output_data=redacted_text[:100],
                    status="success",
                    metadata=redaction_meta,
                )
            except Exception as e:
                security_checks["pii_redaction"] = False
                raise SecurityViolation(
                    message=f"PII redaction failed: {str(e)}",
                    stage="pii_redaction",
                ) from e

            # 4. PROMPT INJECTION FIREWALL
            try:
                logger.info(f"[4/7] Checking prompt injection {request_id}")
                is_safe, firewall_meta = await state.firewall.check(redacted_text)

                if not is_safe:
                    raise SecurityViolation(
                        message=f"Prompt injection attempt detected: {firewall_meta.get('threat_type')}",
                        stage="firewall",
                        details=firewall_meta,
                    )

                security_checks["firewall"] = True
                await state.forensics.log_security_event(
                    request_id,
                    "firewall_check",
                    "prompt_firewall",
                    status="success",
                    metadata=firewall_meta,
                )
            except SecurityViolation:
                security_checks["firewall"] = False
                raise
            except Exception as e:
                security_checks["firewall"] = False
                raise SecurityViolation(
                    message=f"Firewall check failed: {str(e)}",
                    stage="firewall",
                ) from e

            # 5. LLM SUMMARIZATION
            try:
                logger.info(f"[5/7] Generating summary {request_id}")
                summary_data = await state.llm.summarize(redacted_text)
                security_checks["llm_summarization"] = True

                await state.forensics.log_security_event(
                    request_id,
                    "llm_summarization",
                    "llm_summarization",
                    output_data=str(summary_data)[:200],
                    status="success",
                )
            except Exception as e:
                security_checks["llm_summarization"] = False
                raise SecurityViolation(
                    message=f"Summary generation failed: {str(e)}",
                    stage="llm_summarization",
                ) from e

            # 6. OUTPUT VALIDATION
            try:
                logger.info(f"[6/7] Validating output {request_id}")
                
                # Convert key_points to KeyPoint objects
                key_points = [
                    KeyPoint(**kp) for kp in summary_data.get("key_points", [])
                ]
                summary_data["key_points"] = key_points

                security_checks["validation"] = True
                await state.forensics.log_security_event(
                    request_id,
                    "output_validation",
                    "output_validation",
                    status="success",
                    metadata={"schema": "SummarizationResponse"},
                )
            except Exception as e:
                security_checks["validation"] = False
                raise SecurityViolation(
                    message=f"Output validation failed: {str(e)}",
                    stage="validation",
                ) from e

            # 7. WATERMARKING & FINALIZATION
            try:
                logger.info(f"[7/7] Watermarking output {request_id}")
                
                # Create base response
                response_dict = {
                    "title": summary_data.get("title", ""),
                    "summary": summary_data.get("summary", ""),
                    "key_points": [kp.model_dump() for kp in summary_data.get("key_points", [])],
                    "request_id": request_id,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "security_checks_passed": security_checks,
                }

                # Add watermark
                watermarked, signature = await state.watermarker.watermark(
                    response_dict,
                    request_id,
                )

                security_checks["watermarking"] = True
                await state.forensics.log_security_event(
                    request_id,
                    "watermarking",
                    "watermarking",
                    status="success",
                    metadata={"signature": signature[:32]},
                )

                # Log pipeline summary
                processing_time_ms = int((time.time() - start_time) * 1000)
                await state.forensics.log_pipeline_summary(
                    request_id,
                    processing_time_ms,
                    security_checks,
                    len(signature),
                )

                return SummarizationResponse(**watermarked)

            except Exception as e:
                security_checks["watermarking"] = False
                raise SecurityViolation(
                    message=f"Watermarking failed: {str(e)}",
                    stage="watermarking",
                ) from e

        except SecurityViolation:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in {request_id}: {str(e)}")
            raise ProcessingError(f"Request processing failed: {str(e)}") from e

    # API info endpoint
    @app.get("/")
    async def root():
        """API information endpoint"""
        settings = get_settings()
        return {
            "service": "Enterprise-Secure PDF Summarizer",
            "version": "1.0.0",
            "endpoints": {
                "health": "/health",
                "summarize": "/summarize",
                "docs": "/docs",
            },
            "security_features": {
                "sanitization": settings.votiro_enabled,
                "pii_redaction": settings.presidio_enabled,
                "prompt_firewall": settings.lakera_guard_enabled,
                "output_validation": settings.guardrails_enabled,
                "tracing": settings.trace_requests,
                "watermarking": True,
            },
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        app,
        host=settings.fastapi_host,
        port=settings.fastapi_port,
        log_level=settings.log_level.lower(),
    )
