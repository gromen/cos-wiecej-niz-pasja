/**
 * Proto „Filtry A” – UI layer on top of the real collection.ts runtime.
 *
 * collection.ts still owns filtering, sorting, URL sync, live counts and the sheet's
 * „Pokaż n koszulek” / deferred apply (the sheet carries `data-sheet`). This file only adds:
 *  - popover dropdowns: aria-expanded sync, focus in / Esc back to the pill, JS placement
 *    where CSS anchor positioning is missing, close when focus leaves;
 *  - the phone sheet: moves the four option sets + „Więcej” into its accordions and back;
 *  - per-pill counts („Kolor · 2”), per-group „Wyczyść”, the active-filter tokens row;
 *  - a mirror switch for ★ Autograf inside the sheet.
 * Import it AFTER collection.ts (it reads the state collection.ts restored from the URL).
 */
type Key = 'era' | 'kind' | 'color' | 'status' | 'more';

const GROUPS = ['era', 'kind', 'color', 'status'] as const;
const KEYS: readonly Key[] = [...GROUPS, 'more'];

const root = document.querySelector<HTMLElement>('[data-collection]');
const form = document.querySelector<HTMLFormElement>('[data-form]');
const bar = document.querySelector<HTMLElement>('[data-fa-bar]');

if (root && form && bar) {
  const html = document.documentElement;
  const supportsPopover = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');
  const supportsAnchor = CSS.supports('anchor-name: --fa-x');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 48rem)');
  if (!supportsPopover) html.dataset.faNopop = '';

  const sheet = document.querySelector<HTMLDialogElement>('#fa-sheet');
  const openButton = bar.querySelector<HTMLButtonElement>('[data-fa-sheet-open]');
  const search = form.querySelector<HTMLInputElement>('input[name="q"]');
  const activeRow = document.querySelector<HTMLElement>('[data-fa-active]');
  const tokenList = document.querySelector<HTMLElement>('[data-fa-tokens]');
  const quick = bar.querySelector<HTMLElement>('[data-fa-quick]');
  const proxy = document.querySelector<HTMLInputElement>('[data-fa-proxy="signed"]');
  const proxyCount = document.querySelector<HTMLElement>('[data-fa-proxy-count="signed"]');
  const signedCount = document.querySelector<HTMLElement>('[data-facet-count="signed"]');

  const sets = new Map(KEYS.map((key) => [key, document.querySelector<HTMLElement>(`[data-fa-set="${key}"]`)]));
  const panels = new Map(KEYS.map((key) => [key, document.querySelector<HTMLElement>(`[data-fa-panel="${key}"]`)]));
  const slots = new Map(KEYS.map((key) => [key, document.querySelector<HTMLElement>(`[data-fa-slot="${key}"]`)]));

  const inputs = (name: string): HTMLInputElement[] =>
    [...form.elements].filter(
      (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.name === name && el.type === 'checkbox',
    );
  const signedInput = inputs('signed')[0];
  const describedInput = inputs('described')[0];

  /** Let collection.ts see a programmatic change (it listens for bubbling `input` on the root). */
  const notify = (input: HTMLInputElement): void => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /* ——— Counts on pills / summaries, group „Wyczyść”, tokens ——— */

  const setBadge = (key: string, n: number): void => {
    document.querySelectorAll<HTMLElement>(`[data-fa-n="${key}"]`).forEach((el) => {
      el.hidden = n === 0;
      el.textContent = n ? `· ${n}` : '';
    });
  };

  const removeLabel = tokenList?.dataset.remove ?? '';

  /** Tokens are rebuilt on every change; only ones that were not there before animate in. */
  let shownKeys = new Set<string>();
  let nextKeys = new Set<string>();

  const makeToken = (key: string, label: string, onRemove: () => void): HTMLLIElement => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fa-token';
    nextKeys.add(key);
    if (!shownKeys.has(key)) button.dataset.new = '';
    button.setAttribute('aria-label', `${removeLabel} ${label}`);
    const text = document.createElement('span');
    text.textContent = label;
    const x = document.createElement('span');
    x.className = 'fa-token__x';
    x.setAttribute('aria-hidden', 'true');
    x.textContent = '×';
    button.append(text, x);
    button.addEventListener('click', () => {
      const index = [...(tokenList?.children ?? [])].indexOf(li);
      onRemove();
      // Keep keyboard users in the row: the next token, else the previous one, else search.
      requestAnimationFrame(() => {
        const buttons = [...(tokenList?.querySelectorAll<HTMLButtonElement>('.fa-token') ?? [])];
        const next = buttons[Math.min(index, buttons.length - 1)];
        (next ?? search)?.focus({ preventScroll: true });
      });
    });
    li.append(button);
    return li;
  };

  const sync = (): void => {
    const tokens: HTMLLIElement[] = [];
    nextKeys = new Set();
    const q = search?.value.trim() ?? '';
    if (q && search) {
      tokens.push(
        makeToken('q', `„${q}”`, () => {
          search.value = '';
          notify(search);
        }),
      );
    }

    GROUPS.forEach((group) => {
      const checked = inputs(group).filter((input) => input.checked);
      setBadge(group, checked.length);
      bar.querySelector(`[data-fa-trigger="${group}"]`)?.toggleAttribute('data-active', checked.length > 0);
      const clear = sets.get(group)?.querySelector<HTMLButtonElement>('[data-fa-clear]');
      if (clear) clear.hidden = checked.length === 0;
      checked.forEach((input) => {
        tokens.push(
          makeToken(`${group}:${input.value}`, input.dataset.faLabel ?? input.value, () => {
            input.checked = false;
            notify(input);
          }),
        );
      });
    });

    const signed = Boolean(signedInput?.checked);
    const described = Boolean(describedInput?.checked);
    setBadge('more', Number(described));
    setBadge('options', Number(signed) + Number(described));
    bar.querySelector('[data-fa-trigger="more"]')?.toggleAttribute('data-active', described);
    if (proxy) proxy.checked = signed;

    [signedInput, describedInput].forEach((input) => {
      if (!input?.checked) return;
      tokens.push(
        makeToken(input.name, input.dataset.faLabel ?? input.name, () => {
          input.checked = false;
          notify(input);
        }),
      );
    });

    tokenList?.replaceChildren(...tokens);
    shownKeys = nextKeys;
    if (activeRow) activeRow.hidden = tokens.length === 0;
  };

  // collection.ts registered its listeners first, so by now its counts are up to date.
  root.addEventListener('input', (event) => {
    const { target } = event;
    if (target instanceof HTMLInputElement && target.form === form) sync();
  });
  // „Wyczyść” buttons: collection.ts resets the form on the button itself; this runs after (bubbling).
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-reset]')) sync();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-fa-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.dataset.faClear ?? '';
      const checked = inputs(group).filter((input) => input.checked);
      checked.forEach((input) => {
        input.checked = false;
      });
      if (checked[0]) notify(checked[0]);
      // The button hides itself – keep focus inside the panel.
      sets.get(group as Key)?.querySelector('input')?.focus({ preventScroll: true });
    });
  });

  /* ——— Sheet mirror for ★ Autograf ——— */

  proxy?.addEventListener('change', () => {
    if (!signedInput) return;
    signedInput.checked = proxy.checked;
    notify(signedInput);
  });
  if (signedCount && proxyCount) {
    const copyCount = (): void => {
      proxyCount.textContent = signedCount.textContent;
    };
    new MutationObserver(copyCount).observe(signedCount, { childList: true, characterData: true, subtree: true });
    copyCount();
  }

  /* ——— Moving option sets between their popover and the sheet ——— */

  const moveSet = (key: Key, target: HTMLElement | null | undefined): void => {
    const set = sets.get(key);
    if (set && target && set.parentElement !== target) target.append(set);
  };
  const homeAll = (): void => KEYS.forEach((key) => moveSet(key, panels.get(key)));

  /* ——— Popovers ——— */

  const place = (panel: HTMLElement, trigger: HTMLElement): void => {
    // Phones hang the panel from the whole bar, wider screens from the pill.
    const rect = (desktop.matches ? trigger : bar).getBoundingClientRect();
    const edge = 16;
    const width = panel.offsetWidth;
    const left = Math.min(Math.max(edge, rect.left), window.innerWidth - width - edge);
    // Phones: the CSS keeps the panel full width between the gutters – only `top` is ours.
    if (desktop.matches) panel.style.left = `${Math.max(edge, left)}px`;
    else panel.style.removeProperty('left');
    const height = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom - 7;
    // Flip above the pill when it does not fit below (and there is more room up there).
    const top = desktop.matches && height > below && rect.top - 7 > below ? rect.top - 7 - height : rect.bottom + 7;
    panel.style.top = `${Math.max(edge, top)}px`;
  };

  let openPair: { panel: HTMLElement; trigger: HTMLElement } | null = null;
  let frame = 0;
  const follow = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (openPair) place(openPair.panel, openPair.trigger);
    });
  };

  bar.querySelectorAll<HTMLButtonElement>('[data-fa-trigger]').forEach((trigger) => {
    const key = trigger.dataset.faTrigger as Key;
    const panel = panels.get(key);
    if (!panel || !supportsPopover) return;
    let escaped = false;

    panel.addEventListener('beforetoggle', (event) => {
      if ((event as ToggleEvent).newState === 'open') moveSet(key, panel);
    });

    panel.addEventListener('toggle', (event) => {
      const open = (event as ToggleEvent).newState === 'open';
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        escaped = false;
        if (!supportsAnchor) {
          openPair = { panel, trigger };
          place(panel, trigger);
          window.addEventListener('scroll', follow, { passive: true });
          window.addEventListener('resize', follow);
          quick?.addEventListener('scroll', follow, { passive: true });
        }
        // Bring the pill fully into view inside the sideways-scrolling row (phones).
        trigger.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
        panel.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
        return;
      }
      if (openPair?.panel === panel) {
        openPair = null;
        window.removeEventListener('scroll', follow);
        window.removeEventListener('resize', follow);
        quick?.removeEventListener('scroll', follow);
      }
      const focusLost = document.activeElement === document.body || panel.contains(document.activeElement);
      if (escaped || focusLost) trigger.focus({ preventScroll: true });
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') escaped = true;
    });

    // Tabbing out of the panel closes it (light dismiss only reacts to clicks and Esc).
    panel.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !panel.contains(next) && next !== trigger && panel.matches(':popover-open')) {
        panel.hidePopover();
      }
    });
  });

  /* ——— Sheet (phones / no popover support) ——— */

  const SHEET_SETTLE = 450;

  openButton?.addEventListener('click', () => {
    if (!sheet) return;
    KEYS.forEach((key) => {
      const panel = panels.get(key);
      if (panel?.matches(':popover-open')) panel.hidePopover();
      moveSet(key, slots.get(key));
    });
    // Open the groups that hold a choice; with nothing chosen, open the first one.
    const accordions = [...sheet.querySelectorAll<HTMLDetailsElement>('[data-fa-acc]')];
    const withChoice = accordions.filter((acc) => acc.querySelector('input:checked'));
    accordions.forEach((acc, i) => {
      acc.open = withChoice.length ? withChoice.includes(acc) : i === 0;
    });
    sheet.showModal();
    openButton.setAttribute('aria-expanded', 'true');
  });

  sheet?.addEventListener('close', () => {
    openButton?.setAttribute('aria-expanded', 'false');
    openButton?.focus({ preventScroll: true });
    // Let the sheet slide away before emptying it.
    requestAnimationFrame(() => {
      const finished = Promise.allSettled(sheet.getAnimations({ subtree: true }).map((a) => a.finished));
      const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, SHEET_SETTLE));
      Promise.race([finished, timeout]).then(() => {
        if (!sheet.open) homeAll();
      });
    });
  });

  /* ——— Quick row: fade the right edge while more pills hide off-screen ——— */

  if (quick) {
    const markMore = (): void => {
      quick.toggleAttribute('data-more', quick.scrollWidth - quick.clientWidth - quick.scrollLeft > 1);
    };
    new ResizeObserver(markMore).observe(quick);
    quick.addEventListener('scroll', markMore, { passive: true });
  }

  sync();
}
