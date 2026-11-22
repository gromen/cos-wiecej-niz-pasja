/**
 * Quick filters – glue between the quick-chip rail and the real runtime.
 * collection.ts stays the single source of truth: the quick chips are aria-pressed buttons
 * that flip the real checkboxes (in the „Wszystkie filtry” dialog) and fire one `input`
 * event, so filtering, URL sync, counts, badge and the live region all come from there.
 * This file only mirrors that state back onto the chips, opens / closes the dialog and
 * drives the rail's edge fades + desktop arrows. Import it AFTER collection.ts.
 */

const root = document.querySelector<HTMLElement>('[data-collection]');
const form = document.querySelector<HTMLFormElement>('[data-form]');
const sheet = document.querySelector<HTMLDialogElement>('[data-sheet]');
const openButton = document.querySelector<HTMLButtonElement>('[data-c-open]');
const scroller = document.querySelector<HTMLElement>('[data-c-scroller]');
const rail = document.querySelector<HTMLElement>('[data-c-rail]');

if (root && form && sheet && openButton && scroller && rail) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sortBox = document.querySelector<HTMLElement>('[data-c-sort]');
  const sortValue = document.querySelector<HTMLElement>('[data-c-sort-value]');
  const sortSelect = form.elements.namedItem('sort');

  const checkbox = (name: string, value: string): HTMLInputElement | undefined =>
    [...form.elements].find(
      (el): el is HTMLInputElement =>
        el instanceof HTMLInputElement && el.type === 'checkbox' && el.name === name && el.value === value,
    );

  /** Count key used by collection.ts: `era:2000`, or bare `signed` / `described`. */
  const countKey = (name: string, value: string): string =>
    name === 'signed' || name === 'described' ? name : `${name}:${value}`;

  const quick = [...scroller.querySelectorAll<HTMLButtonElement>('[data-c-quick]')].map((button) => {
    const pairs = JSON.parse(button.dataset.cQuick ?? '[]') as [string, string][];
    return {
      button,
      inputs: pairs.map(([name, value]) => checkbox(name, value)).filter((el): el is HTMLInputElement => !!el),
      counts: pairs
        .map(([name, value]) => root.querySelector<HTMLElement>(`[data-facet-count="${countKey(name, value)}"]`))
        .filter((el): el is HTMLElement => !!el),
    };
  });

  /** Mirror the form onto the rail: pressed state, empty (0 results) hint, sort label. */
  const sync = (): void => {
    quick.forEach(({ button, inputs, counts }) => {
      const pressed = inputs.length > 0 && inputs.every((input) => input.checked);
      button.setAttribute('aria-pressed', String(pressed));
      const sum = counts.reduce((total, el) => total + Number(el.textContent ?? 0), 0);
      button.toggleAttribute('data-empty', counts.length > 0 && sum === 0);
    });
    if (sortSelect instanceof HTMLSelectElement) {
      if (sortValue) sortValue.textContent = sortSelect.selectedOptions[0]?.textContent ?? '';
      sortBox?.toggleAttribute('data-sorted', sortSelect.selectedIndex > 0);
    }
  };

  quick.forEach(({ button, inputs }) =>
    button.addEventListener('click', () => {
      const [first] = inputs;
      if (!first) return;
      // Multi-value chip („lata 70/80”): partially on counts as off → switch all on.
      const next = !inputs.every((input) => input.checked);
      inputs.forEach((input) => {
        input.checked = next;
      });
      // collection.ts listens for `input` on the page root and re-reads the whole form.
      first.dispatchEvent(new Event('input', { bubbles: true }));
      sync();
    }),
  );

  // Changes made in the dialog / the sort select (collection.ts handles them on the root
  // first – document-level bubbling runs after it, so counts are already fresh here).
  document.addEventListener('input', sync);

  // „Wyczyść” buttons: collection.ts resets the form in the button's own handler.
  document.addEventListener('click', (event) => {
    const reset = event.target instanceof Element ? event.target.closest('[data-reset]') : null;
    if (!reset) return;
    sync();
    // The rail's own „Wyczyść” hides itself; focusing the search field instead would pop
    // the keyboard on phones (and unfold the search). Stay on the rail, scrolled to its start.
    if (rail.contains(reset)) {
      scroller.scrollTo({ left: 0, behavior: 'instant' });
      quick[0]?.button.focus({ preventScroll: true });
    }
  });

  /* ——— Dialog: open, Esc / backdrop (native + closedby), focus return ——— */

  openButton.addEventListener('click', () => {
    sync();
    sheet.showModal();
  });

  sheet.addEventListener('close', () => {
    openButton.focus({ preventScroll: true });
    sync();
  });

  /* ——— Rail: edge fades while more chips hide that way; arrows page through ——— */

  const prev = document.querySelector<HTMLButtonElement>('[data-c-prev]');
  const next = document.querySelector<HTMLButtonElement>('[data-c-next]');

  const markEdges = (): void => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    scroller.toggleAttribute('data-more-start', scroller.scrollLeft > 1);
    scroller.toggleAttribute('data-more-end', max - scroller.scrollLeft > 1);
  };

  const page = (direction: 1 | -1): void => {
    scroller.scrollBy({
      left: direction * scroller.clientWidth * 0.7,
      behavior: reduceMotion.matches ? 'instant' : 'smooth',
    });
  };

  prev?.addEventListener('click', () => page(-1));
  next?.addEventListener('click', () => page(1));
  scroller.addEventListener('scroll', markEdges, { passive: true });
  new ResizeObserver(markEdges).observe(scroller);

  // collection.ts has already restored the form from the URL (it is imported first).
  sync();
  // A view restored from the URL: bring the first picked chip into sight (no animation).
  // The scroller is `position: relative`, so `offsetLeft` is measured from its padding edge
  // (content coordinates, already including the scrolled-away part).
  const picked = quick.find(({ button }) => button.getAttribute('aria-pressed') === 'true')?.button;
  if (picked && picked.offsetLeft + picked.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
    scroller.scrollTo({ left: picked.offsetLeft - 16, behavior: 'instant' });
  }
  markEdges();
}

export {};
