/**
 * Shirt detail page runtime. Everything visual is CSS; this only
 *  1. flips the exhibit (button with constant name + aria-pressed; the hidden face is inert);
 *     a photo back is mounted from its <template> on first flip intent or on idle after `load`,
 *     and each photo face's sheen mask reuses the URL its <picture> loaded,
 *  2. tilts it + moves the sheen on fine pointers – rAF runs only while easing
 *     towards the last pointer position, then stops (no loop on touch, no gyro),
 *  3. prev/next via ←/→ and horizontal swipe,
 *  4. „← Kolekcja” returns through history when the collection is in it (filters/scroll kept),
 *  5. names the right elements at `pageswap` for the cross-document view transition,
 *  6. photo shirts: the „Lupa” magnifier (./lens.ts) and the originals viewer (./originals.ts).
 *
 * Elements marked `data-local-nav` (originals strip, viewer dialog) own their arrows/swipes,
 * so the page-level prev/next gestures ignore them.
 */
import { setupLens } from './lens';
import { setupOriginals } from './originals';

interface HistoryEntry {
  key: string;
  url: string | null;
}

interface NavigationLike {
  currentEntry: { index: number } | null;
  entries: () => HistoryEntry[];
  traverseTo: (key: string) => { finished: Promise<unknown> };
}

interface PageSwapLike extends Event {
  viewTransition: object | null;
  activation: { entry: { url: string | null } } | null;
}

/** Live query – the preference can change while the page is open. */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

const inView = (el: Element): boolean => {
  const { top, bottom, width } = el.getBoundingClientRect();
  return width > 0 && bottom > 0 && top < innerHeight;
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const isLocal = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-local-nav]') !== null;

const go = (link: HTMLAnchorElement | null): void => {
  if (link) location.href = link.href;
};

/**
 * Photo sheen: mask it with the very image the face's <picture> picked (same URL → HTTP cache
 * in production). Set only once the sheen can show: front on first hover, back on first flip.
 */
const maskFace = (face: HTMLElement | null): void => {
  const img = face?.querySelector('img');
  const clip = face?.querySelector<HTMLElement>('.sheen-clip');
  if (!img || !clip) return;
  const set = (): void => {
    if (!img.currentSrc) return;
    clip.style.setProperty('--mask', `url("${img.currentSrc}")`);
    clip.dataset.masked = '';
  };
  if (img.complete && img.naturalWidth) set();
  else img.addEventListener('load', set, { once: true });
};

/** Mounts the back cut-out (kept out of the initial load so the front is the only early image). */
const mountBack = (back: HTMLElement | null): void => {
  const template = back?.querySelector<HTMLTemplateElement>('template[data-back-face]');
  if (!back || !template) return;
  template.replaceWith(template.content.cloneNode(true));
};

const whenIdle = (task: () => void): void => {
  const run = (): void => {
    if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 3000 });
    else window.setTimeout(task, 1500);
  };
  if (document.readyState === 'complete') run();
  else addEventListener('load', run, { once: true });
};

const setupFlip = (exhibit: HTMLElement): (() => number) => {
  const button = exhibit.querySelector<HTMLButtonElement>('[data-flip]');
  if (!button) return () => 0;
  const front = exhibit.querySelector<HTMLElement>('[data-face="front"]');
  const back = exhibit.querySelector<HTMLElement>('[data-face="back"]');
  if (exhibit.hasAttribute('data-photo')) {
    const early = (): void => mountBack(back);
    // The sheen (fine pointers only) lights up on the first move over the stage.
    (exhibit.closest('[data-stage]') ?? exhibit).addEventListener('pointermove', () => maskFace(front), { once: true });
    // Hover/focus on the shirt (the flip button covers it) starts the download before the click.
    button.addEventListener('pointerenter', early, { once: true });
    button.addEventListener('focus', early, { once: true });
    whenIdle(early);
  }
  // Only the face the visitor sees stays in the accessibility tree / tab order.
  let backMasked = false;
  const show = (flipped: boolean): void => {
    if (flipped) {
      mountBack(back);
      if (!backMasked && exhibit.hasAttribute('data-photo')) {
        backMasked = true;
        maskFace(back);
      }
    }
    button.setAttribute('aria-pressed', String(flipped));
    exhibit.dataset.flipped = String(flipped);
    if (front) front.inert = flipped;
    if (back) back.inert = !flipped;
  };
  show(button.getAttribute('aria-pressed') === 'true');
  button.hidden = false;
  button.addEventListener('click', () => show(button.getAttribute('aria-pressed') !== 'true'));
  return () => (button.getAttribute('aria-pressed') === 'true' ? 1 : 0);
};

const setupTilt = (stage: HTMLElement, exhibit: HTMLElement, visibleFace: () => number): void => {
  const tilt = exhibit.querySelector<HTMLElement>('[data-tilt]');
  const sheens = exhibit.querySelectorAll<HTMLElement>('[data-sheen]');
  if (!tilt || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let rect: DOMRect | null = null;
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let frame = 0;

  // Cached box; dropped on resize (ResizeObserver) and scroll, re-read lazily on the next move.
  const forget = (): void => {
    rect = null;
  };
  new ResizeObserver(forget).observe(exhibit);
  addEventListener('scroll', forget, { passive: true });

  const render = (): void => {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    const idle = Math.abs(tx - x) + Math.abs(ty - y) < 0.002;
    if (idle) {
      x = tx;
      y = ty;
    }
    tilt.style.transform = `rotateX(${(y * -7).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg)`;
    // Only the face the visitor sees gets a moving highlight.
    const sheen = sheens[visibleFace()];
    if (sheen) sheen.style.transform = `translate(${(x * 26).toFixed(1)}%,${(y * 22).toFixed(1)}%)`;
    frame = idle ? 0 : requestAnimationFrame(render);
    if (idle && !tx && !ty) exhibit.classList.remove('is-live');
  };

  const kick = (): void => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  // Lens switched on (also by keyboard, with no pointer move to follow): ease the shirt flat,
  // or the lens would point at the wrong spot.
  new MutationObserver(() => {
    if (!exhibit.hasAttribute('data-lens-on')) return;
    tx = 0;
    ty = 0;
    kick();
  }).observe(exhibit, { attributes: true, attributeFilter: ['data-lens-on'] });

  // Switched to reduced motion mid-visit: drop the tilt at once (no easing back).
  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = 0;
    tx = 0;
    ty = 0;
    x = 0;
    y = 0;
    tilt.style.removeProperty('transform');
    sheens.forEach((sheen) => sheen.style.removeProperty('transform'));
    exhibit.classList.remove('is-live');
  });

  stage.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || reduceMotion.matches) return;
      // Under the magnifier the shirt must lie flat, or the lens would point at the wrong spot.
      if (exhibit.hasAttribute('data-lens-on')) {
        tx = 0;
        ty = 0;
        kick();
        return;
      }
      rect ??= exhibit.getBoundingClientRect();
      tx = clamp((event.clientX - rect.left - rect.width / 2) / rect.width);
      ty = clamp((event.clientY - rect.top - rect.height / 2) / rect.height);
      exhibit.classList.add('is-live');
      kick();
    },
    { passive: true },
  );
  stage.addEventListener('pointerleave', () => {
    tx = 0;
    ty = 0;
    kick();
  });
};

const setupKeys = (prev: HTMLAnchorElement | null, next: HTMLAnchorElement | null, blocked: () => boolean): void => {
  document.addEventListener('keydown', (event) => {
    if (event.isComposing) return; // IME composition (e.g. candidate list) owns the arrows
    if (blocked()) return; // the magnifier is on – arrows move the lens (lens.ts)
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTyping(event.target) || isLocal(event.target)) return;
    if (event.key === 'ArrowLeft') go(prev);
    else if (event.key === 'ArrowRight') go(next);
  });
};

const setupSwipe = (
  area: HTMLElement,
  prev: HTMLAnchorElement | null,
  next: HTMLAnchorElement | null,
  blocked: () => boolean,
): void => {
  const EDGE = 24; // leave the OS back/forward edge gestures alone
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let tracking = false;

  area.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      tracking =
        event.touches.length === 1 &&
        !isLocal(event.target) &&
        !!touch &&
        touch.clientX > EDGE &&
        touch.clientX < innerWidth - EDGE &&
        (visualViewport?.scale ?? 1) < 1.01; // pinch-zoomed: horizontal drags are panning
      if (!tracking || !touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startT = event.timeStamp;
    },
    { passive: true },
  );
  // A second finger (pinch, two-finger scroll) cancels the gesture for good.
  area.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) tracking = false;
    },
    { passive: true },
  );
  area.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      // Fingers still down → it was a multi-touch gesture, not a swipe.
      if (event.touches.length > 0) {
        tracking = false;
        return;
      }
      if (!tracking || !touch) return;
      tracking = false;
      if (blocked()) return; // the finger was steering the magnifier
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const quick = event.timeStamp - startT < 700;
      if (quick && Math.abs(dx) > Math.max(60, innerWidth * 0.18) && Math.abs(dx) > Math.abs(dy) * 2) {
        go(dx < 0 ? next : prev);
      }
    },
    { passive: true },
  );
  area.addEventListener(
    'touchcancel',
    () => {
      tracking = false;
    },
    { passive: true },
  );
};

const setupBack = (back: HTMLAnchorElement): void => {
  back.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = back.pathname;
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;

    if (nav?.currentEntry) {
      // Latest collection entry before this one, even after several prev/next hops.
      const entry = nav
        .entries()
        .slice(0, nav.currentEntry.index)
        .reverse()
        .find((item) => item.url !== null && new URL(item.url).pathname === target);
      if (entry) {
        event.preventDefault();
        // Entry evicted / traversal refused – fall back to a plain navigation. An AbortError
        // means another navigation superseded this one: leave that one alone.
        const fallback = (error?: unknown): void => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          location.href = back.href;
        };
        try {
          nav.traverseTo(entry.key).finished.catch(fallback);
        } catch (error) {
          fallback(error);
        }
      }
      return;
    }

    try {
      const from = new URL(document.referrer);
      if (from.origin === location.origin && from.pathname === target && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    } catch {
      // No / invalid referrer – plain link.
    }
  });
};

const setupViewTransition = (vis: HTMLElement | null, links: HTMLAnchorElement[]): void => {
  const named: HTMLElement[] = [];
  const ownName = vis?.style.viewTransitionName ?? '';
  let staleTimer = 0;

  /** Undo the temporary names set at `pageswap` (bfcache return or aborted navigation). */
  const reset = (): void => {
    window.clearTimeout(staleTimer);
    if (vis) vis.style.viewTransitionName = ownName;
    named.splice(0).forEach((card) => card.style.removeProperty('view-transition-name'));
  };

  addEventListener('pageswap', (event) => {
    const swap = event as PageSwapLike;
    if (!swap.viewTransition) return;
    // An exhibit scrolled out of view would fly in from off-screen – let it fade with the page.
    if (vis && !inView(vis)) vis.style.viewTransitionName = 'none';
    const url = swap.activation?.entry.url;
    if (url) {
      const path = new URL(url).pathname;
      links.forEach((link) => {
        const card = link.querySelector<HTMLElement>('[data-vt]');
        if (!card?.dataset.vt || link.pathname !== path || !inView(card)) return;
        card.style.viewTransitionName = card.dataset.vt;
        named.push(card);
      });
    }
    // Still here a while later → the navigation was aborted (stop, 204, download…).
    // Timers are frozen while the page sits in bfcache, so this never fires mid-transition.
    window.clearTimeout(staleTimer);
    staleTimer = window.setTimeout(reset, 4000);
  });

  // Back from bfcache, or revealed again without a transition: names must be the static ones.
  addEventListener('pageshow', reset);
  addEventListener('pagereveal', (event) => {
    if (!(event as Event & { viewTransition?: object | null }).viewTransition) reset();
  });
};

export const initDetail = (): void => {
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  const exhibit = document.querySelector<HTMLElement>('[data-exhibit]');
  const prev = document.querySelector<HTMLAnchorElement>('[data-nav="prev"]');
  const next = document.querySelector<HTMLAnchorElement>('[data-nav="next"]');
  const back = document.querySelector<HTMLAnchorElement>('[data-back]');
  const main = document.querySelector<HTMLElement>('main');

  const visibleFace = exhibit ? setupFlip(exhibit) : () => 0;
  if (stage && exhibit) setupTilt(stage, exhibit, visibleFace);
  const lens = exhibit ? setupLens(exhibit, visibleFace) : null;
  setupOriginals();
  if (prev || next) {
    setupKeys(prev, next, () => lens?.claimed() ?? false);
    if (main) setupSwipe(main, prev, next, () => lens?.claimed() ?? false);
  }
  if (back) setupBack(back);
  setupViewTransition(
    document.querySelector<HTMLElement>('[data-vt-self]'),
    [prev, next].filter((link): link is HTMLAnchorElement => link !== null),
  );

  const hint = document.querySelector<HTMLElement>('[data-hint]');
  if (hint) hint.dataset.on = '';
};
