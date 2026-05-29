# SECURITY DEPLOYMENT CHECKLIST

## Pre-Deployment Verification

Use this checklist before deploying to production.

### 1. CONFIGURATION & API KEYS ✅

- [ ] **Anthropic API Key**
  - [ ] Set `ANTHROPIC_API_KEY` in `.env`
  - [ ] Verified working with test API call
  - [ ] NOT hardcoded in source
  - [ ] Stored in secrets manager (AWS Secrets, Vault, etc.)

- [ ] **Lakera Guard (Prompt Injection)**
  - [ ] Account created at https://www.lakera.ai/
  - [ ] `LAKERA_GUARD_API_KEY` set in `.env`
  - [ ] `LAKERA_GUARD_ENABLED=true`
  - [ ] API key tested and working
  - [ ] Plan chosen (test vs. production)

- [ ] **Watermarking Secret**
  - [ ] `WATERMARK_SECRET_KEY` is 32+ random characters
  - [ ] Generated with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
  - [ ] Stored in secrets manager
  - [ ] Not shared or logged

- [ ] **PII De-anonymization Key**
  - [ ] `PII_DEANON_KEY` is valid Fernet key
  - [ ] Generated with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
  - [ ] Stored securely
  - [ ] Rotation plan in place

- [ ] **Security Log Signing Key**
  - [ ] `SECURITY_LOG_SIGNING_KEY` set and strong
  - [ ] Stored in secrets manager
  - [ ] Used for tamper detection

### 2. FEATURE FLAGS ✅

- [ ] **Security Flags Enabled**
  - [ ] `LAKERA_GUARD_ENABLED=true`
  - [ ] `PRESIDIO_ENABLED=true` (PII detection)
  - [ ] `GUARDRAILS_ENABLED=true` (output validation)
  - [ ] `TRACE_REQUESTS=true` (forensics)

- [ ] **Debug Mode Disabled**
  - [ ] `FASTAPI_DEBUG=false`
  - [ ] `FASTAPI_ENV=production`
  - [ ] `LOG_LEVEL=WARNING` (not DEBUG)

### 3. RATE LIMITING ✅

- [ ] **Rate Limits Configured**
  - [ ] `GLOBAL_TOKENS_PER_MINUTE=50000` (or appropriate value)
  - [ ] `IP_TOKENS_PER_MINUTE=5000`
  - [ ] `USER_TOKENS_PER_MINUTE=10000`
  - [ ] `TOKEN_COST_LLM_CALL=500` (prevents wallet-jacking)
  - [ ] `RATE_LIMIT_BLOCK_DURATION=300` (5 minutes)

- [ ] **Rate Limits Tested**
  - [ ] Load-tested with expected concurrent users
  - [ ] Verify IP blocking works
  - [ ] Verify user blocking works
  - [ ] Verify global limits work

### 4. FILE HANDLING ✅

- [ ] **File Size Limits**
  - [ ] `MAX_FILE_SIZE_MB=10` (appropriate for use case)
  - [ ] Tested with max-size PDF
  - [ ] Rejection of oversized files tested

- [ ] **Upload Directory**
  - [ ] `UPLOAD_TEMP_DIR` on encrypted storage
  - [ ] Directory has appropriate permissions (600)
  - [ ] Cleanup scheduled for old temporary files
  - [ ] Disk space monitoring in place

- [ ] **Content Type Validation**
  - [ ] Only PDF allowed (application/pdf)
  - [ ] MIME type validation enforced
  - [ ] File magic bytes verified (not just extension)

### 5. CORS & NETWORK ✅

- [ ] **CORS Configuration**
  - [ ] `ENABLE_CORS=false` if not needed for API
  - [ ] If enabled: `CORS_ORIGINS` is specific, not "*"
  - [ ] Production domains only (no localhost)
  - [ ] HTTPS enforced for all origins

- [ ] **HTTPS/TLS**
  - [ ] SSL/TLS certificate installed
  - [ ] Certificate is valid and not self-signed
  - [ ] TLS 1.2+ enforced
  - [ ] Certificate rotation scheduled

- [ ] **IP Whitelist** (if applicable)
  - [ ] Known client IPs whitelisted
  - [ ] WAF rules configured
  - [ ] DDoS protection enabled

### 6. LOGGING & MONITORING ✅

- [ ] **Security Logging**
  - [ ] `SECURITY_LOG_FILE` on encrypted, monitored storage
  - [ ] Log rotation configured (e.g., daily)
  - [ ] Logs not exposed via HTTP
  - [ ] Read-only permissions for logs (400)
  - [ ] Backup strategy for logs

- [ ] **Log Monitoring**
  - [ ] Alert on jailbreak attempts (>5/hour)
  - [ ] Alert on rate limit violations (>10/hour)
  - [ ] Alert on output violations (any critical)
  - [ ] Alert on PII exposure attempts (any)
  - [ ] Alert on log integrity failures (any)

- [ ] **Application Monitoring**
  - [ ] Error tracking (Sentry, DataDog, etc.)
  - [ ] Performance monitoring
  - [ ] API endpoint response times tracked
  - [ ] Resource usage monitored (CPU, memory, disk)

### 7. INCIDENT RESPONSE ✅

- [ ] **Incident Response Plan**
  - [ ] Security team contact info documented
  - [ ] Escalation procedure defined
  - [ ] Incident log format agreed
  - [ ] Data breach notification plan ready

- [ ] **Log Verification Process**
  - [ ] `verify_log_integrity()` runs daily
  - [ ] Hash chain validated
  - [ ] Results logged and alerting
  - [ ] Procedure for compromised logs documented

- [ ] **Alerting System**
  - [ ] Security incidents trigger alerts
  - [ ] Critical severity = immediate notification
  - [ ] Multiple notification channels (email, Slack, etc.)
  - [ ] On-call rotation for security incidents

### 8. TESTING ✅

- [ ] **Security Controls Testing**
  - [ ] Run `test_security_controls.py` - all tests pass
  - [ ] Prompt injection detection tested
  - [ ] Context isolation verified
  - [ ] PII redaction verified
  - [ ] Output guardrails tested
  - [ ] Rate limiting tested

- [ ] **Jailbreak Testing**
  - [ ] Known jailbreak patterns blocked
  - [ ] Prompt injection patterns blocked
  - [ ] Context isolation prevents bypass
  - [ ] False positives acceptable?

- [ ] **PII Testing**
  - [ ] Email redaction tested
  - [ ] Phone number redaction tested
  - [ ] Name redaction tested
  - [ ] De-anonymization token works
  - [ ] Client-side restoration verified

- [ ] **Output Validation Testing**
  - [ ] Code execution blocked
  - [ ] API key exposure blocked
  - [ ] System instruction overrides blocked
  - [ ] False positives reviewed

- [ ] **Rate Limiting Testing**
  - [ ] IP rate limit works
  - [ ] User rate limit works
  - [ ] Global rate limit works
  - [ ] Block duration enforced
  - [ ] Recovery works

- [ ] **Load Testing**
  - [ ] Baseline performance established
  - [ ] Expected peak load tested
  - [ ] Rate limiter behavior under load
  - [ ] LLM latency acceptable
  - [ ] No memory leaks

### 9. DEPENDENCIES ✅

- [ ] **Requirements Installed**
  - [ ] All packages from `requirements.txt` installed
  - [ ] Specific versions pinned (no `>=`)
  - [ ] Security scanning of dependencies run
  - [ ] No known vulnerabilities in dependencies

- [ ] **Dependency Security**
  - [ ] `pip install --upgrade pip`
  - [ ] No deprecated packages used
  - [ ] Security patches applied
  - [ ] Rotation schedule for dependency updates

### 10. DATABASE & STORAGE ✅

- [ ] **Security Log Storage**
  - [ ] Encrypted at rest (if cloud)
  - [ ] Encrypted in transit (TLS)
  - [ ] Access control restrictive
  - [ ] Audit logging of log access
  - [ ] Immutable or write-once storage

- [ ] **Temporary File Storage**
  - [ ] Encrypted if containing PII
  - [ ] Auto-cleanup scheduled
  - [ ] Secure deletion (not recoverable)
  - [ ] Cleanup verified working

### 11. DOCUMENTATION ✅

- [ ] **Security Documentation**
  - [ ] SECURITY_IMPLEMENTATION_GUIDE.md reviewed
  - [ ] All controls documented
  - [ ] Configuration options explained
  - [ ] Troubleshooting guide available

- [ ] **Runbooks**
  - [ ] Incident response runbook
  - [ ] Log verification procedure
  - [ ] Emergency key rotation procedure
  - [ ] Rollback procedure documented

- [ ] **Security Policy**
  - [ ] Data handling policy defined
  - [ ] PII handling policy defined
  - [ ] Incident response policy
  - [ ] Access control policy

### 12. COMPLIANCE ✅

- [ ] **Regulatory Compliance**
  - [ ] GDPR compliance (EU users)
  - [ ] CCPA compliance (CA users)
  - [ ] HIPAA compliance (if handling health data)
  - [ ] SOC 2 requirements met (if applicable)

- [ ] **Data Privacy**
  - [ ] PII not logged in plaintext
  - [ ] PII not stored unnecessarily
  - [ ] De-anonymization happens client-side
  - [ ] Data retention policy enforced
  - [ ] User can request data deletion

- [ ] **Security Standards**
  - [ ] OWASP Top 10 for LLMs addressed
  - [ ] NIST Cybersecurity Framework reference
  - [ ] Industry best practices followed
  - [ ] Penetration testing scheduled

### 13. DEPLOYMENT STEPS ✅

- [ ] **Pre-Deployment**
  - [ ] Code review completed
  - [ ] All tests pass locally
  - [ ] Security tests pass
  - [ ] Load tests pass
  - [ ] Staging deployment successful

- [ ] **Production Deployment**
  - [ ] Zero-downtime deployment possible
  - [ ] Rollback plan ready
  - [ ] Monitoring active during deployment
  - [ ] Team standing by
  - [ ] Post-deployment checks scheduled

- [ ] **Post-Deployment**
  - [ ] All endpoints responding
  - [ ] Security controls functioning
  - [ ] Logs being written correctly
  - [ ] Monitoring data flowing
  - [ ] No error spike detected
  - [ ] Performance acceptable
  - [ ] Security log integrity verified

### 14. SECRETS MANAGEMENT ✅

- [ ] **All Secrets Stored Securely**
  - [ ] Secrets manager configured (AWS Secrets, Vault, etc.)
  - [ ] `ANTHROPIC_API_KEY` in secrets manager
  - [ ] `LAKERA_GUARD_API_KEY` in secrets manager
  - [ ] `WATERMARK_SECRET_KEY` in secrets manager
  - [ ] `PII_DEANON_KEY` in secrets manager
  - [ ] No .env file in version control
  - [ ] `.env` in `.gitignore`

- [ ] **Access Control**
  - [ ] Only necessary services have access to secrets
  - [ ] Access logged and monitored
  - [ ] Principle of least privilege applied
  - [ ] Regular access reviews

- [ ] **Key Rotation**
  - [ ] Rotation schedule defined
  - [ ] Rotation procedure documented
  - [ ] Rotation tested (non-prod)
  - [ ] Emergency rotation procedure ready

### 15. FINAL SIGN-OFF ✅

- [ ] **Security Review**
  - [ ] Security team review completed
  - [ ] All findings addressed
  - [ ] Risk assessment completed
  - [ ] Sign-off obtained

- [ ] **Ops Review**
  - [ ] Operations team review completed
  - [ ] SLAs defined
  - [ ] Monitoring configured
  - [ ] Escalation paths defined

- [ ] **Deployment Approval**
  - [ ] Approved by security lead: _______________
  - [ ] Approved by ops lead: _______________
  - [ ] Approved by product lead: _______________
  - [ ] Date: _______________

---

## Post-Deployment Monitoring (First 24 Hours)

- [ ] Monitor security logs every hour
- [ ] Check for false positives in rate limiting
- [ ] Verify log integrity checks pass
- [ ] Monitor API latency and error rates
- [ ] Review incident alerts (if any)
- [ ] Confirm backup procedures working
- [ ] Verify monitoring dashboards

## Weekly Security Review

- [ ] Run log integrity check
- [ ] Review security incident statistics
- [ ] Check for any security alerts
- [ ] Review dependency security updates
- [ ] Test incident response procedure
- [ ] Verify backup restoration works

## Monthly Security Review

- [ ] Full security audit
- [ ] Penetration testing (if applicable)
- [ ] Review access logs
- [ ] Update security documentation
- [ ] Plan key rotations
- [ ] Review and update security policies

---

**Deployment Date**: _______________

**Deployed By**: _______________

**Approved By**: _______________

**Notes**:
