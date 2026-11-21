/** Touch handling, initial centring and the pan hint for the interactive wall. */
export const initWall = (stage: HTMLElement, hint: HTMLElement | null): void => {
  let active: HTMLElement | null = null;

  const setActive = (next: HTMLElement | null) => {
    if (active) delete active.dataset.active;
    active = next;
    if (active) active.dataset.active = '';
  };

  // Touch / pen: tap shows the label (Safari does not focus buttons on tap).
  stage.addEventListener('click', (e) => {
    const pointer = e as PointerEvent;
    if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
    const spot = (e.target as Element).closest<HTMLElement>('.pa-spot');
    setActive(spot && spot !== active ? spot : null);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setActive(null);
  });

  // Photo is landscape: start centred, and drop the hint after the first pan.
  stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
  stage.addEventListener(
    'scroll',
    () => {
      if (hint) hint.dataset.seen = '';
    },
    { passive: true, once: true },
  );
};
