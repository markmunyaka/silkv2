# Email Deliverability Guide for Corporate/B2B Targets

## Overview
This guide covers email configuration for high deliverability to corporate domains that use strict email filtering (e.g., Mimecast, Microsoft Defender for Business, Proofpoint).

---

## 1. DNS Setup: SPF, DKIM, DMARC

### SPF Record
Add to your domain's DNS:
```
v=spf1 include:_spf.yourmailprovider.com ~all
```
Or for custom SMTP:
```
v=spf1 ip4:YOUR_SERVER_IP ~all
```

### DKIM Setup
For Nodemailer with custom SMTP, use nodemailer-dkim plugin:
```typescript
import dkim from 'nodemailer-dkim';
```

### DMARC Record
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100
```

---

## 2. IP Rotation for Inbox Deliverability

### Why IP Rotation Matters
Using multiple IPs distributes sending volume, reducing the risk of any single IP getting blacklisted. This is critical for high-volume campaigns and maintaining inbox delivery.

### Configuration with IPRotator

```typescript
import { NodemailerProvider, IPRotationConfig } from '@/lib/email-service';

const config: IPRotationConfig = {
  servers: [
    {
      host: 'smtp1.yourbusiness.com',
      port: 587,
      secure: false,
      auth: { user: 'ip1@yourbusiness.com', pass: 'password1' },
      localAddress: '192.168.1.101', // Bind to specific IP
      weight: 3, // Higher weight = more usage
    },
    {
      host: 'smtp2.yourbusiness.com',
      port: 587,
      secure: false,
      auth: { user: 'ip2@yourbusiness.com', pass: 'password2' },
      localAddress: '192.168.1.102',
      weight: 2,
    },
    {
      host: 'smtp3.yourbusiness.com',
      port: 587,
      secure: false,
      auth: { user: 'ip3@yourbusiness.com', pass: 'password3' },
      localAddress: '192.168.1.103',
      weight: 1,
    },
  ],
  strategy: 'weighted', // 'round-robin', 'weighted', 'random', 'failover'
  maxFailures: 5, // Mark IP unhealthy after 5 failures
};

// Create provider with IP rotation
const provider = new NodemailerProvider({
  provider: 'nodemailer',
  ipServers: config.servers,
  ipRotationStrategy: config.strategy,
  from: 'noreply@yourbusiness.com',
  fromName: 'Your Company',
});

// Monitor IP rotation stats
const stats = provider.getIPRotationStats();
console.log('IP Stats:', stats);
```

### Rotation Strategies

| Strategy | Best For | Description |
|----------|----------|-------------|
| `round-robin` | Even distribution | Cycles through IPs sequentially |
| `weighted` | Load balancing | Distributes based on weight values |
| `random` | General purpose | Random IP selection |
| `failover` | High reliability | Uses healthy IPs, marks failures |

### Health Monitoring

The IPRotator automatically:
- Tracks send success/failure per IP
- Marks IPs unhealthy after consecutive failures
- Re-enables IPs after 5-minute cooldown
- Provides usage statistics per IP

---

## 3. Nodemailer Transport Configuration

```typescript
const config = {
  provider: 'nodemailer',
  host: 'smtp.yourbusiness.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: 'your@business.com',
    pass: 'your-app-password',
  },
  from: 'your@business.com',
  fromName: 'Your Company Name',
  headers: {
    'X-Mailer': 'BusinessEmail/1.0',
  },
  // Optional: Bind to specific IP
  localAddress: '192.168.1.100',
};
```

### Connection Pool Settings
```typescript
const smtpConfig = {
  pool: true,
  maxConnections: 5,
  rateLimit: 5, // 5 emails per second max
};
```

---

## 4. Rate Limiting (Prevent Blacklisting)

The EmailRateLimiter class enforces:
- **Per-domain limit**: 10 emails per 5-minute window
- **Per-minute global**: 25 emails/minute
- **Per-hour global**: 400 emails/hour
- **Domain cooldown**: 2 seconds between same-domain sends

### Usage:
```typescript
import { emailRateLimiter } from '@/lib/email-service';

// Check before sending
const { canSend, waitMs } = emailRateLimiter.canSend('recipient@company.com');
if (!canSend) {
  await new Promise(resolve => setTimeout(resolve, waitMs));
}

// Record after sending
emailRateLimiter.recordSend('recipient@company.com');

// Monitor stats
const stats = emailRateLimiter.getStats();
```

---

## 5. From & Reply-To Best Practices for B2B

### ✅ Recommended:
```
From: "Your Company Name" <noreply@yourbusiness.com>
Reply-To: support@yourbusiness.com (or same as From)
```

### ❌ Avoid:
- Free email providers (gmail.com, yahoo.com, hotmail.com)
- Generic noreply@ domains without company branding
- Reply-To different domain than From (raises red flags)

### Validation in NodemailerProvider:
The provider automatically validates:
- From address must have valid business domain
- Warns if Reply-To uses free email provider

---

## 6. Email Headers for Corporate Filters

### Automatic Headers (NodemailerProvider)
```typescript
headers: {
  'X-Priority': '3',              // Normal (avoid '1' - looks spammy)
  'X-MSMail-Priority': 'Normal',
  'X-Auto-Response-Suppress': 'All',
  'List-Unsubscribe': '<mailto:unsubscribe@domain.com>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  'Feedback-ID': 'campaign:timestamp:source',
}
```

### For Mimecast specifically:
- Ensure from domain matches SPF
- Use consistent Message-ID format
- Avoid suspicious attachments (.exe, .zip)
- Keep HTML-to-text ratio balanced

---

## 7. Batch Sending with Rate Limiting

```typescript
const provider = new NodemailerProvider(config);

const results = await provider.sendBatchWithRateLimit(
  recipients.map(email => ({
    recipient: email,
    payload: {
      from: 'your@business.com',
      subject: 'Your Subject',
      html: '<p>Email content</p>',
    },
  })),
  (sent, total) => {
    console.log(`Progress: ${sent}/${total}`);
  }
);

console.log(`Sent: ${results.sent}, Failed: ${results.failed}`);
```

---

## 8. Testing Deliverability

### Test Checklist:
1. ✅ SPF pass: [link](https://www.mailgenius.com/)
2. ✅ DKIM pass
3. ✅ DMARC aligned
4. ✅ Headers not blocked
5. ✅ Content not flagged

### Free Testing Tools:
- [Mailtrap](https://mailtrap.io) - Email preview/staging
- [Mail-tester.com](https://www.mail-tester.com) - Spam score
- [MXToolbox](https://mxtoolbox.com/) - DNS lookup

---

## 9. Troubleshooting Corporate Filter Blocks

| Issue | Solution |
|-------|----------|
| Mimecast rejects | Check SPF/DKIM alignment, reduce sending volume |
| SPF fail | Verify server IP in SPF record |
| DKIM fail | Re-sign with correct selector |
| Content flagged | Avoid excessive links, use text version |
| Rate limited | Use EmailRateLimiter, spread sends over time |
| IP blacklisted | Rotate to another IP, investigate cause |
| Low inbox rate | Enable IP rotation, warm up new IPs |

---

## 10. Quick Reference: Configuration Checklist

- [ ] Business domain for From/Reply-To (not Gmail/Yahoo)
- [ ] SPF record published for sending server
- [ ] DKIM configured with mail provider
- [ ] DMARC record set (start with p=quarantine)
- [ ] Rate limiter configured
- [ ] IP rotation enabled (multiple IPs)
- [ ] Health monitoring set up for IPs
- [ ] Test email sent to yourself first
- [ ] Monitor bounce rate and adjust
