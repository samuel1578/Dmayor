import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Global route scroll restoration (Phase E4).
 *
 * Mounted once at the routing root so no page needs its own `window.scrollTo`:
 *
 *   - Any push/replace navigation (Cart → Checkout, Checkout → Order
 *     Confirmation, Orders → Order Detail, or any future result page) opens at
 *     the top of the new page. This is what fixes confirmation screens opening
 *     at the previous scroll position.
 *   - Back/forward (`POP`) is left alone, so the browser can restore where the
 *     customer actually was instead of being yanked to the top.
 *   - An intentional in-page hash target is honoured and never overridden.
 *
 * Scrolling is instant (`behavior: 'auto'`) rather than smooth, so it does not
 * animate on top of the scrollytelling hero or any other in-page motion, and it
 * respects reduced-motion preferences by not animating at all.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Browser back/forward without a hash target: hands-off.
    if (navigationType === 'POP' && !hash) return;

    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
      // A hash that does not exist on this route still gets a predictable top.
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash, navigationType]);

  return null;
}
