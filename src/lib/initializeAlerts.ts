/**
 * WhatsApp Alert Initialization
 * 
 * Call this function in your app's root layout or API initialization
 * to set up the WhatsApp alert system and throttle cleanup.
 * 
 * Usage in src/app/layout.tsx:
 * 
 * import { initializeWhatsAppAlerts } from '@/lib/initializeAlerts';
 * 
 * export default function RootLayout({...}) {
 *   // Initialize on first render
 *   initializeWhatsAppAlerts();
 *   
 *   return (...)
 * }
 * 
 * Or in a server component or API initialization:
 * 
 * import { initializeWhatsAppAlerts } from '@/lib/initializeAlerts';
 * 
 * // Call once at startup
 * initializeWhatsAppAlerts();
 */

import { initializeWhatsAppAlert } from '@/utils/whatsappAlert';
import { startAutoCleanup, getTrackerCount } from '@/utils/throttleTracker';

let initialized = false;

export function initializeWhatsAppAlerts(): void {
  if (initialized) {
    return;
  }

  // Initialize WhatsApp alert system
  initializeWhatsAppAlert();

  // Start automatic session cleanup
  // This prevents memory leaks from accumulating session trackers
  startAutoCleanup();

  // Log initialization status
  console.log('✓ WhatsApp Alert System initialized');
  console.log(`✓ Session throttle tracking enabled (${getTrackerCount()} active sessions)`);

  initialized = true;
}

/**
 * Check if the WhatsApp alert system has been initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Get initialization status and diagnostics
 */
export function getInitializationStatus(): {
  initialized: boolean;
  activeSessionTrackers: number;
  whatsappConfigured: boolean;
} {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER } = process.env;

  return {
    initialized,
    activeSessionTrackers: getTrackerCount(),
    whatsappConfigured: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && TWILIO_TO_NUMBER),
  };
}
