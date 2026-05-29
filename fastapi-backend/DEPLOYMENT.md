# Deployment Guide - Enterprise-Secure PDF Summarizer Backend

## Overview

This guide covers deployment options for the FastAPI backend with comprehensive security pipeline.

## Prerequisites

- Docker & Docker Compose (recommended)
- OR Python 3.11+ with pip
- API Keys:
  - Anthropic Claude API (required)
  - LangSmith (required for tracing)
  - Lakera Guard (optional, for prompt injection detection)

## Quick Start (Docker Compose)

### 1. Setup Environment

```bash
cd fastapi-backend

# Copy and configure environment
cp .env.example .env

# Edit .env with your actual API keys
nano .env
```

Required environment variables:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
LANGSMITH_API_KEY=xxxxx
LAKERA_GUARD_API_KEY=xxxxx (if enabled)
WATERMARK_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (min 32 chars)
```

### 2. Deploy

```bash
# Build and run
docker-compose up -d

# Verify service is healthy
docker-compose ps

# Check logs
docker-compose logs -f pdf-summarizer-backend
```

The API will be available at: `http://localhost:8000`

### 3. Verify Deployment

```bash
# Health check
curl http://localhost:8000/health

# API info
curl http://localhost:8000/

# API documentation
open http://localhost:8000/docs
```

## Production Deployment

### Docker Registry

```bash
# Build image
docker build -t your-registry/pdf-summarizer-backend:1.0.0 .

# Push to registry
docker push your-registry/pdf-summarizer-backend:1.0.0

# Run from registry
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e LANGSMITH_API_KEY=... \
  your-registry/pdf-summarizer-backend:1.0.0
```

### Kubernetes Deployment

#### 1. Create Namespace

```bash
kubectl create namespace pdf-summarizer
```

#### 2. Create Secrets

```bash
# Create secret with API keys
kubectl create secret generic pdf-summarizer-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxxxx \
  --from-literal=LANGSMITH_API_KEY=xxxxx \
  --from-literal=LAKERA_GUARD_API_KEY=xxxxx \
  --from-literal=WATERMARK_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -n pdf-summarizer
```

#### 3. Create ConfigMap

```bash
kubectl create configmap pdf-summarizer-config \
  --from-literal=FASTAPI_ENV=production \
  --from-literal=FASTAPI_DEBUG=false \
  --from-literal=LOG_LEVEL=INFO \
  --from-literal=TRACE_REQUESTS=true \
  --from-literal=CORS_ORIGINS=https://yourdomain.com \
  -n pdf-summarizer
```

#### 4. Create Kubernetes Manifests

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pdf-summarizer-backend
  namespace: pdf-summarizer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pdf-summarizer-backend
  template:
    metadata:
      labels:
        app: pdf-summarizer-backend
    spec:
      containers:
      - name: pdf-summarizer
        image: your-registry/pdf-summarizer-backend:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: pdf-summarizer-secrets
              key: ANTHROPIC_API_KEY
        - name: LANGSMITH_API_KEY
          valueFrom:
            secretKeyRef:
              name: pdf-summarizer-secrets
              key: LANGSMITH_API_KEY
        - name: LAKERA_GUARD_API_KEY
          valueFrom:
            secretKeyRef:
              name: pdf-summarizer-secrets
              key: LAKERA_GUARD_API_KEY
        - name: WATERMARK_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: pdf-summarizer-secrets
              key: WATERMARK_SECRET_KEY
        - name: FASTAPI_ENV
          valueFrom:
            configMapKeyRef:
              name: pdf-summarizer-config
              key: FASTAPI_ENV
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: pdf-summarizer-config
              key: LOG_LEVEL
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      
      volumes:
      - name: logs
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: pdf-summarizer-backend
  namespace: pdf-summarizer
spec:
  type: ClusterIP
  selector:
    app: pdf-summarizer-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
    name: http

---
apiVersion: autoscaling.k8s.io/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pdf-summarizer-hpa
  namespace: pdf-summarizer
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pdf-summarizer-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 5. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f deployment.yaml

# Verify deployment
kubectl get pods -n pdf-summarizer
kubectl get svc -n pdf-summarizer

# Forward port for testing
kubectl port-forward -n pdf-summarizer svc/pdf-summarizer-backend 8000:80

# View logs
kubectl logs -n pdf-summarizer -l app=pdf-summarizer-backend -f
```

### Ingress Configuration (TLS/SSL)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pdf-summarizer-ingress
  namespace: pdf-summarizer
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: pdf-summarizer-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: pdf-summarizer-backend
            port:
              number: 80
```

## Local Development

### Setup

```bash
cd fastapi-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit with your keys
nano .env
```

### Run Server

```bash
# Method 1: Using run.py
python run.py

# Method 2: Using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Method 3: Using start.sh
chmod +x start.sh
./start.sh
```

Access at: `http://localhost:8000`

### Run Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test
pytest tests/test_security.py::test_watermarking -v
```

## Monitoring & Logging

### Log Files

Logs are written to `logs/` directory:

- `security_audit.log` — Security pipeline events (JSON format)
- `forensics.log` — Detailed forensics events

### LangSmith Integration

Enable request tracing via LangSmith:

```bash
# Set in .env
TRACE_REQUESTS=true
LANGSMITH_API_KEY=your-api-key
LANGSMITH_PROJECT=pdf-summarizer-security

# View traces at: https://smith.langchain.com/
```

### Metrics

Monitor in production:
- Request/response times (target: <5s for 50-page PDFs)
- Security violations (should be near 0)
- File size distribution
- API error rates

## Security Best Practices

1. **API Keys Management**
   - Never commit .env files
   - Rotate keys regularly
   - Use secrets management (Vault, AWS Secrets Manager, etc.)

2. **Network Security**
   - Use HTTPS/TLS in production
   - Implement rate limiting
   - Use VPN/VPC for internal access

3. **Container Security**
   - Scan images with Trivy or similar
   - Use non-root user (already configured)
   - Implement pod security policies

4. **Audit Trail**
   - Monitor LangSmith traces
   - Review security_audit.log regularly
   - Archive logs for compliance

## Scaling Considerations

The backend is horizontally scalable:
- Stateless design (no local state)
- Each instance independent
- Share logs via centralized logging

For high load:
1. Increase replica count in Kubernetes
2. Configure HPA for auto-scaling
3. Use load balancer (nginx, HAProxy)
4. Consider caching layer (Redis) for repeated requests

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs pdf-summarizer-backend

# Verify .env
cat .env | grep -E "ANTHROPIC|LANGSMITH"

# Test connectivity
curl http://localhost:8000/health
```

### API Key Issues

```bash
# Validate API keys are set
docker-compose exec pdf-summarizer-backend env | grep API_KEY

# Check Anthropic API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

### Performance Issues

```bash
# Check resource usage
docker stats pdf-summarizer-backend

# Increase limits in docker-compose.yml
# Or add resource requests/limits in Kubernetes

# Profile requests
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/health
```

## Rollback Procedure

### Docker

```bash
# Revert to previous image
docker-compose down
docker pull your-registry/pdf-summarizer-backend:1.0.0  # Previous version
docker-compose up -d
```

### Kubernetes

```bash
# Check rollout history
kubectl rollout history deployment/pdf-summarizer-backend -n pdf-summarizer

# Rollback to previous version
kubectl rollout undo deployment/pdf-summarizer-backend -n pdf-summarizer
```

## Support & Contact

For issues or questions:
1. Check logs in `logs/security_audit.log`
2. Review LangSmith traces
3. Run test suite: `pytest tests/ -v`
4. Contact: support@silksummary.com
