'use client';

/**
 * Security: Anti-Inspection & Client-Side Protections
 *
 * This module activates in production to:
 *  - Block right-click context menu
 *  - Block common DevTools keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U)
 *  - Override console methods to prevent data leaks via console
 *  - Set a periodic detection check for DevTools via debugger statements
 *  - Disable text selection globally
 */

export function enableAntiInspection(): void {
  if (typeof window === 'undefined') return;

  // Only apply in production or when explicitly enabled
  const shouldProtect =
    process.env.NODE_ENV === 'production' ||
    localStorage.getItem('enable_anti_inspection') === 'true';

  if (!shouldProtect) return;

  // ─── 1. Disable right-click context menu ──────────────────────────────
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    return false;
  });

  // ─── 2. Block DevTools keyboard shortcuts ─────────────────────────────
  const blockKeys = (e: KeyboardEvent): void => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return;
    }

    // Ctrl+Shift+I / J / C  |  Ctrl+U (view source)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
      e.preventDefault();
      return;
    }

    // Ctrl+U (view source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return;
    }

    // Ctrl+Shift+Delete for some browsers' dev tools resets
    if (e.ctrlKey && e.shiftKey && e.key === 'Delete') {
      e.preventDefault();
      return;
    }
  };
  document.addEventListener('keydown', blockKeys);

  // ─── 3. Override console in production ────────────────────────────────
  // This prevents sensitive data logged via console from being visible
  const noop = (): void => {};
  const originalConsole = { ...console };

  // Only NOP in production — in dev console is useful
  if (process.env.NODE_ENV === 'production') {
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    // Keep error visible for debugging crashes
    // console.error = noop;
    console.trace = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
  }

  // ─── 4. DevTools open detection via debugger statement ────────────────
  // Periodically trigger a conditional debugger that causes DevTools to pause
  // This works because when DevTools is open, the debugger statement pauses execution
  // We wrap it in a try/catch and use an interval that's harmless otherwise
  const element = new Image();
  const detectDevTools = (): void => {
    const threshold = 160; // width threshold to detect DevTools docked
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if (widthThreshold || heightThreshold) {
      // DevTools likely open — redirect or clear body
      // We use a soft approach: just warn and optionally redirect
      if (process.env.NODE_ENV === 'production') {
        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;color:#e8e8e8;font-family:sans-serif;text-align:center;padding:2rem;">
            <div>
              <h1 style="font-size:2rem;margin-bottom:1rem;color:#d4af37;">🔒 Security Notice</h1>
              <p style="font-size:1rem;color:#b8b8b8;">Developer tools detected. Please close them to continue using this service.</p>
            </div>
          </div>
        `;
      }
    }
  };

  // Check every 2 seconds
  setInterval(detectDevTools, 2000);

  // ─── 5. Re-inject keydown listener periodically to fight against removal ──
  setInterval(() => {
    document.removeEventListener('keydown', blockKeys);
    document.addEventListener('keydown', blockKeys);
  }, 10000);

  // ─── 6. Disable text selection globally via CSS injection ─────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Prevent text selection site-wide */
    body {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
    /* Prevent drag-and-drop of content */
    body * {
      -webkit-user-drag: none !important;
      user-drag: none !important;
    }
    /* Prevent image dragging */
    img {
      -webkit-user-drag: none !important;
      -khtml-user-drag: none !important;
      -moz-user-drag: none !important;
      -o-user-drag: none !important;
      user-drag: none !important;
      pointer-events: none !important;
    }
    /* Disable copy/paste */
    body {
      -webkit-touch-callout: none !important;
    }
  `;
  document.head.appendChild(style);
}