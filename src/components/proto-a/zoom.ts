interface ZoomElements {
  scene: HTMLElement;
  pin: HTMLElement;
  stage: HTMLElement;
  wall: HTMLElement;
  target: HTMLElement;
  vignette: HTMLElement;
  handoff: HTMLElement;
  fading: HTMLElement[];
}

const MAX_SCALE = 4.4;
/** Share of the pinned scroll distance spent zooming; the rest is a hold. */
const ZOOM_SHARE = 0.78;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Pinned "camera" zoom into one shirt. The wall is scaled with an inline
 * transform (origin 0 0) so only one element is touched per frame.
 * The scene is `position: sticky` in CSS; here we map scroll distance → progress.
 */
export const initZoom = ({ scene, pin, stage, wall, target, vignette, handoff, fading }: ZoomElements): void => {
  let tx = 0;
  let ty = 0;
  let scale = 1;
  let range = 1;
  let ticking = false;
  let zoomed = false;

  const measure = () => {
    const pw = pin.clientWidth;
    const ph = pin.clientHeight;
    const cx = target.offsetLeft + target.offsetWidth / 2;
    const cy = target.offsetTop + target.offsetHeight / 2;
    const wallX = wall.offsetLeft - stage.scrollLeft;
    const wallY = wall.offsetTop;
    scale = Math.max(1.5, Math.min(MAX_SCALE, (ph * 0.46) / target.offsetHeight, (pw * 0.62) / target.offsetWidth));
    tx = pw / 2 - wallX - scale * cx;
    ty = ph * 0.46 - wallY - scale * cy;
    range = Math.max(1, scene.offsetHeight - ph);
  };

  const render = () => {
    ticking = false;
    const p = clamp(-scene.getBoundingClientRect().top / range);
    if (p <= 0.001) measure(); // stage may have been panned – re-aim while idle
    const z = easeInOut(clamp(p / ZOOM_SHARE));
    wall.style.transform = z > 0 ? `translate3d(${tx * z}px, ${ty * z}px, 0) scale(${1 + (scale - 1) * z})` : '';
    vignette.style.opacity = String(smooth(0.25, 0.75, p));
    handoff.style.opacity = String(smooth(0.62, 0.86, p));
    const ui = String(1 - smooth(0, 0.22, p));
    fading.forEach((el) => (el.style.opacity = ui));

    const next = p > 0.01;
    if (next !== zoomed) {
      zoomed = next;
      pin.toggleAttribute('data-zoomed', zoomed);
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  };

  // Keyboard users tabbing back into the wall get the wall back.
  stage.addEventListener('focusin', () => {
    if (zoomed) window.scrollTo({ top: scene.offsetTop, behavior: 'instant' });
  });

  new ResizeObserver(() => {
    measure();
    render();
  }).observe(pin);

  window.addEventListener('scroll', onScroll, { passive: true });
  measure();
  render();
};
