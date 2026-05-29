"""
Security Middleware Integration Example

Shows how to integrate SecurityMiddlewareStack into your FastAPI endpoints.
Copy and adapt for your actual implementation.
"""

import logging
from fastapi import FastAPI, Request, HTTPException
from typing import Optional

from app.security import SecurityMiddlewareStack, RateLimitConfig
from app.config import Settings

logger = logging.getLogger(__name__)


async def setup_security_middleware(app: FastAPI, settings: Settings):
    """Initialize and attach security middleware to FastAPI app"""
    
    # Create middleware instance
    security_middleware = SecurityMiddlewareStack(
        lakera_api_key=settings.lakera_guard_api_key,
        security_log_path=settings.security_log_file,
        rate_limit_config=RateLimitConfig(
            global_requests_per_minute=1000,
            global_tokens_per_minute=settings.global_tokens_per_minute,
            ip_requests_per_minute=100,
            ip_tokens_per_minute=settings.ip_tokens_per_minute,
            user_requests_per_minute=200,
            user_tokens_per_minute=settings.user_tokens_per_minute,
            token_cost_pdf_upload=100,
            token_cost_llm_call=500,
            token_cost_api_call=50,
            block_duration_seconds=300,
        ),
    )
    
    # Store in app state
    app.state.security_middleware = security_middleware
    
    logger.info("Security middleware initialized and ready")
    return security_middleware


async def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    if request.headers.get("x-forwarded-for"):
        return request.headers.get("x-forwarded-for").split(",")[0]
    return request.client.host if request.client else "unknown"


async def get_user_id(request: Request) -> Optional[str]:
    """Extract user ID from request (implement based on your auth)"""
    # Example: Get from Authorization header or session
    # return request.state.user_id if hasattr(request.state, "user_id") else None
    return None


# ============================================================================
# EXAMPLE 1: Protect PDF Summarization Endpoint
# ============================================================================

async def summarize_pdf_with_security(
    app: FastAPI,
    request: Request,
    pdf_text: str,
) -> dict:
    """
    Process PDF text through complete security pipeline.
    
    Args:
        app: FastAPI application instance
        request: HTTP request
        pdf_text: Extracted PDF text
    
    Returns:
        Processed text and metadata
    
    Raises:
        HTTPException: If any security check fails
    """
    security = app.state.security_middleware
    client_ip = await get_client_ip(request)
    user_id = await get_user_id(request)
    request_id = request.headers.get("x-request-id", "unknown")
    
    try:
        # Process through entire security pipeline
        processed_text, metadata = await security.process_user_input(
            text=pdf_text,
            client_ip=client_ip,
            user_id=user_id,
            operation="pdf_upload",
        )
        
        logger.info(
            f"PDF text passed security checks (request: {request_id}, "
            f"client: {client_ip}, user: {user_id})"
        )
        
        return {
            "processed_text": processed_text,
            "metadata": metadata,
            "request_id": request_id,
        }
        
    except Exception as e:
        logger.error(f"Security check failed: {str(e)}")
        
        # Log incident
        security.incident_logger.log_suspicious_activity(
            client_ip=client_ip,
            activity_type="pdf_processing_failed",
            description=f"Security pipeline error: {str(e)}",
            details={"error": str(e), "request_id": request_id},
            severity="medium",
            user_id=user_id,
        )
        
        raise HTTPException(
            status_code=403,
            detail="Security validation failed"
        )


# ============================================================================
# EXAMPLE 2: Validate LLM Output
# ============================================================================

async def validate_llm_response_with_security(
    app: FastAPI,
    request: Request,
    llm_output: str,
    request_id: str,
) -> bool:
    """
    Validate LLM output against security guardrails.
    
    Args:
        app: FastAPI application instance
        request: HTTP request
        llm_output: Raw output from LLM
        request_id: Request tracking ID
    
    Returns:
        True if output is safe, False otherwise
    
    Raises:
        HTTPException: If output contains violations
    """
    security = app.state.security_middleware
    client_ip = await get_client_ip(request)
    user_id = await get_user_id(request)
    
    try:
        # Validate output
        is_valid, validation_result = await security.validate_llm_output(
            output=llm_output,
            client_ip=client_ip,
            user_id=user_id,
            request_id=request_id,
        )
        
        if not is_valid:
            logger.error(
                f"LLM output validation failed: "
                f"{len(validation_result.get('violations', []))} violations"
            )
            raise HTTPException(
                status_code=500,
                detail="Output validation failed"
            )
        
        logger.info(f"LLM output passed validation (request: {request_id})")
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Output validation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Validation error")


# ============================================================================
# EXAMPLE 3: Rate Limiting Check
# ============================================================================

async def check_rate_limit_before_operation(
    app: FastAPI,
    request: Request,
    operation: str = "api_call",
) -> bool:
    """
    Check rate limits before allowing operation.
    
    Args:
        app: FastAPI application
        request: HTTP request
        operation: Type of operation (pdf_upload, llm_call, api_call)
    
    Returns:
        True if allowed
    
    Raises:
        HTTPException: If rate limited
    """
    security = app.state.security_middleware
    client_ip = await get_client_ip(request)
    user_id = await get_user_id(request)
    
    allowed, reason = security.rate_limiter.is_allowed(
        client_ip=client_ip,
        operation=operation,
        user_id=user_id,
    )
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for {client_ip}: {reason}")
        
        # Log incident
        security.incident_logger.log_rate_limit_breach(
            client_ip=client_ip,
            operation=operation,
            tokens_requested=500,
            tokens_available=0,
            user_id=user_id,
        )
        
        raise HTTPException(
            status_code=429,
            detail=reason
        )
    
    return True


# ============================================================================
# EXAMPLE 4: Get Security Status
# ============================================================================

async def get_security_status_endpoint(
    app: FastAPI,
    request: Request,
) -> dict:
    """
    Return current security status for a client.
    
    Useful for debugging and monitoring.
    """
    security = app.state.security_middleware
    client_ip = await get_client_ip(request)
    user_id = await get_user_id(request)
    
    status = security.get_security_status(
        client_ip=client_ip,
        user_id=user_id,
    )
    
    return {
        "client_ip": client_ip,
        "user_id": user_id,
        "rate_limits": status["rate_limit_status"],
        "security_incidents": status["incident_stats"],
        "timestamp": str(__import__("datetime").datetime.utcnow()),
    }


# ============================================================================
# EXAMPLE 5: Get Security Incident Report
# ============================================================================

async def get_incident_report_endpoint(
    app: FastAPI,
    request: Request,
    incident_type: Optional[str] = None,
    severity: Optional[str] = None,
) -> dict:
    """
    Retrieve security incident report.
    
    ADMIN ONLY - Restrict access in production!
    """
    security = app.state.security_middleware
    
    incidents = security.get_incident_report(
        incident_type=incident_type,
        severity=severity,
        limit=100,
    )
    
    return {
        "total_incidents": len(incidents),
        "incidents": incidents,
        "timestamp": str(__import__("datetime").datetime.utcnow()),
    }


# ============================================================================
# EXAMPLE 6: Verify Log Integrity
# ============================================================================

async def verify_log_integrity_endpoint(app: FastAPI) -> dict:
    """
    Verify security log integrity.
    
    ADMIN ONLY - Restrict access in production!
    """
    security = app.state.security_middleware
    
    is_valid, report = security.verify_log_integrity()
    
    return {
        "log_valid": is_valid,
        "report": report,
        "timestamp": str(__import__("datetime").datetime.utcnow()),
    }


# ============================================================================
# COMPLETE ENDPOINT EXAMPLE
# ============================================================================

async def complete_summarization_endpoint_example(
    app: FastAPI,
    request: Request,
    file_content: str,
    llm_response: str,
    request_id: str,
) -> dict:
    """
    Complete example showing all security checks in one endpoint.
    """
    client_ip = await get_client_ip(request)
    user_id = await get_user_id(request)
    
    # 1. RATE LIMITING
    await check_rate_limit_before_operation(
        app=app,
        request=request,
        operation="llm_call"
    )
    
    # 2. PROCESS INPUT THROUGH SECURITY PIPELINE
    result = await summarize_pdf_with_security(
        app=app,
        request=request,
        pdf_text=file_content,
    )
    
    processed_text = result["processed_text"]
    metadata = result["metadata"]
    deanon_token = metadata.get("deanon_token", "")
    
    # 3. USE PROCESSED TEXT FOR LLM (not shown here)
    # summary = await llm.summarize(processed_text)
    
    # 4. VALIDATE LLM OUTPUT
    await validate_llm_response_with_security(
        app=app,
        request=request,
        llm_output=llm_response,
        request_id=request_id,
    )
    
    # 5. RETURN RESPONSE WITH SECURITY METADATA
    return {
        "summary": llm_response,
        "deanon_token": deanon_token,  # For client-side PII restoration
        "request_id": request_id,
        "security_checks_passed": metadata.get("checks_passed", {}),
    }


# ============================================================================
# MIDDLEWARE FOR AUTOMATIC TRACKING
# ============================================================================

async def security_tracking_middleware(request: Request, call_next):
    """
    FastAPI middleware that tracks all requests for security monitoring.
    Add to your app with: app.add_middleware(...)
    """
    import time
    import uuid
    
    # Generate request ID if not present
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    start_time = time.time()
    
    try:
        response = await call_next(request)
        
        # Log successful request
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Request completed: {request.method} {request.url.path} "
            f"({response.status_code}, {duration_ms:.0f}ms)"
        )
        
        return response
        
    except Exception as e:
        # Log failed request
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"Request failed: {request.method} {request.url.path} "
            f"({duration_ms:.0f}ms): {str(e)}"
        )
        raise


# ============================================================================
# USAGE IN MAIN APP
# ============================================================================

"""
In your main.py:

from fastapi import FastAPI
from app.security.integration_examples import (
    setup_security_middleware,
    security_tracking_middleware,
)

app = FastAPI()

# Add security middleware
app.add_middleware(WrapperMiddleware, middleware=security_tracking_middleware)

@app.on_event("startup")
async def startup():
    settings = get_settings()
    await setup_security_middleware(app, settings)

@app.post("/summarize")
async def summarize(request: Request, file: UploadFile):
    # Use examples above
    return await complete_summarization_endpoint_example(...)
"""
