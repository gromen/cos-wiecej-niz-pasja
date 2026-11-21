/**
 * Trybuna – tiny runtime. Everything visual is CSS; JS only handles
 *  1. `.is-in` flag for the time-based fallbacks (browsers without scroll-driven animations),
 *  2. pausing marquees while off-screen or on user request (WCAG 2.2.2 toggle),
 *  3. scroll-velocity reaction of the marquees.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const initReveal = (): void => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 },
  );
  targets.forEach((target) => observer.observe(target));
};

const initMarquees = (): void => {
  const marquees = [...document.querySelectorAll<HTMLElement>('[data-marquee]')].flatMap((band) => {
    const animation = band.querySelector('.track')?.getAnimations()[0];
    return animation ? [{ band, animation }] : [];
  });

  if (marquees.length === 0) return;

  const visible = new Set<Element>();
  let userPaused = false;

  // Single source of truth for play state: on screen AND not paused by the user.
  const sync = (): void => {
    marquees.forEach(({ band, animation }) => {
      if (!userPaused && visible.has(band)) animation.play();
      else animation.pause();
    });
  };

  const visibility = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    },
    { rootMargin: '120px 0px' },
  );

  marquees.forEach(({ band }) => visibility.observe(band));

  // Speed up while scrolling down, slow down while scrolling up; ease back to 1x at rest.
  // One time base (performance.now) for both the scroll handler and the frame loop – mixing it
  // with the rAF timestamp (which can predate the scroll event) produced negative deltas → spikes.
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let boost = 0;
  let rate = 1;
  let frame = 0;

  const setRate = (next: number): void => {
    if (Math.abs(next - rate) < 0.005) return;
    rate = next;
    marquees.forEach(({ animation }) => animation.updatePlaybackRate(rate));
  };

  const stop = (): void => {
    frame = 0;
    boost = 0;
    if (rate !== 1) {
      rate = 1;
      marquees.forEach(({ animation }) => animation.updatePlaybackRate(1));
    }
  };

  const tick = (): void => {
    if (userPaused) {
      stop();
      return;
    }

    const now = performance.now();
    const y = window.scrollY;
    const velocity = (y - lastY) / Math.max(now - lastTime, 1); // px/ms, signed
    lastY = y;
    lastTime = now;

    boost += (clamp(velocity * 1.5, -0.7, 3) - boost) * 0.12;
    setRate(1 + boost);

    if (Math.abs(boost) > 0.01 || Math.abs(velocity) > 0.01) frame = requestAnimationFrame(tick);
    else stop();
  };

  window.addEventListener(
    'scroll',
    () => {
      if (frame || userPaused) return;
      lastY = window.scrollY;
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    },
    { passive: true },
  );

  // WCAG 2.2.2 pause/play toggle – only shown when the marquees actually move.
  const toggle = document.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
  if (!toggle) return;

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    if (userPaused && frame) {
      cancelAnimationFrame(frame);
      stop();
    }
    sync();
  });
};

initReveal();
if (!reduceMotion.matches) initMarquees();
