/**
 * „Szatnia” rack behaviour – everything here is progressive enhancement over a native
 * horizontal scroller (touch momentum, trackpad, keyboard scrolling all work without it).
 *
 *  1. Sway: each shirt is a damped spring (angle around the hook) chasing a target angle
 *     proportional to the strip's scroll velocity. rAF runs only while something moves.
 *  2. Mouse drag-to-scroll with a short inertial glide (pointer events, click suppressed after a drag).
 *  3. Vertical wheel → horizontal, only while the strip can still move that way and the user
 *     isn't in the middle of scrolling the page (edges and ongoing page scrolls pass through).
 *  4. Arrow keys / Home / End move focus between the shirts, centring the focused one.
 *  5. Warm-up: the back cut-outs sit in inert <template>s until a hover-capable user approaches.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const canHover = window.matchMedia('(hover: hover)');

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** deg per (px/ms) of scroll velocity, and the cap. */
const GAIN = 3.2;
const MAX_ANGLE = 9;
/** Spring: ω₀ ≈ 9–11 rad/s, ζ ≈ 0.35 → two or three visible swings, settled in ~1.5 s. */
const STIFFNESS = 95;
const DAMPING = 7;
const STEP_MS = 8;
/** Pause after which a page wheel gesture counts as finished (ms). */
const WHEEL_GESTURE_GAP = 400;
const DRAG_THRESHOLD = 6;

interface Body {
  el: HTMLElement;
  k: number;
  angle: number;
  speed: number;
}

export const initRack = (root: HTMLElement): void => {
  const strip = root.querySelector<HTMLElement>('[data-rack]');
  if (!strip) return;
  const links = [...strip.querySelectorAll<HTMLAnchorElement>('a[data-shirt-link]')];

  // Slightly different stiffness per shirt so they never swing in lockstep.
  const bodies: Body[] = [...strip.querySelectorAll<HTMLElement>('[data-swing]')].map((el, i) => ({
    el,
    k: STIFFNESS * (0.86 + ((i * 37) % 10) * 0.03),
    angle: 0,
    speed: 0,
  }));

  const behavior = (): ScrollBehavior => (reduceMotion.matches ? 'auto' : 'smooth');

  /* ── 1. Sway ─────────────────────────────────────────────── */
  let frame = 0;
  let lastTime = 0;
  let lastScroll = strip.scrollLeft;
  let velocity = 0; // smoothed, px/ms

  const rest = (): void => {
    frame = 0;
    velocity = 0;
    strip.removeAttribute('data-swaying');
    bodies.forEach((body) => {
      body.angle = 0;
      body.speed = 0;
      body.el.style.removeProperty('rotate');
    });
  };

  const tick = (now: number): void => {
    // Real elapsed time (capped), integrated in fixed sub-steps: frame-rate independent and stable.
    const elapsed = clamp(now - lastTime, 1, 100);
    lastTime = now;

    const x = strip.scrollLeft;
    velocity += ((x - lastScroll) / elapsed - velocity) * (1 - Math.exp(-elapsed / 50));
    lastScroll = x;
    if (Math.abs(velocity) < 0.005) velocity = 0;

    // Content moving left → the rail drags the hooks left → hems trail right (negative angle).
    const target = clamp(-velocity * GAIN, -MAX_ANGLE, MAX_ANGLE);
    let moving = velocity !== 0;
    const steps = Math.ceil(elapsed / STEP_MS);
    const dt = elapsed / steps / 1000;

    bodies.forEach((body) => {
      for (let i = 0; i < steps; i += 1) {
        const acceleration = body.k * (target - body.angle) - DAMPING * body.speed;
        body.speed += acceleration * dt;
        body.angle += body.speed * dt;
      }
      if (Math.abs(body.angle) > 0.03 || Math.abs(body.speed) > 0.08) moving = true;
      body.el.style.rotate = `${body.angle.toFixed(2)}deg`;
    });

    if (moving) frame = requestAnimationFrame(tick);
    else rest();
  };

  const wake = (): void => {
    if (frame || reduceMotion.matches) return;
    lastTime = performance.now();
    lastScroll = strip.scrollLeft;
    strip.setAttribute('data-swaying', '');
    frame = requestAnimationFrame(tick);
  };

  /** Give one shirt (or all) a push, in deg/s. */
  const nudge = (impulse: number, only?: Body): void => {
    if (reduceMotion.matches) return;
    (only ? [only] : bodies).forEach((body) => {
      body.speed += impulse;
    });
    wake();
  };

  strip.addEventListener('scroll', wake, { passive: true });

  // Brushing past with the mouse sets the touched shirt swinging a little.
  let hovered: Body | undefined;
  strip.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || drag) return;
    const swing = (event.target as Element).closest<HTMLElement>('[data-swing]');
    const body = bodies.find((b) => b.el === swing);
    if (body === hovered) return;
    hovered = body;
    if (body) nudge(clamp(-event.movementX * 4, -40, 40), body);
  });
  strip.addEventListener('pointerleave', () => {
    hovered = undefined;
  });

  // Arrival: a single settling swing the first time the rack comes into view (not perpetual).
  const arrival = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      arrival.disconnect();
      if (reduceMotion.matches) return;
      bodies.forEach((body, i) => {
        body.speed += (i % 2 ? -1 : 1) * (24 + (i % 3) * 8);
      });
      nudge(0);
    },
    { threshold: 0.35 },
  );
  arrival.observe(strip);

  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    if (frame) cancelAnimationFrame(frame);
    cancelGlide();
    rest();
  });

  /* ── 2. Mouse drag + inertia ─────────────────────────────── */
  interface Drag {
    id: number;
    startX: number;
    startScroll: number;
    lastX: number;
    lastT: number;
    v: number; // px/ms, pointer
    moved: boolean;
  }
  let drag: Drag | null = null;
  let suppressClick = false;
  let glideFrame = 0;
  let glideV = 0;
  let glideT = 0;

  const cancelGlide = (): void => {
    if (glideFrame) cancelAnimationFrame(glideFrame);
    glideFrame = 0;
  };

  const glide = (now: number): void => {
    const dt = clamp(now - glideT, 1, 50);
    glideT = now;
    const before = strip.scrollLeft;
    strip.scrollLeft = before - glideV * dt;
    glideV *= Math.pow(0.95, dt / 16.7);
    const stuck = Math.abs(strip.scrollLeft - before) < 0.5 && Math.abs(glideV) * dt >= 0.5;
    glideFrame = Math.abs(glideV) > 0.02 && !stuck ? requestAnimationFrame(glide) : 0;
  };

  strip.addEventListener('pointerdown', (event) => {
    suppressClick = false;
    cancelGlide();
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startScroll: strip.scrollLeft,
      lastX: event.clientX,
      lastT: event.timeStamp,
      v: 0,
      moved: false,
    };
  });

  strip.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    // Button released outside the strip before the drag threshold (no capture yet): forget it.
    if (!(event.buttons & 1)) {
      drag = null;
      return;
    }
    const dx = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.moved = true;
      strip.setPointerCapture(event.pointerId);
      strip.setAttribute('data-dragging', '');
    }
    strip.scrollLeft = drag.startScroll - dx;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.v = drag.v * 0.2 + ((event.clientX - drag.lastX) / dt) * 0.8;
    drag.lastX = event.clientX;
    drag.lastT = event.timeStamp;
  });

  const endDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    const { moved, v, lastT } = drag;
    drag = null;
    if (!moved) return;
    suppressClick = true;
    // The swallowed click (if any) fires right after pointerup; never let the flag outlive it.
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
    strip.removeAttribute('data-dragging');
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
    // Fling only if the pointer was still moving at release.
    if (!reduceMotion.matches && event.timeStamp - lastT < 80 && Math.abs(v) > 0.1) {
      glideV = clamp(v, -4, 4);
      glideT = performance.now();
      glideFrame = requestAnimationFrame(glide);
    }
  };
  strip.addEventListener('pointerup', endDrag);
  strip.addEventListener('pointercancel', endDrag);
  strip.addEventListener('lostpointercapture', endDrag);
  strip.addEventListener('dragstart', (event) => event.preventDefault());

  // A drag must not end as a navigation (capture phase: stops home.ts initMorph too).
  strip.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  /* ── 3. Wheel ─────────────────────────────────────────────── */
  let pageWheelAt = 0;
  window.addEventListener(
    'wheel',
    (event) => {
      if (!strip.contains(event.target as Node)) pageWheelAt = event.timeStamp;
    },
    { passive: true },
  );

  strip.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return; // zoom / native sideways
      // The page is mid-scroll and the strip just slid under the cursor: keep scrolling the page.
      if (event.timeStamp - pageWheelAt < WHEEL_GESTURE_GAP) {
        pageWheelAt = event.timeStamp;
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      const delta = event.deltaY * unit;
      const max = strip.scrollWidth - strip.clientWidth;
      if ((delta < 0 && strip.scrollLeft <= 0) || (delta > 0 && strip.scrollLeft >= max - 1)) {
        pageWheelAt = event.timeStamp; // at an end: hand the rest of this gesture to the page
        return;
      }
      event.preventDefault();
      cancelGlide();
      strip.scrollLeft += delta;
    },
    { passive: false },
  );

  /* ── 4. Keyboard ─────────────────────────────────────────── */
  const centre = (link: HTMLAnchorElement): void => {
    const peg = link.closest('li');
    if (!peg) return;
    strip.scrollTo({ left: peg.offsetLeft - (strip.clientWidth - peg.offsetWidth) / 2, behavior: behavior() });
  };

  const firstVisible = (): number => {
    const { left } = strip.getBoundingClientRect();
    const index = links.findIndex((link) => link.getBoundingClientRect().right > left + 8);
    return Math.max(index, 0);
  };

  strip.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = links.length - 1;
    else if (current === -1) next = firstVisible();
    else next = clamp(current + (event.key === 'ArrowRight' ? 1 : -1), 0, links.length - 1);
    const link = links[next];
    if (!link) return;
    event.preventDefault();
    link.focus({ preventScroll: true });
    centre(link);
  });

  /* ── 5. Warm the back cut-outs ───────────────────────────── */
  let warmed = false;
  const warm = (): void => {
    if (warmed) return;
    warmed = true;
    strip.querySelectorAll<HTMLTemplateElement>('[data-back] > template').forEach((template) => {
      template.replaceWith(template.content.cloneNode(true));
    });
  };
  // Touch can't flip (no hover), so it never pays for the backs.
  if (canHover.matches) {
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        near.disconnect();
        warm();
      },
      { rootMargin: '0px 0px 25% 0px' },
    );
    near.observe(strip);
    strip.addEventListener('focusin', warm, { once: true });
  }
};
