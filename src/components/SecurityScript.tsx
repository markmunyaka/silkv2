'use client';

import { useEffect } from 'react';
import { enableAntiInspection } from '@/utils/antiInspection';
import { enableAntiTracking } from '@/utils/antiTracking';

/**
 * Client-side security component.
 * Injects anti-inspection and anti-tracking protections into the DOM on mount.
 * Must be a client component because it relies on DOM APIs.
 */
export function SecurityScript() {
  useEffect(() => {
    enableAntiInspection();
    enableAntiTracking();

    // Prevent right-click context menu in production
    if (process.env.NODE_ENV === 'production') {
      const handler = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handler);
      return () => document.removeEventListener('contextmenu', handler);
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}
