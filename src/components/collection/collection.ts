/**
 * Collection page runtime – client-side filtering over server-rendered cards.
 *
 *  - State lives in the form controls; the URL query mirrors it (history.replaceState),
 *    so a reload / shared link / back from a detail page restores the same view.
 *  - Each card carries its facets in data-* attributes – no JSON copy of the dataset.
 *  - Chip / toggle / sort changes run inside a same-document view transition (type
 *    „collection-filter”); typing in the search field updates instantly.
 *    During that transition only cards in or near the viewport are named (the rest get
 *    `none` on the shirt and no card name), so the browser never snapshots all 87 cards;
 *    afterwards every shirt gets its static name back (the detail-page morph needs it).
 *  - Photo cards keep their back in a <template>: it is cloned on first hover / focus /
 *    flip tap, and the card flips only once that image has decoded.
 *  - Changes made in the „Wszystkie filtry” <dialog> are applied (with the transition) once
 *    it has closed.
 */
import { matchesTokens, plural, tokenize } from './search';
import type { ClientStrings } from './strings';

type Group = 'era' | 'kind' | 'color' | 'status';
type Toggle = 'signed' | 'described';
type Sort = 'newest' | 'number' | 'season';

const GROUPS: readonly Group[] = ['era', 'kind', 'color', 'status'];
const SORTS: readonly Sort[] = ['newest', 'number', 'season'];
const TRANSITION_TYPE = 'collection-filter';

interface Card {
  el: HTMLElement;
  visual: HTMLElement | null;
  vt: string;
  path: string;
  facets: Record<Group, string>;
  signed: boolean;
  draft: boolean;
  number: number;
  season: number | null;
  order: number;
  search: string;
}

interface State {
  q: string;
  tokens: string[];
  sets: Record<Group, Set<string>>;
  signed: boolean;
  described: boolean;
  sort: Sort;
}

/** Minimal typings for APIs newer than the bundled DOM lib. */
interface TransitionLike {
  finished: Promise<void>;
  skipTransition: () => void;
}
type StartTransition = (arg: (() => void) | { update: () => void; types: string[] }) => TransitionLike;
interface SwapEvent extends Event {
  viewTransition?: TransitionLike | null;
  activation?: { entry?: { url?: string } | null } | null;
}

const root = document.querySelector<HTMLElement>('[data-collection]');
const form = document.querySelector<HTMLFormElement>('[data-form]');
const grid = document.querySelector<HTMLElement>('[data-grid]');

if (root && form && grid) {
  const html = document.documentElement;
  const strings = JSON.parse(root.dataset.strings ?? '{}') as ClientStrings;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 48rem)');

  const bar = root.querySelector<HTMLElement>('[data-bar]');
  const results = root.querySelector<HTMLElement>('[data-results]');
  const sheet = root.querySelector<HTMLDialogElement>('[data-sheet]');
  const applyButton = root.querySelector<HTMLButtonElement>('[data-apply]');
  const emptyState = root.querySelector<HTMLElement>('[data-empty-state]');
  const live = root.querySelector<HTMLElement>('[data-live]');
  const activeBadge = root.querySelector<HTMLElement>('[data-active-count]');
  const activeNum = root.querySelector<HTMLElement>('[data-active-num]');
  const searchInput = form.querySelector<HTMLInputElement>('input[name="q"]');
  const countShown = document.querySelectorAll<HTMLElement>('[data-count-shown]');
  const countLabel = document.querySelectorAll<HTMLElement>('[data-count-label]');
  const resetButtons = document.querySelectorAll<HTMLButtonElement>('[data-reset]');
  const facetCounts = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-facet-count]')].map((el) => [el.dataset.facetCount ?? '', el]),
  );

  const cards: Card[] = [...grid.querySelectorAll<HTMLElement>('[data-card]')].map((el) => {
    const visual = el.querySelector<HTMLElement>('[data-vt]');
    const link = el.querySelector<HTMLAnchorElement>('a');
    const { era = '', kind = '', color = '', status = '' } = el.dataset;
    return {
      el,
      visual,
      vt: visual?.dataset.vt ?? '',
      path: link ? new URL(link.href).pathname : '',
      facets: { era, kind, color, status },
      signed: el.dataset.signed === '1',
      draft: el.dataset.draft === '1',
      number: Number(el.dataset.number),
      season: el.dataset.season ? Number(el.dataset.season) : null,
      order: Number(el.dataset.order),
      search: el.dataset.search ?? '',
    };
  });
  const total = cards.length;

  const fill = (template: string, values: Record<string, string | number>): string =>
    template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

  /* ——— State ⇄ form ⇄ URL ——— */

  const readState = (): State => {
    const data = new FormData(form);
    const q = String(data.get('q') ?? '').trim();
    const sort = String(data.get('sort') ?? 'newest') as Sort;
    return {
      q,
      tokens: tokenize(q),
      sets: Object.fromEntries(GROUPS.map((group) => [group, new Set(data.getAll(group).map(String))])) as Record<
        Group,
        Set<string>
      >,
      signed: data.has('signed'),
      described: data.has('described'),
      sort: SORTS.includes(sort) ? sort : 'newest',
    };
  };

  const controls = (name: string): HTMLInputElement[] =>
    [...form.elements].filter(
      (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.name === name && el.type === 'checkbox',
    );

  const writeControls = (params: URLSearchParams): void => {
    if (searchInput) searchInput.value = params.get('q') ?? '';
    GROUPS.forEach((group) => {
      const values = (params.get(group) ?? '').split(',').filter(Boolean);
      controls(group).forEach((input) => {
        input.checked = values.includes(input.value);
      });
    });
    (['signed', 'described'] as const).forEach((name) => {
      controls(name).forEach((input) => {
        input.checked = params.get(name) === '1';
      });
    });
    const select = form.elements.namedItem('sort');
    if (select instanceof HTMLSelectElement) {
      const sort = params.get('sort') ?? 'newest';
      select.value = SORTS.includes(sort as Sort) ? sort : 'newest';
    }
  };

  const toQuery = (state: State): string => {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    GROUPS.forEach((group) => {
      if (state.sets[group].size) params.set(group, [...state.sets[group]].join(','));
    });
    if (state.signed) params.set('signed', '1');
    if (state.described) params.set('described', '1');
    if (state.sort !== 'newest') params.set('sort', state.sort);
    // Keep commas readable in the address bar.
    return params.toString().replace(/%2C/g, ',');
  };

  const syncUrl = (state: State): void => {
    const query = toQuery(state);
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, '', next);
    }
  };

  /* ——— Matching & sorting ——— */

  const matches = (card: Card, state: State, skip?: Group | Toggle): boolean => {
    if (state.tokens.length && !matchesTokens(state.tokens, card.search, card.number)) return false;
    for (const group of GROUPS) {
      const set = state.sets[group];
      // Placeholders (draft) never match a facet chip – except colour, which is known from the wall photo.
      const draftBlocked = card.draft && group !== 'color';
      if (group !== skip && set.size && (draftBlocked || !set.has(card.facets[group]))) return false;
    }
    if (skip !== 'signed' && state.signed && !card.signed) return false;
    if (skip !== 'described' && state.described && card.draft) return false;
    return true;
  };

  const comparators: Record<Sort, (a: Card, b: Card) => number> = {
    newest: (a, b) => a.order - b.order,
    number: (a, b) => a.number - b.number || a.order - b.order,
    season: (a, b) => (b.season ?? -Infinity) - (a.season ?? -Infinity) || a.order - b.order,
  };

  const activeCount = (state: State): number =>
    GROUPS.reduce((sum, group) => sum + state.sets[group].size, 0) + Number(state.signed) + Number(state.described);

  /* ——— UI sync (counts, labels, URL, live region) ——— */

  let announceTimer = 0;

  const announce = (shown: number, filtered: boolean): void => {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      // The sheet's apply button already shows the live count; announce once it has closed.
      if (!live || sheet?.open) return;
      live.textContent = !filtered
        ? fill(strings.statusAll, { total })
        : shown === 0
          ? strings.statusEmpty
          : fill(strings.status, { n: shown, forms: plural(shown, strings.forms), total });
    }, 450);
  };

  const syncUi = (state: State, shown: number, options: { announce: boolean }): void => {
    const active = activeCount(state);
    const filtered = active > 0 || state.tokens.length > 0;

    countShown.forEach((el) => {
      el.textContent = String(filtered ? shown : total);
    });
    countLabel.forEach((el) => {
      el.textContent = filtered ? `${strings.of} ${total}` : plural(total, strings.forms);
    });
    if (activeBadge && activeNum) {
      activeBadge.hidden = active === 0;
      activeNum.textContent = String(active);
    }
    resetButtons.forEach((button) => {
      if (!button.closest('[data-empty-state], [data-sheet]')) button.hidden = !filtered;
    });
    if (applyButton) {
      applyButton.textContent =
        shown === 0 ? strings.applyEmpty : fill(strings.apply, { n: shown, forms: plural(shown, strings.applyForms) });
    }

    // Facet counts: how many results each option would give with the other filters kept.
    GROUPS.forEach((group) => {
      const tally = new Map<string, number>();
      cards.forEach((card) => {
        if ((card.draft && group !== 'color') || !matches(card, state, group)) return;
        tally.set(card.facets[group], (tally.get(card.facets[group]) ?? 0) + 1);
      });
      facetCounts.forEach((el, key) => {
        if (!key.startsWith(`${group}:`)) return;
        const count = tally.get(key.slice(group.length + 1)) ?? 0;
        el.textContent = String(count);
        el.closest('.chip')?.toggleAttribute('data-empty', count === 0);
      });
    });
    (['signed', 'described'] as const).forEach((toggle) => {
      const el = facetCounts.get(toggle);
      if (!el) return;
      const count = cards.filter(
        (card) => matches(card, state, toggle) && (toggle === 'signed' ? card.signed : !card.draft),
      ).length;
      el.textContent = String(count);
    });

    syncUrl(state);
    if (options.announce) announce(shown, filtered);
  };

  /* ——— Rendering ——— */

  const render = (state: State, visible: Set<Card>): void => {
    cards.forEach((card) => {
      card.el.hidden = !visible.has(card);
    });

    const ordered = [...cards].sort(comparators[state.sort]);
    const current = [...grid.children];
    if (ordered.some((card, i) => current[i] !== card.el)) grid.append(...ordered.map((card) => card.el));

    if (emptyState) emptyState.hidden = visible.size > 0;
  };

  /** Keep results in view: if the user is deep in the grid, jump back to its top. */
  const keepGridInView = (): void => {
    if (!results) return;
    const offset = (bar?.offsetHeight ?? 0) + 8;
    const top = results.getBoundingClientRect().top;
    if (top < offset) window.scrollTo({ top: window.scrollY + top - offset, behavior: 'instant' });
  };

  const nearViewport = (card: Card): boolean => {
    if (card.el.hidden) return false;
    const rect = card.el.getBoundingClientRect();
    return rect.bottom > -80 && rect.top < window.innerHeight + 80;
  };

  /** Name only the cards that will actually be seen; everything else stays out of the snapshot. */
  const nameCards = (named: Set<Card>): void => {
    cards.forEach((card) => {
      const on = named.has(card);
      card.el.style.viewTransitionName = on ? `card-${card.vt}` : '';
      if (card.visual) card.visual.style.viewTransitionName = on ? card.vt : 'none';
    });
  };

  const restoreNames = (): void => {
    cards.forEach((card) => {
      card.el.style.viewTransitionName = '';
      if (card.visual) card.visual.style.viewTransitionName = card.vt;
    });
  };

  const startTransition = (update: () => void): TransitionLike | null => {
    const start = (document as Document & { startViewTransition?: StartTransition }).startViewTransition;
    if (!start || reduceMotion.matches || document.visibilityState === 'hidden') return null;
    try {
      return start.call(document, { update, types: [TRANSITION_TYPE] });
    } catch {
      // Chrome 111–124: callback-only signature (no transition types).
      return start.call(document, update);
    }
  };

  let generation = 0;
  let current: TransitionLike | null = null;
  let pending = false;

  const apply = (options: { animate: boolean; announce?: boolean; scroll?: boolean }): void => {
    const state = readState();
    const visible = new Set(cards.filter((card) => matches(card, state)));
    syncUi(state, visible.size, { announce: options.announce ?? true });

    if (sheet?.open) {
      // Phones: keep the grid still behind the sheet; apply once it closes.
      pending = true;
      return;
    }
    pending = false;

    const update = (): void => {
      render(state, visible);
      if (options.scroll !== false) keepGridInView();
    };

    if (!options.animate) {
      update();
      return;
    }

    current?.skipTransition();
    const gen = ++generation;
    nameCards(new Set(cards.filter(nearViewport)));
    const transition = startTransition(() => {
      update();
      nameCards(new Set(cards.filter(nearViewport)));
    });

    if (!transition) {
      restoreNames();
      update();
      return;
    }
    current = transition;
    const done = (): void => {
      if (gen !== generation) return;
      current = null;
      restoreNames();
    };
    transition.finished.then(done, done);
  };

  /* ——— Events ——— */

  let searchTimer = 0;

  // Facet controls live outside the <form> element (linked via the `form` attribute),
  // so their events bubble through the page root, not the form.
  root.addEventListener('input', (event) => {
    const { target } = event;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) || target.form !== form) return;
    if (target === searchInput) {
      window.clearTimeout(searchTimer);
      // Typing: no view transition – a morph per keystroke feels laggy and steals frames.
      searchTimer = window.setTimeout(() => apply({ animate: false }), 180);
      return;
    }
    apply({ animate: true });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    apply({ animate: false });
    if (!desktop.matches) searchInput?.blur();
  });

  const resultsTitle = document.getElementById('results-title');

  resetButtons.forEach((button) =>
    button.addEventListener('click', () => {
      form.reset();
      apply({ animate: true });
      if (button.closest('[data-empty-state]')) {
        // The empty state disappears: land on the results heading (not the search field –
        // that would pop the iOS keyboard over the freshly restored grid).
        resultsTitle?.focus({ preventScroll: true });
      } else if (button.hidden && !button.closest('[data-c-rail]')) {
        // A „Wyczyść” that hides itself once nothing is filtered – don't strand focus on it.
        // (The rail's own button is handled by quick-filters.ts, which keeps focus on the rail.)
        searchInput?.focus({ preventScroll: true });
      }
    }),
  );

  /* ——— „Wszystkie filtry” dialog (opened by quick-filters.ts) ——— */

  root.querySelectorAll<HTMLButtonElement>('[data-sheet-close]').forEach((button) =>
    button.addEventListener('click', () => sheet?.close()),
  );

  // Backdrop click (fallback for browsers without `closedby`).
  sheet?.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close();
  });

  const SHEET_SETTLE = 650; // ms (> --dur 450ms) – never wait longer for the slide-out to report finished

  sheet?.addEventListener('close', () => {
    // Let the sheet slide away first – a transition starting under it would freeze it
    // mid-air. Then apply whatever was changed in it.
    requestAnimationFrame(() => {
      const finished = Promise.allSettled(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));
      const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, SHEET_SETTLE));
      Promise.race([finished, timeout]).then(() => {
        if (sheet.open) return;
        if (pending) apply({ animate: true });
      });
    });
  });

  desktop.addEventListener('change', () => {
    if (desktop.matches) sheet?.close();
  });

  /* ——— Cross-document transition to a detail page ——— */

  let staleTimer = 0;

  /** Back to the resting state: static names on every shirt, hover effects on. */
  const resetLeaving = (): void => {
    window.clearTimeout(staleTimer);
    delete html.dataset.leaving;
    restoreNames();
  };

  /** Only the shirt we are leaving for keeps its shared name; the other 85 stay out of the snapshot. */
  const nameLeaving = (target: string | null): void => {
    current?.skipTransition();
    cards.forEach((card) => {
      card.el.style.viewTransitionName = '';
      if (card.visual) card.visual.style.viewTransitionName = card.path === target ? card.vt : 'none';
    });
    html.dataset.leaving = '';
    // Still on this page a while later → the navigation was aborted (stop, error, new tab…).
    // Timers are frozen while the page sits in bfcache, so this never fires during the swap.
    // Only needed without `pageswap` – with it, `pageshow` handles the bfcache return.
    window.clearTimeout(staleTimer);
    if (!('pageswap' in window)) staleTimer = window.setTimeout(resetLeaving, 4000);
  };

  // Browsers without `pageswap` (but with cross-document transitions) – name the clicked card
  // as early as possible. Plain left clicks only: modified clicks open a new tab/window.
  grid.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target || link.origin !== location.origin) return;
      // Decide once the event has finished bubbling, so other handlers can still cancel it.
      window.addEventListener(
        'click',
        (late) => {
          if (late === event && !event.defaultPrevented) nameLeaving(link.pathname);
        },
        { once: true },
      );
    },
    { capture: true },
  );

  window.addEventListener('pageswap', (event) => {
    const { viewTransition, activation } = event as SwapEvent;
    if (!viewTransition) {
      // Navigating without a transition – nothing to prepare (and nothing left behind).
      resetLeaving();
      return;
    }
    nameLeaving(activation?.entry?.url ? new URL(activation.entry.url).pathname : null);
  });

  // Back/forward cache restore: never keep a half-prepared exit. (A fresh load has nothing
  // to undo – and resetting there could rename shirts during an incoming transition.)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted || html.dataset.leaving !== undefined) resetLeaving();
  });

  /* ——— Lazy backs: clone the back photo on first intent, flip once it has decoded ——— */

  const BACK_FALLBACK = 400; // ms – flip anyway if decode() is slow (or never settles)

  const armBack = (card: Element | null | undefined): void => {
    const face = card?.querySelector<HTMLElement>('[data-back-pending]');
    const template = face?.querySelector<HTMLTemplateElement>('template[data-back]');
    if (!face || !template) return;
    face.append(template.content.cloneNode(true));
    template.remove();
    let timer = 0;
    const ready = (): void => {
      window.clearTimeout(timer);
      face.removeAttribute('data-back-pending');
    };
    timer = window.setTimeout(ready, BACK_FALLBACK);
    const img = face.querySelector('img');
    if (img) img.decode().then(ready, ready);
    else ready();
  };

  // `pointerover` bubbles (pointerenter does not) – one delegated listener for the grid.
  // Touch only arms from the flip button: a tap elsewhere navigates to the detail page.
  grid.addEventListener('pointerover', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.pointerType === 'touch' && !event.target.closest('[data-card-flip]')) return;
    armBack(event.target.closest('[data-card]'));
  });
  grid.addEventListener('focusin', (event) => {
    if (event.target instanceof Element) armBack(event.target.closest('[data-card]'));
  });

  /* ——— Touch flip: the small ↻ button on photo cards shows the back ——— */

  grid.querySelectorAll<HTMLButtonElement>('[data-card-flip]').forEach((button) => {
    button.hidden = false;
  });
  grid.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-card-flip]') : null;
    const card = button?.closest<HTMLElement>('[data-card]');
    if (!button || !card) return;
    armBack(card);
    const flipped = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(flipped));
    card.toggleAttribute('data-flipped', flipped);
  });

  /* ——— Init: restore from the URL ——— */

  try {
    writeControls(new URLSearchParams(location.search));
    apply({ animate: false, announce: false, scroll: false });
  } finally {
    delete html.dataset.restore;
  }
}
