# Quick Reference - Enterprise-Secure PDF Summarizer Backend

## 🚀 Quick Start

### Local Development (5 minutes)

```bash
cd fastapi-backend

# 1. Setup environment
cp .env.example .env
# Edit .env with your Anthropic API key

# 2. Install & run
pip install -r requirements.txt
python run.py

# 3. Test
curl http://localhost:8000/health
open http://localhost:8000/docs
```

### Docker (3 minutes)

```bash
cd fastapi-backend

# 1. Configure
cp .env.example .env
# Edit .env with your API keys

# 2. Deploy
docker-compose up -d

# 3. Test
curl http://localhost:8000/health
```

---

## 📋 Security Pipeline Flow

```
PDF Upload
    ↓
[1] Sanitization (Votiro/CDR) → Remove macros/JS
    ↓
[2] Text Extraction (PyPDF2) → Parse document
    ↓
[3] PII Redaction (Presidio) → Mask sensitive data
    ↓
[4] Prompt Firewall (Lakera) → Detect injections
    ↓
[5] LLM Summarization (Claude) → Generate summary
    ↓
[6] Output Validation → Verify JSON schema
    ↓
[7] Watermarking (HMAC) → Digital signature
    ↓
[8] Forensics (LangSmith) → Audit trail
    ↓
JSON Response + Signature
```

---

## 🔌 API Endpoints

### Health Check
```bash
GET /health
curl http://localhost:8000/health
```

### PDF Summarization
```bash
POST /summarize
curl -X POST "http://localhost:8000/summarize" \
  -F "file=@document.pdf" \
  -F "anonymize=false"
```

### API Info
```bash
GET /
curl http://localhost:8000/
```

### API Documentation
```
Interactive: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc
```

---

## ⚙️ Configuration

### Required Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx              # Required: Claude API key
LANGSMITH_API_KEY=xxxxx                     # Required: Tracing
WATERMARK_SECRET_KEY=xxxxxxx(min 32 chars)  # Required: Signing key
```

### Optional (with defaults)
```env
LAKERA_GUARD_API_KEY=xxxxx                  # Prompt injection detection
VOTIRO_API_KEY=xxxxx                        # PDF sanitization
FASTAPI_PORT=8000                           # Server port
LOG_LEVEL=INFO                              # Logging level
MAX_FILE_SIZE_MB=10                         # File size limit
CORS_ORIGINS=http://localhost:3000          # CORS settings
```

See `.env.example` for complete list.

---

## 📊 Response Format

### Success Response
```json
{
  "title": "Document Title",
  "summary": "3-5 sentence summary with key information.",
  "key_points": [
    {"point": "First key insight", "importance": "high"},
    {"point": "Second key insight", "importance": "high"},
    {"point": "Third key insight", "importance": "medium"},
    {"point": "Fourth key insight", "importance": "medium"},
    {"point": "Fifth key insight", "importance": "low"}
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

### Error Response (Security Violation)
```json
HTTP 403 Forbidden
{
  "status": "Security Violation",
  "message": "Request failed security validation",
  "stage": "firewall",
  "details": {"threat_type": "prompt_injection", ...}
}
```

---

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_security.py -v

# With coverage report
pytest tests/ --cov=app --cov-report=html

# Run single test
pytest tests/test_endpoints.py::test_health_check -v
```

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI application & security pipeline |
| `app/config.py` | Configuration from environment |
| `app/errors.py` | Global error handler (returns "Security Violation") |
| `app/security/sanitization.py` | PDF sanitization (Votiro/CDR mock) |
| `app/security/pii_redaction.py` | PII detection & redaction (Presidio) |
| `app/security/prompt_firewall.py` | Prompt injection detection (Lakera) |
| `app/security/output_validator.py` | JSON schema validation |
| `app/security/watermarking.py` | HMAC-based digital signatures |
| `app/utils/pdf_extraction.py` | PDF→text extraction |
| `app/utils/llm.py` | Claude 3.5 Sonnet integration |
| `app/utils/forensics.py` | Forensics logging (LangSmith) |
| `Dockerfile` | Non-root Docker image |
| `docker-compose.yml` | Local dev orchestration |
| `requirements.txt` | Python dependencies |
| `README.md` | Service documentation |
| `DEPLOYMENT.md` | Deployment guide |

---

## 🔍 Logging

### Log Locations
```
logs/
├── security_audit.log    # JSON formatted security events
└── forensics.log         # Detailed forensics traces
```

### Log Format (JSON)
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

---

## 🐳 Docker Commands

```bash
# Build image
docker build -t pdf-summarizer-backend:latest .

# Run with Docker Compose
docker-compose up -d
docker-compose down
docker-compose logs -f

# Run standalone
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  pdf-summarizer-backend:latest

# Push to registry
docker tag pdf-summarizer-backend:latest your-registry/pdf-summarizer:1.0.0
docker push your-registry/pdf-summarizer:1.0.0
```

---

## ☸️ Kubernetes Deployment

```bash
# Create secrets
kubectl create secret generic pdf-summarizer-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-...

# Deploy
kubectl apply -f deployment.yaml

# Monitor
kubectl get pods -n pdf-summarizer
kubectl logs -n pdf-summarizer -l app=pdf-summarizer-backend -f

# Port forward
kubectl port-forward -n pdf-summarizer svc/pdf-summarizer-backend 8000:80
```

---

## 🔐 Security Features

| Feature | Technology | Purpose |
|---------|-----------|---------|
| PDF Sanitization | Votiro/CDR | Strip macros & malicious JS |
| PII Redaction | Presidio | Mask names, emails, IDs |
| Prompt Firewall | Lakera Guard | Detect injection attempts |
| LLM Integration | Claude 3.5 | Generate summaries |
| Output Validation | Guardrails AI | Verify JSON schema |
| Watermarking | HMAC-SHA256 | Digital signatures |
| Forensics | LangSmith | Audit trail & tracing |
| Non-Root Docker | Standard | Container security |
| Environment Vars | .env | Secret management |
| Error Handling | Global | "Security Violation" response |

---

## ⚡ Performance Targets

- **Response Time**: <5 seconds for 50-page PDFs
- **Throughput**: 100+ concurrent requests (with proper HPA)
- **File Limit**: 10 MB (configurable)
- **Memory**: ~256 MB per replica
- **CPU**: 250m requests, 500m limits

---

## 🚨 Troubleshooting

### API key not found
```bash
# Check .env exists
ls -la .env

# Verify keys are set
env | grep ANTHROPIC
```

### Port already in use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
# Or use different port
python run.py --port 9000
```

### Docker build fails
```bash
# Clean and rebuild
docker-compose down -v
docker build --no-cache -t pdf-summarizer-backend:latest .
```

### High memory usage
```bash
# Reduce max workers in uvicorn
# Edit Dockerfile or add env var
```

---

## 📖 Additional Resources

- **API Docs**: http://localhost:8000/docs (when running)
- **README**: See fastapi-backend/README.md for detailed info
- **Deployment**: See fastapi-backend/DEPLOYMENT.md for prod setup
- **Security**: Each module has detailed docstrings

---

## ✅ Verification Checklist

- [ ] .env file created with API keys
- [ ] `docker-compose up -d` or `python run.py` started
- [ ] Health check returns 200: `curl http://localhost:8000/health`
- [ ] API docs accessible: http://localhost:8000/docs
- [ ] PDF upload works in docs
- [ ] Response includes watermark signature
- [ ] Logs appear in logs/security_audit.log
- [ ] All security checks marked as passed
- [ ] Processing time < 5 seconds

---

## 📞 Support

For issues, check:
1. Logs: `docker-compose logs` or `logs/security_audit.log`
2. Tests: `pytest tests/ -v`
3. LangSmith traces: https://smith.langchain.com/
4. API docs: http://localhost:8000/docs

---

**Version**: 1.0.0 | **Last Updated**: January 2024 | **Status**: Production Ready ✅
