/**
 * WHATSAPP ALERT INTEGRATION GUIDE
 * 
 * This file demonstrates how to integrate WhatsApp alerts into your API routes and services.
 * Copy patterns from here and adapt them to your specific use cases.
 */

import { sendFormattedWhatsAppAlert, isWhatsAppAlertConfigured } from '@/utils/whatsappAlert';
import { shouldThrottleAlert } from '@/utils/throttleTracker';

/**
 * Example 1: Integrate into API Route (e.g., PDF Summarization)
 * 
 * Add this code to your summarize/route.ts after successful summarization
 */
export async function exampleIntegrateIntoSummarizeRoute(userId: string) {
  // After successful summarization:
  
  if (isWhatsAppAlertConfigured()) {
    try {
      await sendFormattedWhatsAppAlert(
        'PDF Summarization Complete',
        `User ${userId} just completed a PDF summarization task.\n\nThe document has been processed and the summary is ready!`,
        '🚀'
      );
    } catch (error) {
      // Log error but don't fail the API request
      console.error('WhatsApp alert failed:', error);
    }
  }
}

/**
 * Example 2: Integrate with Throttling (Page Views)
 * 
 * Add this to a middleware or API route to prevent spam on page refreshes
 */
export async function exampleIntegrateWithThrottling(
  userId: string,
  actionType: string,
  clientIp: string
) {
  // Check if we should throttle this alert
  const throttleKey = `${userId}_${actionType}`;
  const isThrottled = shouldThrottleAlert(throttleKey);

  if (!isThrottled && isWhatsAppAlertConfigured()) {
    try {
      await sendFormattedWhatsAppAlert(
        'New User Activity',
        `${actionType} action triggered by user ${userId}`,
        '📬'
      );
    } catch (error) {
      console.error('WhatsApp alert failed:', error);
    }
  }
}

/**
 * Example 3: Service Completion Alerts
 * 
 * Add this after long-running service operations complete
 */
export async function exampleServiceCompletionAlert(
  serviceName: string,
  itemCount: number,
  duration: string
) {
  if (isWhatsAppAlertConfigured()) {
    try {
      await sendFormattedWhatsAppAlert(
        `${serviceName} Service Complete`,
        `Successfully processed ${itemCount} items in ${duration}.\n\nAll tasks completed successfully!`,
        '✅'
      );
    } catch (error) {
      console.error('WhatsApp alert failed:', error);
    }
  }
}

/**
 * Example 4: Error/Alert Notifications
 * 
 * Use this for critical errors that need immediate attention
 */
export async function exampleErrorAlert(errorContext: string, errorMessage: string) {
  if (isWhatsAppAlertConfigured()) {
    try {
      await sendFormattedWhatsAppAlert(
        'System Alert - Action Required',
        `${errorContext}\n\nError Details: ${errorMessage}`,
        '⚠️'
      );
    } catch (error) {
      // Even if alert fails, don't crash the app
      console.error('Failed to send error alert:', error);
    }
  }
}

/**
 * Example 5: Lead/Domain Processing Alert
 * 
 * Use this in leads or domain service handlers
 */
export async function exampleLeadProcessingAlert(
  leadCount: number,
  domain: string,
  source: string
) {
  const throttleKey = `lead_processing_${domain}`;
  const isThrottled = shouldThrottleAlert(throttleKey);

  if (!isThrottled && isWhatsAppAlertConfigured()) {
    try {
      await sendFormattedWhatsAppAlert(
        'Lead Processing Complete',
        `Processed ${leadCount} leads from ${domain}\n\nSource: ${source}\n\nReady for review!`,
        '📊'
      );
    } catch (error) {
      console.error('WhatsApp alert failed:', error);
    }
  }
}

/**
 * INTEGRATION CHECKLIST
 * 
 * To add WhatsApp alerts to your existing routes:
 * 
 * 1. ✓ Install Twilio: npm install twilio
 * 
 * 2. ✓ Create utility files:
 *    - src/utils/whatsappAlert.ts (created)
 *    - src/utils/throttleTracker.ts (created)
 * 
 * 3. Update your API routes:
 *    - Import { sendFormattedWhatsAppAlert, isWhatsAppAlertConfigured }
 *    - After successful operation, call sendFormattedWhatsAppAlert()
 *    - Wrap in try/catch to prevent failures affecting main request
 * 
 * 4. For frequently-triggered events, add throttling:
 *    - Import { shouldThrottleAlert }
 *    - Check throttle before sending: if (!shouldThrottleAlert(key)) { alert... }
 * 
 * 5. Configure environment variables:
 *    - TWILIO_ACCOUNT_SID
 *    - TWILIO_AUTH_TOKEN
 *    - TWILIO_FROM_NUMBER
 *    - TWILIO_TO_NUMBER
 *    - ALERT_THROTTLE_INTERVAL (optional)
 * 
 * 6. Test your integration:
 *    - Use a test API call to verify alerts are sent
 *    - Monitor Twilio console for message delivery
 * 
 * RECOMMENDED INTEGRATION POINTS
 * ==============================
 * 
 * 1. PDF Summarization (/api/summarize)
 *    - Alert when document processing completes
 *    - Include page count and summary status
 * 
 * 2. Video Generation (/api/video)
 *    - Alert when video generation starts
 *    - Alert when video is ready for download
 * 
 * 3. Lead Scraping (/api/leads)
 *    - Alert when scraping completes
 *    - Include lead count and validation status
 * 
 * 4. Domain Purchases (/api/domains)
 *    - Alert on successful domain registration
 *    - Alert on registration failures
 * 
 * 5. File Conversions (/api/convert)
 *    - Alert when large conversions complete
 *    - Include file format and size
 * 
 * 6. Page View Tracking (middleware)
 *    - Alert on unique visitor sessions (throttled)
 *    - Use shouldThrottleAlert to prevent spam
 */
