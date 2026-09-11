/**
 * Kiosk behaviours that work in a plain Android browser / managed kiosk browser,
 * and are complemented by native Lock Task Mode when packaged as an APK.
 */
export function initKiosk() {
  // Block context menu, selection, pinch-zoom, pull-to-refresh gestures.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.body.style.touchAction = 'none';
  document.body.style.overscrollBehavior = 'none';

  // Trap back navigation so users cannot leave the player.
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));

  // Re-enter fullscreen on any interaction / visibility change.
  const goFullscreen = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (!document.fullscreenElement) {
      (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
    }
  };
  window.addEventListener('click', goFullscreen, { once: false });
  window.addEventListener('touchend', goFullscreen, { once: false });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) goFullscreen();
  });
}

/** Detects the current display geometry for pairing. */
export function detectDisplay() {
  const width = window.screen.width || window.innerWidth;
  const height = window.screen.height || window.innerHeight;
  return {
    width,
    height,
    devicePixelRatio: window.devicePixelRatio,
    orientation: (height >= width ? 'PORTRAIT' : 'LANDSCAPE') as 'PORTRAIT' | 'LANDSCAPE',
    userAgent: navigator.userAgent,
    platform: navigator.platform,
  };
}

/**
 * Freeze watchdog: if the requestAnimationFrame loop stalls for > threshold
 * (main thread wedged), reload the player to recover.
 */
export function startFreezeWatchdog(onFreeze: () => void, thresholdMs = 15000) {
  let last = performance.now();
  const tick = () => {
    last = performance.now();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.setInterval(() => {
    if (performance.now() - last > thresholdMs) onFreeze();
  }, 5000);
}
