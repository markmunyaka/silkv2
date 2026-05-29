# Enterprise-Secure PDF Summarizer - FastAPI Backend

FastAPI-based backend service for secure PDF summarization with multi-stage security pipeline.

## Architecture

```
┌─────────────────┐
│   PDF Upload    │
└────────┬────────┘
         │
    ┌────▼────────────────────────────┐
    │ 1. Sanitization (Votiro/CDR)    │ → Strip macros/JS
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 2. Text Extraction (PyPDF2)     │ → Extract text
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 3. PII Redaction (Presidio)     │ → Mask sensitive data
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 4. Prompt Firewall (Lakera)     │ → Detect injections
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 5. LLM Summarization (Claude)   │ → Generate summary
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 6. Output Validation            │ → Verify schema
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 7. Watermarking (HMAC)          │ → Digital signature
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ 8. Forensics Logging (LangSmith)│ → Audit trail
    └────┬─────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │   Structured JSON Response      │
    └─────────────────────────────────┘
```

## Features

- **High-Performance Async Processing** - Non-blocking file uploads with asyncio
- **Multi-Stage Security Pipeline** - Sanitization → PII Redaction → Firewall → LLM → Validation → Watermarking → Forensics
- **Global Error Handler** - Returns "Security Violation" on any flagged security checks
- **Comprehensive Audit Trail** - LangSmith integration for full request/response tracing
- **Digital Watermarking** - HMAC-based signatures for output integrity
- **Non-Root Docker** - Secure containerization without root privileges
- **Environment-Driven Configuration** - All API keys sourced from .env
- **OpenAPI Documentation** - Auto-generated API docs at /docs and /redoc

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Docker & Docker Compose (optional)
- API keys for:
  - Anthropic Claude API
  - LangSmith (for tracing)
  - Lakera Guard (for prompt injection detection)

### 2. Setup

```bash
# Navigate to backend directory
cd fastapi-backend

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 3. Installation

#### Local Development
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
python -m uvicorn app.main:app --reload
```

#### Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f pdf-summarizer-backend
```

## API Endpoints

### Health Check
```bash
GET /health
```

Returns server status and configuration.

### Summarize PDF
```bash
POST /summarize
Content-Type: multipart/form-data

file: <binary PDF>
anonymize: bool (optional)
```

**Request:**
```bash
curl -X POST "http://localhost:8000/summarize" \
  -H "accept: application/json" \
  -F "file=@document.pdf" \
  -F "anonymize=false"
```

**Response:**
```json
{
  "title": "Document Title",
  "summary": "A comprehensive 3-5 sentence summary...",
  "key_points": [
    {"point": "Key point 1", "importance": "high"},
    {"point": "Key point 2", "importance": "high"},
    {"point": "Key point 3", "importance": "medium"},
    {"point": "Key point 4", "importance": "medium"},
    {"point": "Key point 5", "importance": "low"}
  ],
  "watermark_signature": "sha256_hmac_signature",
  "watermark_timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_abc123def456",
  "processing_time_ms": 2450,
  "security_checks_passed": {
    "sanitization": true,
    "pii_redaction": true,
    "firewall": true,
    "llm_summarization": true,
    "validation": true,
    "watermarking": true
  }
}
```

### Error Handling

**Security Violation:**
```json
HTTP 403 Forbidden
{
  "status": "Security Violation",
  "message": "Request failed security validation",
  "stage": "firewall",
  "details": {...}
}
```

**Processing Error:**
```json
HTTP 500 Internal Server Error
{
  "status": "error",
  "message": "Internal processing error",
  "detail": "..."
}
```

## Configuration

### Environment Variables

See `.env.example` for complete list. Key variables:

```env
# API Keys (Required)
ANTHROPIC_API_KEY=sk-ant-...
LANGSMITH_API_KEY=...

# Feature Flags
LAKERA_GUARD_ENABLED=true
PRESIDIO_ENABLED=true
GUARDRAILS_ENABLED=true
TRACE_REQUESTS=true

# Security
MAX_FILE_SIZE_MB=10
WATERMARK_SECRET_KEY=... (min 32 chars)
CORS_ORIGINS=http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

## Security Pipeline Details

### 1. **Sanitization (Votiro/CDR)**
- Strips macros, JavaScript, and embedded objects from PDFs
- Mock implementation provided for testing
- Production: Integrates with Votiro API

### 2. **Text Extraction**
- Extracts text using PyPDF2
- Falls back to OCR (Tesseract) if no text found
- Handles multi-page documents

### 3. **PII Redaction (Presidio)**
- Detects: Names, Emails, Phone Numbers, SSN, Credit Cards, IDs
- Redacts with placeholders: [PERSON_NAME], [EMAIL], etc.
- Confidence threshold: 0.5+

### 4. **Prompt Firewall (Lakera Guard)**
- Detects prompt injection attempts
- Identifies jailbreak patterns
- Blocks requests with injection threats
- Mock implementation for testing

### 5. **LLM Summarization**
- Uses Claude 3.5 Sonnet model
- Generates structured JSON output:
  - Title (≤50 chars)
  - Summary (3-5 sentences)
  - 5 Key Points with importance levels
- Max tokens: 1024

### 6. **Output Validation (Guardrails)**
- Validates against Pydantic schema
- Ensures all required fields present
- Type checking and format validation
- Handles JSON parsing with markdown cleanup

### 7. **Watermarking**
- HMAC-SHA256 signatures
- Includes request_id in signature for uniqueness
- Constant-time comparison for verification
- Protects "silk summary" IP

### 8. **Forensics Logging (LangSmith)**
- Logs each pipeline stage: input, output, status
- Traces entire request lifecycle
- Audit trail for security analysis
- Optional data anonymization

## Performance Characteristics

- **Typical Processing Time**: 2-5 seconds for 50-page PDFs
- **Concurrency**: Async/await for non-blocking file processing
- **Memory**: Efficient streaming and cleanup
- **File Limit**: 10 MB (configurable)

## Testing

```bash
# Run tests
python -m pytest tests/ -v

# With coverage
python -m pytest tests/ --cov=app --cov-report=html
```

## Deployment

### Docker
```bash
# Build image
docker build -t pdf-summarizer-backend:latest .

# Run container
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e LANGSMITH_API_KEY=... \
  pdf-summarizer-backend:latest
```

### Kubernetes
```bash
# Create ConfigMap for non-sensitive config
kubectl create configmap pdf-summarizer-config \
  --from-literal=FASTAPI_ENV=production \
  --from-literal=LOG_LEVEL=INFO

# Create Secret for API keys
kubectl create secret generic pdf-summarizer-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=LANGSMITH_API_KEY=...
```

## Logging & Monitoring

Logs are written to `logs/security_audit.log` in JSON format for easy parsing:

```json
{
  "request_id": "req_abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "event_type": "pii_redaction",
  "stage": "pii_redaction",
  "status": "success",
  "entities_redacted": 3
}
```

## License

Proprietary - Silk Summary IP Protection
