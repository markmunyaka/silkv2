#!/bin/bash
# Startup script for FastAPI backend

set -e

echo "🚀 Starting Enterprise-Secure PDF Summarizer Backend"
echo "=================================================="

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '#' | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "⚠️  Warning: .env file not found, using defaults"
fi

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

# Validate required API keys
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY not set"
    exit 1
fi

echo "✅ API key validation passed"

# Install dependencies if needed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -q -r requirements.txt
fi

echo "🔐 Security Pipeline Configuration:"
echo "  - Sanitization: ${VOTIRO_ENABLED:-false}"
echo "  - PII Redaction: ${PRESIDIO_ENABLED:-true}"
echo "  - Prompt Firewall: ${LAKERA_GUARD_ENABLED:-true}"
echo "  - Output Validation: ${GUARDRAILS_ENABLED:-true}"
echo "  - Forensics Logging: ${TRACE_REQUESTS:-true}"

echo ""
echo "🌐 Starting server on http://${FASTAPI_HOST:-0.0.0.0}:${FASTAPI_PORT:-8000}"
echo "📚 API Documentation: http://localhost:${FASTAPI_PORT:-8000}/docs"
echo ""

# Start the application
python run.py
