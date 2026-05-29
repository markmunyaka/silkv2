# WhatsApp Alerts - Quick Reference

## 📋 Quick Setup (5 minutes)

### 1. Add to `.env`
```bash
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_FROM_NUMBER="+1234567890"
TWILIO_TO_NUMBER="+your_phone"
```

### 2. Initialize in `src/app/layout.tsx`
```typescript
import { initializeWhatsAppAlerts } from '@/lib/initializeAlerts';

export default function RootLayout({ children }) {
  initializeWhatsAppAlerts();
  return <html><body>{children}</body></html>;
}
```

### 3. Test
```bash
curl -X GET http://localhost:3000/api/test/whatsapp
```

### 4. Add to API Routes
```typescript
import { sendFormattedWhatsAppAlert, isWhatsAppAlertConfigured } from '@/utils/whatsappAlert';

if (isWhatsAppAlertConfigured()) {
  sendFormattedWhatsAppAlert('Title', 'Message', '🚀')
    .catch(err => console.error('Alert failed:', err));
}
```

---

## 📚 API Reference

### Core Functions

#### `sendWhatsAppAlert(message: string)`
Send a raw WhatsApp message.
```typescript
await sendWhatsAppAlert('Simple message text');
```

#### `sendFormattedWhatsAppAlert(title, message, emoji?)`
Send a formatted alert with emoji and timestamp.
```typescript
await sendFormattedWhatsAppAlert(
  'PDF Complete',
  'Your document has been processed',
  '🚀'
);
```

#### `isWhatsAppAlertConfigured()`
Check if Twilio is properly configured.
```typescript
if (isWhatsAppAlertConfigured()) {
  // Safe to send alerts
}
```

#### `getWhatsAppAlertStatus()`
Get configuration debug info.
```typescript
const status = getWhatsAppAlertStatus();
console.log(status);
// { configured: true, fromNumber: '+1...', toNumber: '+1...' }
```

### Throttling Functions

#### `shouldThrottleAlert(key: string)`
Check if alert should be throttled (returns true if throttled).
```typescript
if (!shouldThrottleAlert('my_action')) {
  await sendFormattedWhatsAppAlert('Action', 'Completed', '✅');
}
```

#### `shouldAlertOnPageView(ip: string)`
Throttle page view alerts by IP address.
```typescript
if (shouldAlertOnPageView(clientIp)) {
  // New visitor - send alert
}
```

#### `resetThrottle(key: string)`
Reset throttle for a specific action.
```typescript
resetThrottle('my_action');
```

#### `clearAllTrackers()`
Clear all session trackers.
```typescript
clearAllTrackers(); // Testing only
```

### Initialization

#### `initializeWhatsAppAlerts()`
Initialize the entire alert system (call once at startup).
```typescript
import { initializeWhatsAppAlerts } from '@/lib/initializeAlerts';
initializeWhatsAppAlerts();
```

#### `getInitializationStatus()`
Get system initialization status.
```typescript
const status = getInitializationStatus();
console.log(status);
```

---

## 🎯 Common Patterns

### Pattern 1: Simple Alert After Action
```typescript
// In your API route...
if (operationSuccessful) {
  if (isWhatsAppAlertConfigured()) {
    sendFormattedWhatsAppAlert(
      'Operation Complete',
      'Your task finished successfully',
      '✅'
    ).catch(err => console.error('Alert failed:', err));
  }
}
return NextResponse.json({ success: true });
```

### Pattern 2: Throttled Alerts
```typescript
const throttleKey = `${userId}_${actionType}`;
if (!shouldThrottleAlert(throttleKey) && isWhatsAppAlertConfigured()) {
  await sendFormattedWhatsAppAlert('Alert', 'Message', '📬');
}
```

### Pattern 3: Error Alerts
```typescript
try {
  // Some operation
} catch (error) {
  if (isWhatsAppAlertConfigured()) {
    await sendFormattedWhatsAppAlert(
      '⚠️ Error Alert',
      `Error: ${error.message}`,
      '❌'
    );
  }
  throw error;
}
```

### Pattern 4: Batch Processing
```typescript
for (const item of items) {
  await processItem(item);
}

if (isWhatsAppAlertConfigured()) {
  await sendFormattedWhatsAppAlert(
    'Batch Complete',
    `Processed ${items.length} items successfully`,
    '📊'
  ).catch(err => console.error('Alert failed:', err));
}
```

---

## 🔧 Configuration Reference

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| `TWILIO_ACCOUNT_SID` | Yes | String | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Yes | String | `your_auth_token_here` |
| `TWILIO_FROM_NUMBER` | Yes | E.164 | `+1234567890` |
| `TWILIO_TO_NUMBER` | Yes | E.164 | `+1555123456` |
| `ALERT_THROTTLE_INTERVAL` | No | Milliseconds | `60000` (1 minute) |

**E.164 Format**: `+[Country Code][Number]`
- USA: `+1 555 123 4567` → `+15551234567`
- UK: `+44 20 7946 0958` → `+442079460958`

---

## 🧪 Testing

### Check Configuration
```bash
curl http://localhost:3000/api/test/whatsapp
```

### Send Test Alert
```bash
curl -X POST http://localhost:3000/api/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Hello WhatsApp!"}'
```

### Expected Response
```json
{
  "success": true,
  "message": "Test WhatsApp alert sent successfully",
  "sentTo": "+1555123456",
  "sentAt": "2024-01-15T10:30:45.123Z"
}
```

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "WhatsApp alerts not configured" | Check all 4 Twilio variables in `.env` |
| "Failed to send alert" | Verify phone numbers are in E.164 format |
| Messages not appearing | Check Twilio console, verify phone is registered |
| App crashes on alert | Always wrap in try/catch |
| Messages seem delayed | Check Twilio insights for delivery logs |

---

## 📁 Files Created

```
src/utils/whatsappAlert.ts              ← Core utility (117 lines)
src/utils/throttleTracker.ts            ← Throttling (165 lines)
src/lib/initializeAlerts.ts             ← Initialization (52 lines)
src/app/api/test/whatsapp/route.ts      ← Test endpoint (82 lines)
src/utils/whatsappIntegrationGuide.ts   ← Examples (190 lines)
.env.example                             ← Configuration template (updated)
WHATSAPP_SETUP_GUIDE.md                 ← Full setup guide
WHATSAPP_SUMMARIZE_EXAMPLE.ts           ← Integration example
WHATSAPP_QUICK_REFERENCE.md             ← This file
```

---

## ✅ Integration Checklist

- [ ] Installed Twilio: `npm install twilio`
- [ ] Created `.env` file with Twilio credentials
- [ ] Verified configuration with test endpoint
- [ ] Imported `initializeWhatsAppAlerts` in root layout
- [ ] Added alerts to first API route
- [ ] Tested with real user action
- [ ] Verified messages arrive on phone
- [ ] Added throttling for frequently-triggered events
- [ ] Reviewed security best practices
- [ ] Deployed to production

---

## 🔐 Security Checklist

- [ ] `.env` is in `.gitignore`
- [ ] No credentials in code comments
- [ ] Error messages don't expose sensitive data
- [ ] Test endpoint rate-limited in production
- [ ] Phone numbers sanitized in logs
- [ ] Twilio tokens rotated periodically

---

## 🚀 Next Steps

1. Set up Twilio account at https://console.twilio.com
2. Add credentials to `.env`
3. Run test endpoint to verify
4. Add to your first API route
5. Deploy and monitor

**Questions?** See `WHATSAPP_SETUP_GUIDE.md` for detailed instructions.
