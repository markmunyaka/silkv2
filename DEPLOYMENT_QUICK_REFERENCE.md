# DEPLOYMENT QUICK REFERENCE

## 📋 WHAT YOU NEED (IN ORDER)

### 1️⃣ API KEYS (15 min)
```
Anthropic Claude       → https://console.anthropic.com/
Lakera Guard          → https://www.lakera.ai/
LangSmith (optional)  → https://smith.langchain.com/
```

### 2️⃣ SERVER/INFRASTRUCTURE (30 min - 2 hours)
```
Choose ONE:
• Single Linux server (VPS $5-10/mo)
• Docker + Docker Compose (any server)
• AWS ECS + RDS ($30-100/mo)
• Kubernetes cluster ($50-300+/mo)
```

### 3️⃣ SSL/TLS CERTIFICATE (15 min)
```
Choose ONE:
• Let's Encrypt (free, auto-renews)
• AWS ACM (if on AWS)
• Self-signed (dev only)
```

### 4️⃣ SECRETS MANAGER (15 min)
```
Choose ONE:
• AWS Secrets Manager
• HashiCorp Vault
• Azure Key Vault
• Simple .env (dev only, NOT production!)
```

### 5️⃣ LOGGING STORAGE (30 min)
```
Encrypted storage for security logs:
• /var/logs on encrypted disk
• AWS S3 (encrypted)
• Managed Elasticsearch
```

### 6️⃣ MONITORING/ALERTING (1 hour)
```
Choose ONE or combine:
• Prometheus + Grafana (free, self-hosted)
• DataDog ($10-20/mo)
• AWS CloudWatch (pay-as-you-go)
• New Relic ($15-30/mo)
```

### 7️⃣ LOG AGGREGATION (1 hour)
```
Choose ONE:
• ELK Stack (Elasticsearch, Logstash, Kibana)
• AWS CloudWatch
• Splunk
• Loki
```

---

## ⏱️ TIMELINE

| Phase | Time | Tasks |
|-------|------|-------|
| **Prep** | 1-2 hrs | Get API keys, choose infrastructure |
| **Infrastructure** | 1-4 hrs | Set up server, SSL, network |
| **Config** | 30 min | Environment variables, secrets |
| **Deployment** | 1-2 hrs | Build, deploy, test |
| **Monitoring** | 1 hr | Set up alerts, dashboards |
| **Production** | 1-2 hrs | Final deploy, verification |
| **TOTAL** | 5-11 hours | ← One day of work |

---

## 💵 COST ESTIMATE

```
MINIMUM:
$15-80/month
(Single server + API calls)

RECOMMENDED:
$45-147/month
(AWS + monitoring)

ENTERPRISE:
$213-450+/month
(Kubernetes + enterprise tools)
```

---

## 🎯 BEFORE YOU START

**Checklist:**

- [ ] Anthropic API key obtained
- [ ] Lakera Guard API key obtained (or willing to use fallback)
- [ ] Server/infrastructure selected
- [ ] Domain name ready (for SSL cert)
- [ ] Secrets manager chosen
- [ ] Monitoring tool selected
- [ ] Logging location prepared
- [ ] Team trained on security controls
- [ ] Incident response plan in place
- [ ] Backup/recovery procedures documented

---

## 🚀 FASTEST DEPLOYMENT PATH

**Goal**: Get running in ~2 hours

### Option A: Simple VPS (Cheapest)
```bash
# 1. Rent small VPS ($5/mo)
# 2. Install Docker: apt-get install docker.io
# 3. Get API keys (15 min)
# 4. Clone repo: git clone ...
# 5. Create .env with API keys
# 6. Build image: docker build -t pdf-summarizer .
# 7. Run: docker run -p 8000:8000 --env-file .env pdf-summarizer
# 8. Set up Let's Encrypt SSL
# 9. Put Nginx in front
# 10. Done!

Setup time: ~2 hours
Cost: $5-10/month
```

### Option B: AWS (Most Reliable)
```bash
# 1. Create AWS account (free tier available)
# 2. Launch EC2 t3.small instance
# 3. Get API keys (15 min)
# 4. SSH into instance
# 5. Install Docker & Docker Compose
# 6. Clone repo
# 7. Create .env file
# 8. Run docker-compose up
# 9. Set up ALB with SSL
# 10. Configure CloudWatch logging
# 11. Done!

Setup time: ~3 hours
Cost: $15-30/month
```

### Option C: Railway.app (Easiest)
```bash
# 1. Sign up at railway.app
# 2. Connect GitHub repo
# 3. Add environment variables (API keys)
# 4. Deploy with one click
# 5. Done!

Setup time: ~30 minutes
Cost: $5-10/month (free tier available)
```

---

## 📝 SAMPLE CONFIGURATION

### Minimum .env for Production

```bash
# REQUIRED - Get from APIs
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
LAKERA_GUARD_API_KEY=your-lakera-key-here
WATERMARK_SECRET_KEY=<32+ random chars>

# REQUIRED - Security
FASTAPI_ENV=production
FASTAPI_DEBUG=false
LOG_LEVEL=WARNING

# REQUIRED - Logging
SECURITY_LOG_FILE=/var/logs/security_incidents.jsonl
UPLOAD_TEMP_DIR=/tmp/pdf_uploads

# RECOMMENDED - Features
LAKERA_GUARD_ENABLED=true
PRESIDIO_ENABLED=true
GUARDRAILS_ENABLED=true

# OPTIONAL - Forensics
TRACE_REQUESTS=true
LANGSMITH_API_KEY=ls-xxxxx
LANGSMITH_PROJECT=pdf-summarizer-security
```

---

## 🔐 SECURITY CHECKLIST

Before going live:

- [ ] No API keys in code or git history
- [ ] All secrets in secrets manager
- [ ] SSL/TLS enabled on all endpoints
- [ ] Security log storage encrypted
- [ ] Log integrity verification tested
- [ ] Rate limiting configured
- [ ] Monitoring alerts configured
- [ ] Incident response team ready
- [ ] Backup procedures tested
- [ ] Disaster recovery plan ready

---

## 📞 WHAT TO DO IF STUCK

1. **Check API connectivity**:
   ```bash
   curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
        https://api.anthropic.com/v1/models
   ```

2. **Test locally first**:
   ```bash
   cd fastapi-backend
   python test_security_controls.py
   ```

3. **Read the guides**:
   - `SECURITY_IMPLEMENTATION_GUIDE.md` (technical)
   - `SECURITY_DEPLOYMENT_CHECKLIST.md` (verification)
   - `DEPLOYMENT_REQUIREMENTS.md` (this document)

4. **Check logs**:
   ```bash
   tail -f /var/logs/app.log
   tail -f /var/logs/security_incidents.jsonl
   ```

5. **Verify security**:
   ```bash
   curl https://yourdomain.com/health
   curl https://yourdomain.com/security/logs/verify
   ```

---

## ✅ POST-DEPLOYMENT VERIFICATION

```bash
# 1. Health check passes
curl https://yourdomain.com/health → {"status": "healthy"}

# 2. Security logs being written
ls -lah /var/logs/security_incidents.jsonl → recent timestamp

# 3. Log integrity verified
curl https://yourdomain.com/security/logs/verify → valid: true

# 4. Monitoring working
Check CloudWatch/Prometheus dashboard

# 5. Alerts configured
Test by triggering rate limit alert

# 6. No errors in logs
grep ERROR /var/logs/app.log → (should be empty)

# 7. API keys working
Test with dummy PDF upload → success
```

---

## 🎓 LEARNING PATH

1. **Read**: `SECURITY_AUDIT_COMPLETE.md` (2 min overview)
2. **Read**: `DEPLOYMENT_REQUIREMENTS.md` (this file)
3. **Choose**: Infrastructure option A/B/C
4. **Get**: API keys from Anthropic & Lakera Guard
5. **Configure**: .env file with your keys
6. **Test**: `python test_security_controls.py`
7. **Deploy**: Following your chosen architecture
8. **Monitor**: Set up alerting and logging
9. **Verify**: Run post-deployment checklist
10. **Done**: You're live!

---

## NEXT STEPS

1. **Choose deployment option** (see timeline above)
2. **Read DEPLOYMENT_REQUIREMENTS.md** (full details)
3. **Get API keys** (Anthropic + Lakera Guard)
4. **Set up infrastructure** (VPS, Docker, or AWS)
5. **Configure and deploy**
6. **Set up monitoring**
7. **Run security verification**
8. **Go live!**

**Questions?** See the comprehensive guides in the `fastapi-backend/` directory.

---

**Total time to production**: 5-8 hours  
**Total monthly cost**: $15-150/month (depending on scale)  
**Security level**: ENTERPRISE (OWASP Top 10 for LLMs)
