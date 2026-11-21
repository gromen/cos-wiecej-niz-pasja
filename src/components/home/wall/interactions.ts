/**
 * Client behaviour of the „Ściana” section:
 * - roving tabindex over the hotspot links (one tab stop, arrow keys move in the row/col grid),
 * - touch: first tap shows the label, second tap on the same shirt follows the link,
 * - pannable stage (narrow screens): centred on load, „Przesuń” hint dismissed after a real pan.
 */

type Spot = HTMLAnchorElement;

const TOUCHY = new Set(['touch', 'pen']);
/** Scroll offsets differing by less than this are rounding noise, not a pan. */
const PAN_TOLERANCE = 2;

const initGrid = (box: HTMLElement, spots: Spot[]) => {
  const rows = new Map<number, Spot[]>();
  spots.forEach((s) => {
    const r = Number(s.dataset.row);
    rows.set(r, [...(rows.get(r) ?? []), s]);
  });
  const rowKeys = [...rows.keys()].sort((a, b) => a - b);
  const xOf = (s: Spot) => Number(s.dataset.x);

  let current = spots.find((s) => s.tabIndex === 0) ?? spots[0];
  let active: Spot | null = null;

  const setCurrent = (next: Spot, focus: boolean) => {
    if (next !== current) {
      current.tabIndex = -1;
      next.tabIndex = 0;
      current = next;
    }
    if (focus) next.focus();
  };

  const setActive = (next: Spot | null) => {
    if (active) delete active.dataset.active;
    active = next;
    if (active) {
      active.dataset.active = '';
      setCurrent(active, false);
    }
  };

  const nearestIn = (row: number, x: number): Spot | undefined =>
    rows.get(row)?.reduce((best, s) => (Math.abs(xOf(s) - x) < Math.abs(xOf(best) - x) ? s : best));

  const target = (from: Spot, e: KeyboardEvent): Spot | undefined => {
    const row = Number(from.dataset.row);
    const list = rows.get(row) ?? [];
    const i = list.indexOf(from);
    const r = rowKeys.indexOf(row);
    switch (e.key) {
      case 'ArrowLeft':
        return list[i - 1];
      case 'ArrowRight':
        return list[i + 1];
      case 'ArrowUp':
        return r > 0 ? nearestIn(rowKeys[r - 1], xOf(from)) : undefined;
      case 'ArrowDown':
        return r < rowKeys.length - 1 ? nearestIn(rowKeys[r + 1], xOf(from)) : undefined;
      case 'Home':
        return e.ctrlKey ? spots[0] : list[0];
      case 'End':
        return e.ctrlKey ? spots.at(-1) : list.at(-1);
      default:
        return undefined;
    }
  };

  box.addEventListener('keydown', (e) => {
    const from = (e.target as Element).closest<Spot>('[data-spot]');
    if (!from || e.altKey || e.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = target(from, e);
    if (next) {
      setActive(null);
      setCurrent(next, true);
    }
  });

  // Mouse clicks, programmatic focus, screen-reader focus: keep the single tab stop in sync.
  box.addEventListener('focusin', (e) => {
    const spot = (e.target as Element).closest<Spot>('[data-spot]');
    if (spot) setCurrent(spot, false);
  });

  // Touch: the pointer type is recorded on pointerdown (older engines fire `click` as a plain
  // MouseEvent without it). Not cleared synchronously on pointerup – the click follows it –
  // but dropped on pointercancel (pan / scroll: no click will come) and after every click.
  let pointerType = '';
  const resetPointer = () => {
    pointerType = '';
  };
  box.addEventListener('pointerdown', (e) => {
    pointerType = e.pointerType;
  });
  box.addEventListener('pointercancel', resetPointer);
  box.addEventListener('click', (e) => {
    const spot = (e.target as Element).closest<Spot>('[data-spot]');
    // detail 0 = keyboard / programmatic activation: never touch, whatever was recorded before.
    const type = e.detail === 0 ? '' : (e as PointerEvent).pointerType || pointerType;
    resetPointer();
    if (!spot || !TOUCHY.has(type) || spot === active) return;
    e.preventDefault();
    setActive(spot);
  });

  // Tapping anything but a shirt – outside the wall or on the empty photo – (or Escape) clears the label.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (active && !(e.target instanceof Element && e.target.closest('[data-spot]'))) setActive(null);
    },
    { passive: true },
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) setActive(null);
  });
};

const initPan = (stage: HTMLElement, hint: HTMLElement | null) => {
  let expected = 0;
  let panned = false;

  const centre = () => {
    if (panned) return;
    const room = stage.scrollWidth - stage.clientWidth;
    expected = Math.max(0, room / 2);
    stage.scrollTo({ left: expected, behavior: 'auto' });
    expected = stage.scrollLeft;
    if (hint) hint.hidden = room < 1;
  };

  const onScroll = () => {
    if (Math.abs(stage.scrollLeft - expected) <= PAN_TOLERANCE) return;
    panned = true;
    if (hint) hint.dataset.seen = '';
    stage.removeEventListener('scroll', onScroll);
    observer.disconnect();
  };

  // Re-centre on resize / rotation until the visitor pans on their own.
  const observer = new ResizeObserver(centre);
  observer.observe(stage);
  centre();
  stage.addEventListener('scroll', onScroll, { passive: true });
};

export const initWall = (root: HTMLElement): void => {
  const stage = root.querySelector<HTMLElement>('[data-stage]');
  const box = root.querySelector<HTMLElement>('[data-spots]');
  const spots = Array.from(root.querySelectorAll<Spot>('[data-spot]'));
  if (!stage || !box || spots.length === 0) return;

  initGrid(box, spots);
  initPan(stage, root.querySelector<HTMLElement>('[data-hint]'));
};
