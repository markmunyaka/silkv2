# WhatsApp Real-Time Alerts with Twilio - Setup Guide

## Overview
This implementation enables real-time WhatsApp notifications to alert you whenever specific actions occur on your website (PDF summarization, video generation, lead processing, etc.) using the Twilio Messaging SDK.

## What Was Created

### 1. **Core Utilities**
- **`src/utils/whatsappAlert.ts`** - Main WhatsApp alert utility with:
  - `sendWhatsAppAlert()` - Send raw WhatsApp messages
  - `sendFormattedWhatsAppAlert()` - Send formatted messages with emoji and timestamps
  - `isWhatsAppAlertConfigured()` - Check if Twilio is configured
  - `getWhatsAppAlertStatus()` - Debug configuration status

- **`src/utils/throttleTracker.ts`** - Prevent notification spam with:
  - `shouldAlertOnPageView()` - Throttle page view alerts
  - `shouldThrottleAlert()` - Generic throttling for any alert type
  - `startAutoCleanup()` - Auto-cleanup old session trackers
  - `resetThrottle()` / `clearAllTrackers()` - Manual controls

### 2. **Initialization**
- **`src/lib/initializeAlerts.ts`** - Single entry point to initialize the system
  - Call `initializeWhatsAppAlerts()` in your root layout or startup script

### 3. **Test Endpoint**
- **`src/app/api/test/whatsapp/route.ts`** - Test your configuration:
  - `GET /api/test/whatsapp` - Check configuration status
  - `POST /api/test/whatsapp` - Send test alert

### 4. **Documentation & Examples**
- **`src/utils/whatsappIntegrationGuide.ts`** - 5 integration examples
- **`WHATSAPP_SUMMARIZE_EXAMPLE.ts`** - Example of integrating with PDF summarization
- **`.env.example`** - Updated with Twilio configuration variables

## Step-by-Step Setup

### Step 1: Set Up Twilio Account
1. Go to [Twilio Console](https://console.twilio.com)
2. Create a new account or log in
3. Get your **Account SID** and **Auth Token**
4. Navigate to "Messaging" → "WhatsApp Sandbox"
5. Follow Twilio's WhatsApp setup wizard
6. Note your **sandbox number** (e.g., +1234567890)

### Step 2: Configure Environment Variables
Copy your Twilio credentials to `.env` (create if not exists):

```bash
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_FROM_NUMBER="+1234567890"          # Twilio WhatsApp number
TWILIO_TO_NUMBER="+your_personal_phone"   # Your phone (e.g., +1555123456)
ALERT_THROTTLE_INTERVAL=60000             # Optional: 1 minute default
```

**Important**: Phone numbers must be in E.164 format: `+[country code][number]`

### Step 3: Verify WhatsApp Connection
Before adding alerts to your app, verify the WhatsApp connection:

1. **Start your Next.js app**: `npm run dev`
2. **Check configuration**: GET `http://localhost:3000/api/test/whatsapp`
3. **Send test alert**: 
   ```bash
   curl -X POST http://localhost:3000/api/test/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"title": "Setup Test", "message": "WhatsApp is working!"}'
   ```
4. **Check your phone** - You should receive a WhatsApp message within 10 seconds

### Step 4: Initialize in Your App
Add initialization to your root layout (`src/app/layout.tsx`):

```typescript
import { initializeWhatsAppAlerts } from '@/lib/initializeAlerts';

export default function RootLayout({ children }) {
  // Initialize WhatsApp alerts on app start
  initializeWhatsAppAlerts();
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### Step 5: Integrate Into Your API Routes

#### Example A: PDF Summarization
Add to `src/app/api/summarize/route.ts`:

```typescript
import { sendFormattedWhatsAppAlert, isWhatsAppAlertConfigured } from '@/utils/whatsappAlert';

// Inside your POST handler, after successful summarization:
if (isWhatsAppAlertConfigured()) {
  sendFormattedWhatsAppAlert(
    'PDF Summarization Complete',
    `📄 Document processed for user ${userId}`,
    '🚀'
  ).catch(err => console.error('Alert failed:', err));
}
```

#### Example B: With Throttling (Page Views)
```typescript
import { shouldThrottleAlert } from '@/utils/throttleTracker';
import { sendFormattedWhatsAppAlert } from '@/utils/whatsappAlert';

// On page load or action:
const throttleKey = `user_${userId}_pageview`;
if (!shouldThrottleAlert(throttleKey)) {
  await sendFormattedWhatsAppAlert(
    'New User Activity',
    `User just visited the app`,
    '👤'
  );
}
```

## Usage Examples

### Send a Simple Alert
```typescript
import { sendWhatsAppAlert } from '@/utils/whatsappAlert';

await sendWhatsAppAlert('Your custom message here');
```

### Send a Formatted Alert
```typescript
import { sendFormattedWhatsAppAlert } from '@/utils/whatsappAlert';

await sendFormattedWhatsAppAlert(
  'Video Generation Complete',
  'Your video is ready to download!\n\nDuration: 2m 45s\nSize: 125 MB',
  '🎬'
);
```

### Check Configuration
```typescript
import { getWhatsAppAlertStatus } from '@/utils/whatsappAlert';

const status = getWhatsAppAlertStatus();
console.log('Alert Status:', status);
// Output: { configured: true, fromNumber: '+1234567890', toNumber: '+1555123456' }
```

### Manual Throttle Control
```typescript
import { shouldThrottleAlert, resetThrottle } from '@/utils/throttleTracker';

// Check if action is throttled
if (!shouldThrottleAlert('my_action')) {
  // Send alert
}

// Reset throttle for an action
resetThrottle('my_action');

// Clear all trackers
clearAllTrackers();
```

## Recommended Integration Points

| Endpoint | Alert Type | Example Message |
|----------|-----------|---|
| `/api/summarize` | PDF completion | "🚀 PDF summarization complete for 45 pages" |
| `/api/video` | Video ready | "🎬 Video generation finished - 2.5 MB file" |
| `/api/leads` | Lead scraping | "📊 Scraped 150 leads - processing complete" |
| `/api/domains` | Domain purchase | "✅ Domain registered successfully" |
| `/api/convert` | File conversion | "📦 Document converted to DOCX format" |
| Middleware | Page view | "👤 New user session started" (throttled) |

## Configuration Reference

### Environment Variables
```bash
TWILIO_ACCOUNT_SID=       # Required: From Twilio Console
TWILIO_AUTH_TOKEN=        # Required: From Twilio Console
TWILIO_FROM_NUMBER=       # Required: Your Twilio WhatsApp number
TWILIO_TO_NUMBER=         # Required: Your personal WhatsApp number
ALERT_THROTTLE_INTERVAL=  # Optional: Throttle cooldown in ms (default: 60000)
```

### Throttle Configuration
- Default: 1 minute (60,000 ms)
- For testing: Set to 5,000 ms (5 seconds)
- For production: Set to 300,000 ms (5 minutes) or higher

### API Response Format
All alert functions return a Promise<void>. Wrap in try/catch to handle errors gracefully without blocking main requests.

## Troubleshooting

### ❌ "WhatsApp alerts not configured"
- Check that all 4 Twilio variables are in `.env`
- Verify phone numbers are in E.164 format (+1234567890)
- Restart your Next.js dev server after changing .env

### ❌ "Failed to send WhatsApp alert"
- Verify Twilio Account SID and Auth Token are correct
- Check that your personal phone number is registered with the Twilio WhatsApp Sandbox
- Ensure you've sent "join" message to the sandbox number
- Check Twilio console for delivery logs

### ❌ Messages not appearing on phone
- Verify phone numbers are correct in .env
- Check if WhatsApp Sandbox is still active (may expire after 72 hours of inactivity)
- Check Twilio Insights dashboard for delivery status
- Ensure phone is connected to WhatsApp and has internet

### ✅ Testing Locally
1. Run: `curl -X GET http://localhost:3000/api/test/whatsapp`
2. Check the JSON response for configuration status
3. If configured, POST a test message to verify delivery

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use .env files** - Add `.env` and `.env.local` to `.gitignore`
3. **Restrict in production** - Consider adding API authentication to test endpoint
4. **Log responsibly** - Don't log full phone numbers or Twilio tokens
5. **Error handling** - Always wrap alerts in try/catch to prevent crashes

## Production Deployment

### For Vercel
1. Add environment variables in Vercel Project Settings
2. Redeploy to apply changes
3. Test with `/api/test/whatsapp` endpoint

### For Self-Hosted
1. Update `.env` file on server
2. Restart Node.js process
3. Verify with test endpoint

## Advanced Configuration

### Custom Throttle Keys
```typescript
const key = `${userId}_${actionType}_${date}`;
if (!shouldThrottleAlert(key)) {
  // Send alert only once per date
}
```

### Batch Alerts
```typescript
const alerts = ['Alert 1', 'Alert 2', 'Alert 3'];
for (const alert of alerts) {
  try {
    await sendWhatsAppAlert(alert);
    // Add small delay between messages
    await new Promise(r => setTimeout(r, 500));
  } catch (err) {
    console.error('Batch alert failed:', err);
  }
}
```

### Custom Emoji Based on Status
```typescript
const emoji = success ? '✅' : '❌';
await sendFormattedWhatsAppAlert(
  `Operation ${success ? 'Successful' : 'Failed'}`,
  message,
  emoji
);
```

## File Structure
```
src/
├── app/
│   └── api/
│       └── test/
│           └── whatsapp/
│               └── route.ts              ← Test endpoint
├── lib/
│   └── initializeAlerts.ts               ← Initialization
└── utils/
    ├── whatsappAlert.ts                  ← Main utility
    ├── throttleTracker.ts                ← Throttling
    ├── whatsappIntegrationGuide.ts       ← Examples
    └── ...

.env.example                              ← Configuration template
WHATSAPP_SUMMARIZE_EXAMPLE.ts             ← Integration example
```

## Next Steps

1. ✅ Install Twilio SDK (`npm install twilio`)
2. ✅ Create utility files (already done)
3. ✅ Configure environment variables (.env)
4. ✅ Test with `/api/test/whatsapp` endpoint
5. **→ Integrate into your API routes**
6. **→ Test real alerts with user actions**
7. **→ Monitor Twilio dashboard for delivery**

## Support & Resources

- [Twilio Console](https://console.twilio.com)
- [Twilio WhatsApp API Docs](https://www.twilio.com/docs/sms/whatsapp/api)
- [WhatsApp Business Account Setup](https://www.twilio.com/docs/sms/whatsapp/managed-api)
- [Twilio Node.js SDK](https://github.com/twilio/twilio-node)

---

**Need help?** Check the integration examples in `src/utils/whatsappIntegrationGuide.ts` or `WHATSAPP_SUMMARIZE_EXAMPLE.ts`
