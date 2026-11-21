/**
 * Fullscreen viewer for the original Instagram photos (Originals.astro).
 *
 *  - Thumbnail → showModal(); close button / Esc → close, focus back on the thumbnail.
 *  - ←/→ keys, the arrow buttons or a horizontal swipe (when not zoomed) change the photo.
 *  - Zoom: two-finger pinch, double-tap / double-click (one pointer-based detector for every
 *    input – no `dblclick`, which would toggle a second time), ctrl+wheel (also trackpad pinch);
 *    drag or plain wheel pans while zoomed.
 *    The stage has `touch-action: none`, the gesture is one `translate() scale()` transform.
 *  - No showModal() (old Safari): the thumbnail opens the large photo in a new tab instead.
 */

interface Point {
  x: number;
  y: number;
}

const MAX_SCALE = 4;
const TAP_SCALE = 2.5;
const SWIPE = 60;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export const setupOriginals = (): void => {
  const root = document.querySelector<HTMLElement>('[data-originals]');
  const dialog = root?.querySelector<HTMLDialogElement>('[data-viewer]');
  const stage = dialog?.querySelector<HTMLElement>('[data-viewer-stage]');
  if (!root || !dialog || !stage) return;

  const slides = [...dialog.querySelectorAll<HTMLElement>('[data-slide]')];
  const counter = dialog.querySelector<HTMLElement>('[data-viewer-index]');
  let current = 0;
  let opener: HTMLElement | null = null;

  /* ——— zoom state ——— */
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const pointers = new Map<number, Point>();
  let pinch: { dist: number; scale: number; local: Point } | null = null;
  let pan: { start: Point; tx: number; ty: number; moved: boolean } | null = null;
  let lastTap: { t: number; p: Point } | null = null;

  const zoomEl = (): HTMLElement | null => slides[current]?.querySelector<HTMLElement>('[data-zoom]') ?? null;

  const clampPan = (el: HTMLElement): void => {
    const maxX = ((scale - 1) * el.offsetWidth) / 2;
    const maxY = ((scale - 1) * el.offsetHeight) / 2;
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  };

  const apply = (animate = false): void => {
    const el = zoomEl();
    if (!el) return;
    clampPan(el);
    el.classList.toggle('is-animating', animate && !reduceMotion.matches);
    el.classList.toggle('is-zoomed', scale > 1);
    el.style.transform = scale === 1 ? '' : `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  };

  const resetZoom = (): void => {
    scale = 1;
    tx = 0;
    ty = 0;
    pinch = null;
    pan = null;
    pointers.clear();
    slides.forEach((slide) => {
      const el = slide.querySelector<HTMLElement>('[data-zoom]');
      if (!el) return;
      el.style.transform = '';
      el.classList.remove('is-zoomed', 'is-dragging', 'is-animating');
    });
  };

  /** Element centre in viewport coordinates (layout box, transform ignored). */
  const centreOf = (el: HTMLElement): Point => {
    const rect = el.getBoundingClientRect();
    // getBoundingClientRect includes the transform → undo it to get the layout centre.
    return { x: rect.left + rect.width / 2 - tx, y: rect.top + rect.height / 2 - ty };
  };

  /** Zoom to `next` keeping the viewport point `p` fixed. */
  const zoomAt = (p: Point, next: number, animate: boolean): void => {
    const el = zoomEl();
    if (!el) return;
    const c = centreOf(el);
    const local = { x: (p.x - c.x - tx) / scale, y: (p.y - c.y - ty) / scale };
    scale = Math.max(1, Math.min(MAX_SCALE, next));
    tx = p.x - c.x - scale * local.x;
    ty = p.y - c.y - scale * local.y;
    apply(animate);
  };

  const toggleZoom = (p: Point): void => {
    if (scale > 1) {
      scale = 1;
      tx = 0;
      ty = 0;
      apply(true);
    } else {
      zoomAt(p, TAP_SCALE, true);
    }
  };

  /* ——— photos ——— */
  const show = (index: number): void => {
    resetZoom();
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
    });
    if (counter) counter.textContent = String(current + 1);
  };

  const step = (delta: number): void => {
    if (slides.length > 1) show(current + delta);
  };

  /* ——— scroll lock ———
   * `overflow: hidden` on :root (CSS, Originals.astro) works from iOS 16; older iOS keeps
   * scrolling the page behind, so pin <body> there – same approach (and feature proxy) as SiteHeader. */
  const needsBodyLock = !CSS.supports('overscroll-behavior', 'contain');
  let lockedY = 0;

  const lockScroll = (): void => {
    if (!needsBodyLock) return;
    lockedY = scrollY;
    Object.assign(document.body.style, {
      position: 'fixed',
      insetBlockStart: `-${lockedY}px`,
      insetInline: '0',
      overflow: 'hidden',
    });
  };

  const unlockScroll = (): void => {
    if (!needsBodyLock) return;
    const { style } = document.body;
    style.removeProperty('position');
    style.removeProperty('inset-block-start');
    style.removeProperty('inset-inline');
    style.removeProperty('overflow');
    scrollTo({ top: lockedY, behavior: 'instant' });
  };

  /** Largest rendition of a slide (last `srcset` candidate of the fallback <img>). */
  const largestOf = (index: number): string | null => {
    const img = slides[index]?.querySelector('img');
    if (!img) return null;
    // No `.at()`: this path only runs on old Safari (< 15.4).
    const candidates = (img.getAttribute('srcset') ?? '').split(',');
    const last = candidates[candidates.length - 1]?.trim().split(/\s+/)[0];
    return last || img.getAttribute('src');
  };

  const canModal = typeof dialog.showModal === 'function';

  root.querySelectorAll<HTMLButtonElement>('[data-original-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.originalOpen) || 0;
      if (!canModal) {
        const url = largestOf(index);
        if (url) window.open(new URL(url, location.href).href, '_blank', 'noopener');
        return;
      }
      opener = button;
      show(index);
      dialog.showModal();
      lockScroll();
      dialog.querySelector<HTMLButtonElement>('[data-viewer-close]')?.focus();
    });
  });

  if (!canModal) return;

  dialog.querySelector('[data-viewer-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-viewer-prev]')?.addEventListener('click', () => step(-1));
  dialog.querySelector('[data-viewer-next]')?.addEventListener('click', () => step(1));

  dialog.addEventListener('close', () => {
    resetZoom();
    unlockScroll();
    opener?.focus();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      '+': () => zoomAt(centreOf(zoomEl() ?? stage), scale * 1.5, true),
      '=': () => zoomAt(centreOf(zoomEl() ?? stage), scale * 1.5, true),
      '-': () => zoomAt(centreOf(zoomEl() ?? stage), scale / 1.5, true),
      '0': () => toggleZoom(centreOf(zoomEl() ?? stage)),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  /* ——— gestures ——— */
  const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  stage.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone (e.g. lifted before the handler ran) – nothing to capture.
    }
    const el = zoomEl();
    if (!el) return;

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      const m = midpoint(a, b);
      const c = centreOf(el);
      pinch = {
        dist: distance(a, b) || 1,
        scale,
        local: { x: (m.x - c.x - tx) / scale, y: (m.y - c.y - ty) / scale },
      };
      pan = null;
    } else if (pointers.size === 1) {
      pan = { start: { x: event.clientX, y: event.clientY }, tx, ty, moved: false };
    }
    el.classList.remove('is-animating');
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const el = zoomEl();
    if (!el) return;

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      const m = midpoint(a, b);
      // Centre with the current translate removed (centreOf subtracts tx/ty).
      const c = centreOf(el);
      scale = Math.max(1, Math.min(MAX_SCALE, (pinch.scale * distance(a, b)) / pinch.dist));
      tx = m.x - c.x - scale * pinch.local.x;
      ty = m.y - c.y - scale * pinch.local.y;
      apply();
      return;
    }

    if (pan) {
      const dx = event.clientX - pan.start.x;
      const dy = event.clientY - pan.start.y;
      if (Math.hypot(dx, dy) > 8) pan.moved = true;
      if (scale > 1 && pan.moved) {
        el.classList.add('is-dragging');
        tx = pan.tx + dx;
        ty = pan.ty + dy;
        apply();
      }
    }
  });

  const release = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    zoomEl()?.classList.remove('is-dragging');

    if (pinch) {
      // Lifting one finger of a pinch ends it; the other one does not start a pan/swipe.
      if (pointers.size < 2) pinch = null;
      pan = null;
      lastTap = null;
      return;
    }
    if (!pan || event.type === 'pointercancel') {
      pan = null;
      return;
    }

    const dx = event.clientX - pan.start.x;
    const dy = event.clientY - pan.start.y;
    const wasTap = !pan.moved;
    pan = null;

    if (scale === 1 && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
      lastTap = null;
      return;
    }

    // Double-tap / double-click – the only double-activation path (no `dblclick` listener).
    if (wasTap) {
      const p = { x: event.clientX, y: event.clientY };
      if (lastTap && event.timeStamp - lastTap.t < 320 && distance(lastTap.p, p) < 30) {
        lastTap = null;
        toggleZoom(p);
      } else {
        lastTap = { t: event.timeStamp, p };
      }
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // ctrl+wheel (and trackpad pinch, which arrives as one) zooms; a plain wheel pans while
  // zoomed and is left alone otherwise.
  stage.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
        zoomAt({ x: event.clientX, y: event.clientY }, scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), false);
        return;
      }
      if (scale === 1) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
      tx -= event.deltaX * unit;
      ty -= event.deltaY * unit;
      apply();
    },
    { passive: false },
  );
};
