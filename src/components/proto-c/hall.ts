/**
 * Exhibit hall behaviour. Everything visual is CSS; this module only
 *  1. writes pointer / tilt / drift into --mx, --my (rAF, eased),
 *  2. measures the landing transform (--dx, --dy, --s) of the exhibit → first case,
 *  3. drives --p (scroll progress) when CSS scroll-driven animations are missing,
 *  4. wires the flip button.
 */

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Layout box relative to `root`, ignoring transforms and scroll offsets. */
const boxWithin = (el: HTMLElement, root: HTMLElement): Box => {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
};

const setupFlip = (stage: HTMLElement): void => {
  const button = stage.querySelector<HTMLButtonElement>('[data-flip]');
  if (!button) return;
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(next));
    button.setAttribute('aria-label', next ? 'Pokaż przód koszulki' : 'Pokaż tył koszulki');
    stage.dataset.flipped = String(next);
  });
};

const setupLanding = (stage: HTMLElement): void => {
  const fly = stage.querySelector<HTMLElement>('[data-fly]');
  const target = stage.querySelector<HTMLElement>('[data-case-slot]');
  if (!fly || !target) return;

  const measure = (): void => {
    const from = boxWithin(fly, stage);
    const to = boxWithin(target, stage);
    const dx = to.x + to.w / 2 - (from.x + from.w / 2);
    const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    const scale = Math.min(to.w / from.w, to.h / from.h) * 0.88;
    stage.style.setProperty('--dx', dx.toFixed(1));
    stage.style.setProperty('--dy', dy.toFixed(1));
    stage.style.setProperty('--s', scale.toFixed(4));
  };

  measure();
  new ResizeObserver(measure).observe(stage);
  void document.fonts.ready.then(measure);
};

/** Fallback for browsers without scroll-driven animations. */
const setupScrollFallback = (stage: HTMLElement): void => {
  if (CSS.supports('animation-timeline: scroll()')) return;
  const runway = stage.parentElement;
  if (!runway) return;

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const range = Math.max(1, runway.offsetHeight - stage.offsetHeight);
    stage.style.setProperty('--p', clamp(window.scrollY / range, 0, 1).toFixed(4));
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
};

const setupLight = (stage: HTMLElement): void => {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let drifting = coarse;
  let visible = true;
  let frame = 0;

  const tick = (now: number): void => {
    frame = 0;
    if (!visible) return;
    if (drifting) {
      tx = Math.sin(now / 2600) * 0.7;
      ty = Math.cos(now / 3400) * 0.45;
    }
    x += (tx - x) * 0.09;
    y += (ty - y) * 0.09;
    stage.style.setProperty('--mx', x.toFixed(3));
    stage.style.setProperty('--my', y.toFixed(3));
    if (drifting || Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) schedule();
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  stage.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      drifting = false;
      tx = (event.clientX / window.innerWidth) * 2 - 1;
      ty = (event.clientY / window.innerHeight) * 2 - 1;
      schedule();
    },
    { passive: true },
  );
  stage.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    tx = 0;
    ty = 0;
    schedule();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) schedule();
  }).observe(stage);

  if (coarse) {
    // iOS needs a user-gesture permission prompt – never trigger it automatically.
    const needsPermission = 'DeviceOrientationEvent' in window && 'requestPermission' in DeviceOrientationEvent;
    if ('DeviceOrientationEvent' in window && !needsPermission) {
      window.addEventListener(
        'deviceorientation',
        (event) => {
          if (event.gamma === null || event.beta === null) return;
          drifting = false;
          tx = clamp(event.gamma / 25, -1, 1);
          ty = clamp((event.beta - 45) / 25, -1, 1);
          schedule();
        },
        { passive: true },
      );
    }
    schedule();
  }
};

export const initHall = (stage: HTMLElement): void => {
  setupFlip(stage);
  if (!document.documentElement.classList.contains('c-motion')) return;
  setupLanding(stage);
  setupScrollFallback(stage);
  setupLight(stage);
};
