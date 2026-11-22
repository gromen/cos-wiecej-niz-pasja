/**
 * Proto B – the bits collection.ts does not do for the drawer variant:
 *  - open the drawer (the runtime only closes its `[data-sheet]`) and return focus on close,
 *  - render removable tokens for every active filter (+ the „Wyczyść” beside them),
 *  - tally selected options per kartoteka section.
 * Filtering, counts, URL sync and the apply-on-close logic stay in collection.ts – a token
 * click just unticks its input and fires `input`, exactly like a user would.
 */
const root = document.querySelector<HTMLElement>('[data-collection]');
const form = document.querySelector<HTMLFormElement>('[data-form]');
const drawer = document.querySelector<HTMLDialogElement>('[data-b-drawer]');
const openButton = document.querySelector<HTMLButtonElement>('[data-b-open]');
const tokens = document.querySelector<HTMLElement>('[data-b-tokens]');
const list = document.querySelector<HTMLUListElement>('[data-b-token-list]');

if (root && form && drawer && openButton && tokens && list) {
  const sections = [...drawer.querySelectorAll<HTMLDetailsElement>('[data-b-sec]')];

  const checked = (): HTMLInputElement[] =>
    [...form.elements].filter(
      (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'checkbox' && el.checked,
    );

  const removeIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"></path></svg>';

  const render = (): void => {
    const active = checked();
    const items = active.map((input) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fb-token';
      button.dataset.bKey = `${input.name}:${input.value}`;
      button.setAttribute('aria-label', `Usuń filtr: ${input.dataset.tokenGroup ?? ''} – ${input.dataset.token ?? ''}`);
      const label = document.createElement('span');
      label.textContent = input.dataset.token ?? input.value;
      button.append(label);
      button.insertAdjacentHTML('beforeend', removeIcon);
      li.append(button);
      return li;
    });
    list.replaceChildren(...items);
    tokens.hidden = active.length === 0;

    sections.forEach((section) => {
      const n = [...section.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((i) => i.checked).length;
      const badge = section.querySelector<HTMLElement>('[data-b-sec-count]');
      if (!badge) return;
      badge.hidden = n === 0;
      badge.textContent = String(n);
      badge.setAttribute('aria-label', `wybrane: ${n}`);
    });
  };

  // Runs after collection.ts in the same task; a microtask also lets form.reset() finish first.
  const schedule = (): void => queueMicrotask(render);

  root.addEventListener('input', schedule);
  root.addEventListener('change', schedule);
  form.addEventListener('reset', schedule);

  list.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-b-key]') : null;
    if (!button) return;
    const [name, value] = (button.dataset.bKey ?? '').split(':');
    const input = checked().find((el) => el.name === name && el.value === value);
    if (!input) return;
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('[data-b-key]')];
    const index = buttons.indexOf(button);
    input.checked = false;
    // collection.ts filters on this event; its `input` also schedules render() (a microtask).
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Queued after that render: keep focus in the token row – next token, else previous, else „Filtry”.
    queueMicrotask(() => {
      const next = [...list.querySelectorAll<HTMLButtonElement>('[data-b-key]')];
      (next[index] ?? next[index - 1] ?? openButton).focus({ preventScroll: true });
    });
  });

  openButton.addEventListener('click', () => {
    if (!drawer.open) drawer.showModal();
  });

  // Esc, ×, backdrop or „Pokaż N” – always land back on „Filtry” (WebKit does not always).
  drawer.addEventListener('close', () => {
    const focused = document.activeElement;
    if (!focused || focused === document.body || drawer.contains(focused)) openButton.focus({ preventScroll: true });
  });

  render();
}
