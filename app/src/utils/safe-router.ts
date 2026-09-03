import { router } from 'expo-router';

/**
 * Global Safe Navigation & Throttle Guard
 *
 * Solves the issue where rapid double-tapping on buttons or cards causes duplicate
 * navigation pushes to the same screen, leading to double screens on the stack,
 * stutter, and double-back navigation.
 *
 * Features:
 * 1. 0ms latency on the first click (instantaneous navigation).
 * 2. Dropping duplicate identical screen pushes within 800ms.
 * 3. Dropping rapid conflicting screen transitions within 400ms.
 * 4. Debouncing back button taps within 350ms to prevent double-pop.
 * 5. Automatically applied to all `router.push`, `router.navigate`, `router.replace`, and `router.back` calls.
 */

const THROTTLE_SAME_ROUTE_MS = 450; // Block duplicate identical screen push
const THROTTLE_ANY_ROUTE_MS = 150;  // Block rapid multi-screen push
const BACK_DEBOUNCE_MS = 250;       // Prevent accidental double back-pops

let lastNavTime = 0;
let lastTarget = '';
let lastBackTime = 0;
let navResetTimer: ReturnType<typeof setTimeout> | null = null;

const serializeHref = (href: any): string => {
  if (!href) return '';
  if (typeof href === 'string') return href.trim();
  if (typeof href === 'object') {
    const pathname = href.pathname || '';
    const params = href.params ? JSON.stringify(href.params) : '';
    return `${pathname}?${params}`;
  }
  return String(href);
};

// Keep original router methods
const originalPush = router.push.bind(router);
const originalNavigate = router.navigate ? router.navigate.bind(router) : originalPush;
const originalReplace = router.replace.bind(router);
const originalBack = router.back.bind(router);

let isPatched = false;

export const installSafeRouter = () => {
  if (isPatched) return;
  isPatched = true;

  // Safe Push
  router.push = ((href: any, options?: any) => {
    const now = Date.now();
    const target = serializeHref(href);

    // If identical route requested within throttle window, silently ignore duplicate tap
    if (target && target === lastTarget && now - lastNavTime < THROTTLE_SAME_ROUTE_MS) {
      return;
    }

    // If any navigation happened within 400ms, ignore rapid secondary tap
    if (now - lastNavTime < THROTTLE_ANY_ROUTE_MS) {
      return;
    }

    lastNavTime = now;
    lastTarget = target;

    if (navResetTimer) clearTimeout(navResetTimer);
    navResetTimer = setTimeout(() => {
      lastTarget = '';
    }, THROTTLE_SAME_ROUTE_MS);

    return originalPush(href, options);
  }) as any;

  // Safe Navigate
  router.navigate = ((href: any, options?: any) => {
    const now = Date.now();
    const target = serializeHref(href);

    if (target && target === lastTarget && now - lastNavTime < THROTTLE_SAME_ROUTE_MS) {
      return;
    }

    if (now - lastNavTime < THROTTLE_ANY_ROUTE_MS) {
      return;
    }

    lastNavTime = now;
    lastTarget = target;

    if (navResetTimer) clearTimeout(navResetTimer);
    navResetTimer = setTimeout(() => {
      lastTarget = '';
    }, THROTTLE_SAME_ROUTE_MS);

    return originalNavigate(href, options);
  }) as any;

  // Safe Replace
  router.replace = ((href: any, options?: any) => {
    const now = Date.now();
    const target = serializeHref(href);

    if (target && target === lastTarget && now - lastNavTime < 400) {
      return;
    }

    lastNavTime = now;
    lastTarget = target;

    if (navResetTimer) clearTimeout(navResetTimer);
    navResetTimer = setTimeout(() => {
      lastTarget = '';
    }, 500);

    return originalReplace(href, options);
  }) as any;

  // Safe Back
  router.back = (() => {
    const now = Date.now();
    if (now - lastBackTime < BACK_DEBOUNCE_MS) {
      return;
    }
    lastBackTime = now;
    lastNavTime = now;
    lastTarget = '';
    return originalBack();
  }) as any;
};

// Automatically install at runtime on import
installSafeRouter();

export { router };
export default installSafeRouter;
