/**
 * „Lupa” – circular magnifier over a photo exhibit. OFF by default on every device.
 *
 *  - The „Lupa” button is a real toggle (aria-pressed). On: the lens appears in the middle of
 *    the shirt and follows the pointer (mouse/pen) or the dragging finger (touch,
 *    `touch-action: none` only while on); arrow keys move it wherever focus is (a click on the
 *    shirt focuses the flip button), so the page's ←/→ shirt navigation pauses (`claimed()`).
 *  - Off: the toggle again, Esc, flipping the shirt (the pill) or leaving the page.
 *    Off hides the lens and drops every pointer/key listener (one AbortController).
 *  - While on, a plain click/tap on the shirt only moves the lens (no flip); the flip pill
 *    still flips – and turns the lens off.
 *  - The large rendition (URLs in `data-lens`, [front, back]) is requested only when the toggle
 *    is hovered/focused (prefetch) or the lens opens. Position is transform-only: `translate`
 *    on the circle, `transform` on the image.
 *  - Magnification is capped by the source: never more than it can show sharply at this size
 *    and pixel density (min 1.6×, max 2.2×) – the cut-outs are only 1000 px wide.
 */

interface Source {
  avif: string;
  webp: string;
  /** Intrinsic width (px) of the rendition. */
  width: number;
}

export interface Lens {
  /** True while the lens is on (the page's swipe/arrow navigation must leave it alone). */
  claimed: () => boolean;
}

const MIN_ZOOM = 1.6;
const MAX_ZOOM = 2.2;

const supportsTyped = CSS.supports('background-image', 'image-set(url("x.avif") type("image/avif"))');

export const setupLens = (exhibit: HTMLElement, visibleFace: () => number): Lens | null => {
  const view = exhibit.querySelector<HTMLElement>('[data-lens-view]');
  const img = exhibit.querySelector<HTMLElement>('[data-lens-img]');
  const toggle = exhibit.querySelector<HTMLButtonElement>('[data-lens-toggle]');
  const raw = exhibit.dataset.lens;
  if (!view || !img || !toggle || !raw) return null;

  let sources: Source[];
  try {
    sources = JSON.parse(raw) as Source[];
  } catch {
    return null;
  }

  let on = false;
  let session: AbortController | null = null;
  let box: DOMRect | null = null;
  let diameter = 0;
  let face = -1;
  let x = 0.5;
  let y = 0.42;
  let frame = 0;
  let zoom = MIN_ZOOM;

  const measure = (): DOMRect => {
    if (box) return box;
    box = exhibit.getBoundingClientRect();
    diameter = view.offsetWidth;
    // Sharpest magnification the source allows at this size / DPR, kept within the range.
    const sourceWidth = Math.min(...sources.map((source) => source.width || Infinity));
    const sharp = sourceWidth / (box.width * devicePixelRatio || 1);
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(sharp) ? sharp : MIN_ZOOM));
    img.style.inlineSize = `${box.width * zoom}px`;
    img.style.blockSize = `${box.height * zoom}px`;
    return box;
  };
  const forget = (): void => {
    box = null;
  };

  const setFace = (): void => {
    const next = visibleFace();
    if (next === face) return;
    face = next;
    const source = sources[face] ?? sources[0];
    if (!source) return;
    img.style.backgroundImage = supportsTyped
      ? `image-set(url("${source.avif}") type("image/avif"), url("${source.webp}") type("image/webp"))`
      : `url("${source.webp}")`;
  };

  /** Warm the cache for the visible face, so the first open is not an empty circle. */
  const prefetched = new Set<Source>();
  const prefetch = (): void => {
    const source = sources[visibleFace()] ?? sources[0];
    if (!source || prefetched.has(source)) return;
    prefetched.add(source);
    const warm = new Image();
    warm.decoding = 'async';
    warm.src = supportsTyped ? source.avif : source.webp;
  };

  const render = (): void => {
    frame = 0;
    if (!on) return;
    const { width, height } = measure();
    const r = diameter / 2;
    setFace();
    view.style.translate = `${(x * width - r).toFixed(1)}px ${(y * height - r).toFixed(1)}px`;
    img.style.transform = `translate(${(r - x * width * zoom).toFixed(1)}px, ${(r - y * height * zoom).toFixed(1)}px)`;
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  const pointAt = (clientX: number, clientY: number): void => {
    const rect = measure();
    x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    schedule();
  };

  const onToggle = (target: EventTarget | null): boolean => target instanceof Node && toggle.contains(target);

  const disable = (): void => {
    if (!on) return;
    on = false;
    session?.abort();
    session = null;
    cancelAnimationFrame(frame);
    frame = 0;
    view.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    exhibit.removeAttribute('data-lens-on');
  };

  const enable = (): void => {
    if (on) return;
    on = true;
    session = new AbortController();
    const { signal } = session;
    x = 0.5;
    y = 0.42;
    forget();
    toggle.setAttribute('aria-pressed', 'true');
    exhibit.setAttribute('data-lens-on', '');
    view.hidden = false;
    schedule();

    const resize = new ResizeObserver(forget);
    resize.observe(exhibit);
    signal.addEventListener('abort', () => resize.disconnect());
    addEventListener('scroll', forget, { passive: true, signal });

    // Mouse/pen: follows the pointer; touch: follows the finger while it is down.
    exhibit.addEventListener(
      'pointermove',
      (event) => {
        if (onToggle(event.target)) return;
        if (event.pointerType === 'touch' && event.buttons === 0) return;
        pointAt(event.clientX, event.clientY);
      },
      { signal },
    );
    exhibit.addEventListener(
      'pointerdown',
      (event) => {
        if (!onToggle(event.target)) pointAt(event.clientX, event.clientY);
      },
      { signal },
    );
    // A click on the shirt only places the lens; the flip pill flips (and switches the lens off).
    exhibit.addEventListener(
      'click',
      (event) => {
        if (onToggle(event.target)) return;
        // The pill, or a keyboard activation of the flip button (detail 0): flip + lens off.
        const pill = event.target instanceof Element && event.target.closest('.pill');
        if (pill || event.detail === 0) {
          disable();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      },
      { capture: true, signal },
    );
    // Document-level: a click on the shirt moves focus to the flip button, and the arrows must
    // still steer the lens (not the page's prev/next – detail.ts checks `claimed()`).
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
            target.closest('[data-local-nav]'))
        ) {
          return;
        }
        const step = event.shiftKey ? 0.12 : 0.04;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault(); // no page scroll either
        x = Math.max(0, Math.min(1, x + move[0]));
        y = Math.max(0, Math.min(1, y + move[1]));
        schedule();
      },
      { signal },
    );
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        disable();
      },
      { signal },
    );
    addEventListener('pagehide', disable, { signal });
  };

  toggle.hidden = false;
  toggle.addEventListener('pointerenter', prefetch);
  toggle.addEventListener('focus', prefetch);
  toggle.addEventListener('click', () => (on ? disable() : enable()));

  return { claimed: () => on };
};
