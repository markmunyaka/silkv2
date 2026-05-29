import * as twilio from 'twilio';

interface WhatsAppAlertConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
}

let twilioClient: ReturnType<typeof twilio.Twilio> | null = null;
let alertConfig: WhatsAppAlertConfig | null = null;

/**
 * Initialize the WhatsApp alert system with Twilio credentials
 * Should be called once at application startup
 */
export function initializeWhatsAppAlert(): void {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.TWILIO_TO_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.warn(
      'WhatsApp Alert not fully configured. Missing Twilio credentials in environment variables.'
    );
    return;
  }

  alertConfig = {
    accountSid,
    authToken,
    fromNumber,
    toNumber,
  };

  twilioClient = twilio.Twilio(accountSid, authToken);
  console.log('✓ WhatsApp Alert system initialized');
}

/**
 * Send a WhatsApp message alert to the configured phone number
 * @param messageBody - The message content to send
 * @throws Error if Twilio client is not initialized or message sending fails
 */
export async function sendWhatsAppAlert(messageBody: string): Promise<void> {
  // Lazy initialization if not already initialized
  if (!twilioClient || !alertConfig) {
    initializeWhatsAppAlert();
  }

  if (!twilioClient || !alertConfig) {
    console.error(
      'WhatsApp Alert: Twilio credentials not configured. Skipping alert.'
    );
    return;
  }

  try {
    // Validate message length (WhatsApp has a 4096 character limit, Twilio enforces 1600)
    const truncatedMessage =
      messageBody.length > 1600 ? messageBody.substring(0, 1597) + '...' : messageBody;

    const message = await twilioClient.messages.create({
      body: truncatedMessage,
      from: `whatsapp:${alertConfig.fromNumber}`,
      to: `whatsapp:${alertConfig.toNumber}`,
    });

    console.log(`✓ WhatsApp alert sent successfully (SID: ${message.sid})`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`✗ Failed to send WhatsApp alert: ${errorMessage}`);

    // In production, you might want to log this to an error tracking service
    // like Sentry, LogRocket, or similar
    throw new Error(`WhatsApp alert failed: ${errorMessage}`);
  }
}

/**
 * Send a formatted alert with a title and emoji
 * @param title - Alert title/category (e.g., "Service Complete")
 * @param message - Detailed message content
 * @param emoji - Optional emoji to prepend (e.g., "🚀")
 */
export async function sendFormattedWhatsAppAlert(
  title: string,
  message: string,
  emoji: string = '📬'
): Promise<void> {
  const formattedMessage = `${emoji} *${title}*\n${message}\n\n_Sent at: ${new Date().toLocaleString()}_`;
  await sendWhatsAppAlert(formattedMessage);
}

/**
 * Check if WhatsApp alert system is properly configured
 */
export function isWhatsAppAlertConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER &&
    process.env.TWILIO_TO_NUMBER
  );
}

/**
 * Get alert configuration status (for debugging)
 */
export function getWhatsAppAlertStatus(): {
  configured: boolean;
  fromNumber?: string;
  toNumber?: string;
} {
  if (!isWhatsAppAlertConfigured()) {
    return { configured: false };
  }

  return {
    configured: true,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    toNumber: process.env.TWILIO_TO_NUMBER,
  };
}
