const COUNT = 86;
const COUNT_MS = 1500;
const TOTAL_MS = 1800;
export const INTRO_KEY = 'cwnp-a-intro';

/**
 * Intro is driven by CSS (shirt light-up, headline reveal) keyed on
 * `html[data-intro="on"]`; this module only runs the counter, the skip
 * controls and flips the flag to "done" when the sequence ends.
 */
export const initIntro = (root: HTMLElement): void => {
  const html = document.documentElement;
  if (html.dataset.intro !== 'on') return;

  const counter = root.querySelector<HTMLElement>('[data-counter]');
  const skip = root.querySelector<HTMLButtonElement>('[data-skip]');
  const start = performance.now();
  let raf = 0;
  let finished = false;

  const tick = (now: number) => {
    const t = Math.min((now - start) / COUNT_MS, 1);
    const eased = 1 - (1 - t) ** 3;
    if (counter) counter.textContent = String(Math.round(eased * COUNT)).padStart(2, '0');
    if (t < 1) raf = requestAnimationFrame(tick);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    html.dataset.intro = 'done';
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* private mode – the intro simply replays next time */
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };

  const timer = window.setTimeout(finish, TOTAL_MS);
  skip?.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  raf = requestAnimationFrame(tick);
};
