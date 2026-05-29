/**
 * Page View Throttling Tracker
 * Prevents WhatsApp alert spam by debouncing page view notifications
 */

interface SessionTracker {
  sessionId: string;
  lastAlertTime: number;
  pageViews: number;
}

// In-memory storage for session tracking (can be replaced with Redis in production)
const sessionTrackers = new Map<string, SessionTracker>();

// Configuration (in milliseconds)
const THROTTLE_INTERVAL = parseInt(
  process.env.ALERT_THROTTLE_INTERVAL || '60000',
  10
); // Default: 1 minute
const CLEANUP_INTERVAL = 3600000; // Clear old sessions every hour

/**
 * Generate a simple session ID from request
 * Can use IP address, user ID, or cookie-based session ID
 */
function generateSessionId(ip: string): string {
  return `session_${ip}`;
}

/**
 * Check if a page view should trigger an alert
 * Returns true if throttle period has elapsed, false if still within throttle window
 */
export function shouldAlertOnPageView(ip: string): boolean {
  const sessionId = generateSessionId(ip);
  const now = Date.now();

  const tracker = sessionTrackers.get(sessionId);

  if (!tracker) {
    // New session - create tracker and allow alert
    sessionTrackers.set(sessionId, {
      sessionId,
      lastAlertTime: now,
      pageViews: 1,
    });
    return true;
  }

  const timeSinceLastAlert = now - tracker.lastAlertTime;

  if (timeSinceLastAlert >= THROTTLE_INTERVAL) {
    // Throttle period elapsed - update and allow alert
    tracker.lastAlertTime = now;
    tracker.pageViews = 1;
    return true;
  }

  // Still within throttle window - increment counter and deny alert
  tracker.pageViews += 1;
  return false;
}

/**
 * Get session stats for monitoring/debugging
 */
export function getSessionStats(ip: string): {
  isTracked: boolean;
  pageViews?: number;
  timeSinceLastAlert?: number;
  throttleIntervalMs?: number;
} {
  const sessionId = generateSessionId(ip);
  const tracker = sessionTrackers.get(sessionId);

  if (!tracker) {
    return { isTracked: false };
  }

  return {
    isTracked: true,
    pageViews: tracker.pageViews,
    timeSinceLastAlert: Date.now() - tracker.lastAlertTime,
    throttleIntervalMs: THROTTLE_INTERVAL,
  };
}

/**
 * Manually throttle alert calls with a key (more flexible)
 * Useful for API endpoints or service calls
 */
export function shouldThrottleAlert(key: string): boolean {
  const now = Date.now();

  const tracker = sessionTrackers.get(key);

  if (!tracker) {
    sessionTrackers.set(key, {
      sessionId: key,
      lastAlertTime: now,
      pageViews: 1,
    });
    return false; // First call - not throttled
  }

  const timeSinceLastAlert = now - tracker.lastAlertTime;

  if (timeSinceLastAlert >= THROTTLE_INTERVAL) {
    tracker.lastAlertTime = now;
    tracker.pageViews = 1;
    return false; // Throttle period elapsed - not throttled
  }

  tracker.pageViews += 1;
  return true; // Still within throttle window - throttled
}

/**
 * Reset throttle for a specific session/key
 * Useful for manual control or testing
 */
export function resetThrottle(key: string): void {
  sessionTrackers.delete(key);
  console.log(`✓ Throttle reset for key: ${key}`);
}

/**
 * Clear all tracked sessions
 * Useful for cleanup or testing
 */
export function clearAllTrackers(): void {
  const count = sessionTrackers.size;
  sessionTrackers.clear();
  console.log(`✓ Cleared ${count} session trackers`);
}

/**
 * Start automatic cleanup of old sessions
 * Runs on a schedule to prevent memory leaks
 */
export function startAutoCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, tracker] of sessionTrackers.entries()) {
      // Clean up sessions inactive for more than 1 hour
      if (now - tracker.lastAlertTime > CLEANUP_INTERVAL) {
        sessionTrackers.delete(key);
        cleanedCount += 1;
      }
    }

    if (cleanedCount > 0) {
      console.log(`✓ Cleaned up ${cleanedCount} inactive session trackers`);
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Get total number of tracked sessions
 */
export function getTrackerCount(): number {
  return sessionTrackers.size;
}
