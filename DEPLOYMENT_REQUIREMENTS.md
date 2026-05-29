# 🚀 DEPLOYMENT REQUIREMENTS & GUIDE

## Complete checklist of everything needed to deploy the enterprise-secure PDF summarizer

---

## 1. 🔑 API KEYS & EXTERNAL SERVICES (REQUIRED)

### A. Anthropic Claude API
**Purpose**: LLM for PDF summarization  
**Cost**: Pay-as-you-go (usually $0.50-$5 per request)  
**Setup Time**: 5 minutes  
**Get It**: https://console.anthropic.com/

```
Steps:
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to API keys section
4. Create new API key
5. Copy key to your secrets manager
```

**What you'll get**: `ANTHROPIC_API_KEY=sk-ant-xxxxx...`

---

### B. Lakera Guard (Prompt Injection Detection)
**Purpose**: Real-time prompt injection and jailbreak detection  
**Cost**: Varies by plan (free tier available for testing)  
**Setup Time**: 10 minutes  
**Get It**: https://www.lakera.ai/

```
Steps:
1. Go to https://www.lakera.ai/
2. Sign up for account
3. Create API key in dashboard
4. Choose plan (test vs production)
5. Copy API key to secrets manager
```

**What you'll get**: `LAKERA_GUARD_API_KEY=your-api-key-here`

**Note**: If you don't have Lakera Guard, the system falls back to pattern-matching mode (less accurate but still functional).

---

### C. LangSmith (Optional - Forensics & Tracing)
**Purpose**: Request tracing, debugging, and audit trail  
**Cost**: Free tier available  
**Setup Time**: 5 minutes  
**Get It**: https://smith.langchain.com/

```
Steps:
1. Go to https://smith.langchain.com/
2. Sign up for account
3. Create API key
4. Create project "pdf-summarizer-security"
5. Copy API key and project name
```

**What you'll get**:
- `LANGSMITH_API_KEY=your-api-key`
- `LANGSMITH_PROJECT=pdf-summarizer-security`

**Note**: Optional but recommended for production.

---

## 2. 💻 INFRASTRUCTURE REQUIREMENTS

### A. Compute/Server Requirements
Choose ONE of:

#### Option 1: Docker + Docker Compose (Recommended)
```
Requirements:
- Docker 20.10+ installed
- Docker Compose 1.29+ installed
- 2GB RAM minimum
- 10GB disk space
- Public IP (optional, for external access)
```

#### Option 2: Traditional Server
```
Requirements:
- Linux server (Ubuntu 20.04+ recommended)
- Python 3.9+
- pip and virtualenv
- 2GB RAM minimum
- 10GB disk space
```

#### Option 3: Cloud Deployment
Choose ONE:
- **AWS EC2**: t3.medium instance ($0.0416/hour)
- **Google Cloud**: e2-medium instance
- **Azure**: B2s instance
- **Heroku**: Standard-1x dyno ($7/month)
- **Railway.app**: Pay-as-you-go

#### Option 4: Serverless (Not Recommended for this app)
- Not suitable due to long-running LLM requests
- AWS Lambda timeout: 15 minutes max
- Better to use container-based options

---

### B. Recommended: Docker Setup
**File**: `fastapi-backend/Dockerfile` (already created)

```dockerfile
# Build image
docker build -t pdf-summarizer:1.0 -f Dockerfile .

# Run container
docker run -p 8000:8000 \
  --env-file .env \
  -v /var/logs/security:/app/logs \
  pdf-summarizer:1.0
```

---

### C. Network Requirements
```
Inbound:
- Port 8000 (FastAPI server)
- Port 443 (HTTPS, recommended)

Outbound:
- Port 443 to:
  - api.anthropic.com (Claude API)
  - api.lakera.com (Lakera Guard)
  - smith.langchain.com (LangSmith, if enabled)
```

---

## 3. 📦 SOFTWARE DEPENDENCIES

All pre-specified in `requirements.txt`:

```
✅ fastapi==0.104.1              (Web framework)
✅ uvicorn[standard]==0.24.0     (ASGI server)
✅ anthropic==0.7.0              (Claude API)
✅ presidio-analyzer==0.7.1      (PII detection)
✅ presidio-anonymizer==0.7.1    (PII redaction)
✅ cryptography==41.0.7          (Encryption)
✅ guardrails-ai==0.5.0          (Output validation)
✅ lakera-guard==0.1.0           (Prompt injection)
✅ python-dotenv==1.0.0          (Config management)
✅ pydantic==2.5.0               (Data validation)
✅ httpx==0.25.2                 (Async HTTP)
✅ langsmith==0.0.83             (Tracing)
... and 10 more

Install with:
pip install -r fastapi-backend/requirements.txt
```

---

## 4. 🔐 SECRETS & CONFIGURATION

### A. Create Secrets Manager (Choose ONE)

#### Option 1: AWS Secrets Manager (Recommended for AWS)
```bash
# Store secrets in AWS
aws secretsmanager create-secret \
  --name pdf-summarizer/prod \
  --secret-string file://secrets.json
```

#### Option 2: HashiCorp Vault
```bash
vault kv put secret/pdf-summarizer \
  ANTHROPIC_API_KEY=sk-ant-xxx \
  LAKERA_GUARD_API_KEY=xxx
```

#### Option 3: Azure Key Vault
```bash
az keyvault secret set \
  --vault-name myKeyVault \
  --name ANTHROPIC-API-KEY \
  --value sk-ant-xxx
```

#### Option 4: Simple .env (Development only - NOT for production)
```bash
# Create .env file (NEVER commit to git)
cp .env.example .env
nano .env  # Edit with your API keys
echo ".env" >> .gitignore
```

---

### B. Required Environment Variables

```bash
# CRITICAL - MUST SET
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LAKERA_GUARD_API_KEY=your-lakera-api-key-here
WATERMARK_SECRET_KEY=<32+ random chars, generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">

# STRONGLY RECOMMENDED
LAKERA_GUARD_ENABLED=true
PRESIDIO_ENABLED=true
GUARDRAILS_ENABLED=true

# SECURITY
FASTAPI_ENV=production
FASTAPI_DEBUG=false
LOG_LEVEL=WARNING

# RATE LIMITING (tune based on usage)
GLOBAL_TOKENS_PER_MINUTE=50000
IP_TOKENS_PER_MINUTE=5000
USER_TOKENS_PER_MINUTE=10000

# LOGGING
SECURITY_LOG_FILE=/var/logs/security_incidents.jsonl
LOG_FILE_PATH=/var/logs/app.log

# OPTIONAL (for forensics)
LANGSMITH_API_KEY=ls-xxxxx
LANGSMITH_PROJECT=pdf-summarizer-security
TRACE_REQUESTS=true
```

See `fastapi-backend/.env.example` for complete documentation.

---

## 5. 📁 STORAGE & LOGGING

### A. Security Log Storage (CRITICAL)
```
Must be:
✅ Encrypted at rest
✅ Read-only after write
✅ Regular backups
✅ 90-day retention minimum
✅ Access-controlled

Location: /var/logs/security_incidents.jsonl

Setup:
mkdir -p /var/logs
chmod 700 /var/logs
# For Docker: mount as volume
```

### B. Temporary File Storage (for PDFs)
```
Must be:
✅ Encrypted (if in cloud)
✅ Auto-cleanup (24 hours)
✅ Separate from logs
✅ Fast access

Location: /tmp/pdf_uploads/ or S3 bucket

Cleanup:
find /tmp/pdf_uploads -mtime +1 -delete  # Run daily via cron
```

### C. Application Logs
```
Location: /var/logs/app.log

Rotation: Daily
Retention: 30 days
Format: JSON (for parsing)
```

---

## 6. 🌐 NETWORKING & SSL/TLS

### A. SSL/TLS Certificate (Required for Production)

#### Option 1: Let's Encrypt (Free)
```bash
# Using Certbot
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d yourdomain.com
# Certificates auto-rotate
```

#### Option 2: AWS Certificate Manager (AWS)
```bash
# Request certificate in ACM console
# Use with ALB/CloudFront
```

#### Option 3: Self-signed (Development only)
```bash
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

---

### B. Reverse Proxy Setup (Recommended)

#### Using Nginx:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Using AWS ALB:
```
1. Create ALB with HTTPS listener
2. Attach ACM certificate
3. Target group → FastAPI container on port 8000
4. Health check: GET /health
```

---

## 7. 📊 MONITORING & ALERTING

### A. Application Monitoring

#### Option 1: Prometheus + Grafana (Open Source)
```
Install:
- Prometheus (metrics collection)
- Grafana (visualization)
- Node Exporter (system metrics)

Cost: $0 (self-hosted) or $10-50/month (managed)
```

#### Option 2: DataDog
```
Cost: $10-20/month
Setup: Install agent, get API key
Metrics: CPU, memory, disk, API latency, errors
```

#### Option 3: New Relic
```
Cost: $15-30/month
Setup: Install agent
Metrics: APM, error tracking, infrastructure
```

---

### B. Security Monitoring (CRITICAL)

```
Alert on:
✅ Jailbreak attempts: > 5/hour → WARN, > 10/hour → CRITICAL
✅ Rate limit violations: > 10/hour → WARN
✅ Output violations: ANY → CRITICAL
✅ PII exposure: ANY → CRITICAL
✅ Log integrity failure: ANY → CRITICAL
✅ API errors: > 5% error rate → WARN

Channels:
- Email to security team
- Slack #security channel
- PagerDuty for critical alerts
```

---

### C. Log Monitoring

#### Using ELK Stack (Elasticsearch, Logstash, Kibana):
```
Cost: $0 (self-hosted) or $50-200/month (managed)
Setup: 
  1. Logstash reads logs
  2. Elasticsearch indexes them
  3. Kibana visualizes
  4. Alerts on patterns
```

#### Using CloudWatch (AWS):
```
Cost: $0.50-2/month
Setup:
  1. Stream logs to CloudWatch
  2. Create log groups
  3. Set up filters and alarms
```

---

## 8. 🏗️ DEPLOYMENT ARCHITECTURE OPTIONS

### Option A: Simple Single Server (Smallest)
```
┌──────────────────────┐
│  Domain + SSL Cert   │
└──────────┬───────────┘
           │
      ┌────▼────┐
      │ Nginx   │
      │ (Port   │
      │ 443)    │
      └────┬────┘
           │
      ┌────▼────────────────────┐
      │ FastAPI Server          │
      │ (Port 8000)             │
      │ - All security controls │
      │ - Logging               │
      └────┬────────────────────┘
           │
      ┌────▼─────────────────┐
      │ Local Storage        │
      │ - Logs               │
      │ - Temp files         │
      └──────────────────────┘

Cost: $10-20/month (small VPS)
Setup time: 1 hour
Complexity: Low
```

---

### Option B: Docker + AWS (Recommended)
```
┌──────────────────────────────┐
│ AWS Route 53 (DNS)           │
└──────────────┬───────────────┘
               │
        ┌──────▼────────┐
        │ AWS ALB       │
        │ + ACM SSL     │
        └──────┬────────┘
               │
     ┌─────────┴─────────┐
     │                   │
  ┌──▼──┐            ┌──▼──┐
  │Task1│            │Task2│
  │Port │            │Port │
  │8000 │            │8000 │
  └──┬──┘            └──┬──┘
     │ (Docker Container)
     │ (ECS or Fargate)
     │
  ┌──▼─────────────────────┐
  │ AWS RDS or S3          │
  │ - Logs (S3)            │
  │ - Backups (RDS)        │
  └────────────────────────┘

Cost: $30-100/month
Setup time: 2-3 hours
Complexity: Medium
Availability: High (auto-scaling, multi-AZ)
```

---

### Option C: Kubernetes (Enterprise)
```
┌────────────────────────────────┐
│ Kubernetes Cluster             │
│ (EKS, GKE, or AKS)             │
│                                │
│  ┌──────────────────────────┐  │
│  │ Ingress Controller       │  │
│  │ (NGINX + SSL)            │  │
│  └──────────┬───────────────┘  │
│             │                  │
│   ┌─────────┴──────────────┐   │
│   │                        │   │
│  ┌▼───┐  ┌───┐  ┌───┐  ┌──▼─┐ │
│  │Pod1│  │Pod│  │Pod│  │Pod │ │
│  │    │  │ 2 │  │ 3 │  │ 4  │ │
│  └────┘  └───┘  └───┘  └────┘ │
│                                │
│  Persistent Volumes:           │
│  - Logs                        │
│  - Caches                      │
└────────────────────────────────┘

Cost: $50-300+/month
Setup time: 1-2 days
Complexity: High
Availability: Very High
Scalability: Excellent
```

---

## 9. 📋 PRE-DEPLOYMENT CHECKLIST

### Phase 1: Preparation (1-2 hours)
- [ ] Get Anthropic API key (https://console.anthropic.com/)
- [ ] Get Lakera Guard API key (https://www.lakera.ai/)
- [ ] Get LangSmith API key (optional, https://smith.langchain.com/)
- [ ] Generate `WATERMARK_SECRET_KEY`: 
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- [ ] Store all keys in secrets manager (don't use .env in production)
- [ ] Choose deployment architecture (single server vs Docker vs K8s)

### Phase 2: Infrastructure (1-4 hours)
- [ ] Provision server/container infrastructure
- [ ] Configure network and security groups
- [ ] Set up SSL/TLS certificate
- [ ] Configure reverse proxy (Nginx, ALB, Ingress)
- [ ] Create log directories with proper permissions
- [ ] Test connectivity (outbound to Anthropic, Lakera, etc.)

### Phase 3: Configuration (30 minutes)
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all API keys from secrets manager
- [ ] Verify all required variables set
- [ ] Test locally: `python test_security_controls.py`

### Phase 4: Deployment (1-2 hours)
- [ ] Build Docker image (if using Docker)
- [ ] Deploy to staging environment
- [ ] Run full integration tests
- [ ] Test all security controls
- [ ] Verify logs are being written
- [ ] Test alerting system

### Phase 5: Monitoring (1 hour)
- [ ] Set up Prometheus/DataDog/CloudWatch
- [ ] Configure log aggregation (ELK/CloudWatch)
- [ ] Set up alerts for security incidents
- [ ] Create monitoring dashboards
- [ ] Test alert channels (email, Slack, PagerDuty)

### Phase 6: Production (1-2 hours)
- [ ] Deploy to production
- [ ] Verify all endpoints responding
- [ ] Run smoke tests
- [ ] Monitor logs in real-time
- [ ] Verify no errors
- [ ] Document any issues

### Phase 7: Post-Deployment (ongoing)
- [ ] Monitor for false positives in rate limiting
- [ ] Tune rate limits based on actual usage
- [ ] Review security logs daily for first week
- [ ] Get security team sign-off
- [ ] Update incident response procedures

---

## 10. 🚀 QUICK DEPLOYMENT COMMAND REFERENCE

### Local/Development
```bash
cd fastapi-backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python run.py
# Server at http://localhost:8000
```

### Docker (Single Container)
```bash
cd fastapi-backend
docker build -t pdf-summarizer:1.0 .
docker run -p 8000:8000 --env-file .env pdf-summarizer:1.0
```

### Docker Compose (with Nginx)
```bash
docker-compose -f fastapi-backend/docker-compose.yml up -d
# Server at https://yourdomain.com
```

### AWS ECS (Fargate)
```bash
# 1. Push image to ECR
aws ecr create-repository --repository-name pdf-summarizer
docker tag pdf-summarizer:1.0 <account>.dkr.ecr.<region>.amazonaws.com/pdf-summarizer:1.0
docker push <account>.dkr.ecr.<region>.amazonaws.com/pdf-summarizer:1.0

# 2. Create task definition with image URL
# 3. Create service from task definition
# 4. Create ALB with HTTPS listener
```

### Kubernetes
```bash
# 1. Create namespace
kubectl create namespace pdf-summarizer

# 2. Create secrets
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  --from-literal=LAKERA_GUARD_API_KEY=xxx \
  -n pdf-summarizer

# 3. Deploy
kubectl apply -f fastapi-backend/k8s/ -n pdf-summarizer

# 4. Check status
kubectl get pods -n pdf-summarizer
```

---

## 11. 💰 ESTIMATED COSTS

### Minimum Setup (Single Server)
```
Per Month:
- Small VPS (2GB RAM, 10GB SSD): $5-10
- Anthropic API (modest usage): $10-50
- Lakera Guard (if paid tier): $0-20
- SSL Certificate: $0 (Let's Encrypt)
─────────────────────────────
Total: $15-80/month
```

### Recommended Setup (AWS)
```
Per Month:
- EC2 t3.medium or t3.small: $15-30
- ALB: $10-15
- CloudWatch Logs: $0.50-2
- Anthropic API: $10-50
- Lakera Guard: $0-20
- Optional: DataDog: $10-30
─────────────────────────────
Total: $45-147/month
```

### Enterprise Setup (Kubernetes)
```
Per Month:
- EKS cluster (managed K8s): $0.10 per hour = $73
- EC2 nodes (2x t3.medium): $30-50
- Load Balancer: $15-20
- CloudWatch/monitoring: $5-10
- Anthropic API: $50-200
- Lakera Guard: $20-50
- DataDog: $20-50
─────────────────────────────
Total: $213-450+/month
```

---

## 12. 🔍 VERIFICATION AFTER DEPLOYMENT

```bash
# 1. Health check
curl https://yourdomain.com/health
# Should return: {"status": "healthy", "service": "pdf-summarizer", "version": "1.0.0"}

# 2. Security log integrity
curl https://yourdomain.com/security/logs/verify
# Should show: {"log_valid": true, "report": "Log integrity verified (X entries)"}

# 3. Rate limit status
curl https://yourdomain.com/security/status
# Should show rate limit status

# 4. Run smoke tests
python -m pytest fastapi-backend/tests/ --smoke

# 5. Check logs
tail -f /var/logs/security_incidents.jsonl
tail -f /var/logs/app.log

# 6. Monitor metrics (if using Prometheus)
curl http://localhost:9090/api/v1/query?query=up
```

---

## 13. 📞 TROUBLESHOOTING

### API Keys Not Working
```bash
# Check if keys are set
echo $ANTHROPIC_API_KEY
echo $LAKERA_GUARD_API_KEY

# Test connection
python -c "
import httpx
import asyncio
async def test():
    async with httpx.AsyncClient() as client:
        response = await client.post('https://api.anthropic.com/v1/messages',
                                    headers={'Authorization': f'Bearer $ANTHROPIC_API_KEY'})
        print(response.status_code)
asyncio.run(test())
"
```

### High False Positive Rate on Rate Limiting
```
Tune in .env:
GLOBAL_TOKENS_PER_MINUTE=50000  # Increase
IP_TOKENS_PER_MINUTE=5000       # Increase
USER_TOKENS_PER_MINUTE=10000    # Increase
TOKEN_COST_LLM_CALL=500         # Decrease
```

### Security Logs Growing Too Large
```bash
# Set up log rotation in /etc/logrotate.d/pdf-summarizer
/var/logs/security_incidents.jsonl {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
}

# Run: logrotate -f /etc/logrotate.d/pdf-summarizer
```

### High Memory Usage
```bash
# Check memory usage
docker stats pdf-summarizer

# If high, reduce Presidio model size
# Or deploy on server with more RAM
```

---

## SUMMARY: What You Need

### MUST HAVE:
1. ✅ Anthropic API key
2. ✅ Server/infrastructure (cloud or on-prem)
3. ✅ SSL/TLS certificate
4. ✅ Secrets management solution
5. ✅ Logging storage (encrypted)
6. ✅ Basic monitoring

### STRONGLY RECOMMENDED:
7. ✅ Lakera Guard API key (for real prompt injection detection)
8. ✅ LangSmith API key (for forensics)
9. ✅ Monitoring/alerting (Prometheus, DataDog, etc.)
10. ✅ Log aggregation (ELK, CloudWatch, etc.)

### OPTIONAL:
11. Docker & Docker Compose
12. Kubernetes (for enterprise scale)
13. Advanced monitoring/APM tools

**Total Setup Time**: 2-8 hours depending on infrastructure choice  
**Total Cost**: $15-450+/month depending on scale

See detailed deployment checklist in `SECURITY_DEPLOYMENT_CHECKLIST.md` for 150+ verification items.
