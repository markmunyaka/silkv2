"""Error handling and exception definitions"""

import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette import status

logger = logging.getLogger(__name__)


class SecurityViolation(Exception):
    """Raised when any security check fails"""

    def __init__(
        self,
        message: str,
        stage: str = "unknown",
        details: Optional[dict] = None,
    ):
        self.message = message
        self.stage = stage
        self.details = details or {}
        super().__init__(self.message)


class ProcessingError(Exception):
    """Generic processing error"""

    pass


async def security_violation_handler(
    request: Request,
    exc: SecurityViolation,
) -> JSONResponse:
    """Handle security violation exceptions"""
    logger.error(
        f"Security violation in stage '{exc.stage}': {exc.message}",
        extra={"details": exc.details},
    )

    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "status": "Security Violation",
            "message": "Request failed security validation",
            "stage": exc.stage,
            "details": exc.details if logger.level == logging.DEBUG else None,
        },
    )


async def processing_error_handler(
    request: Request,
    exc: ProcessingError,
) -> JSONResponse:
    """Handle processing errors"""
    logger.error(f"Processing error: {str(exc)}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "Internal processing error",
            "detail": str(exc),
        },
    )


async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected exception: {type(exc).__name__}: {str(exc)}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "Internal server error",
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers with the FastAPI app"""
    app.add_exception_handler(SecurityViolation, security_violation_handler)
    app.add_exception_handler(ProcessingError, processing_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
