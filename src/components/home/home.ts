/**
 * Home page – tiny runtime. Everything visual is CSS; JS only handles
 *  1. `.is-in` flag for the time-based fallbacks (browsers without scroll-driven animations),
 *  2. pausing marquees while off-screen or on user request (WCAG 2.2.2 toggle),
 *  3. scroll-velocity reaction of the marquees,
 *  4. „Sezony”: index links + keyboard focus in the pinned (scroll-driven) layout,
 *  5. shared-element morph: only the clicked shirt carries its view-transition-name.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const initReveal = (): void => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 },
  );
  targets.forEach((target) => observer.observe(target));
};

const initMarquees = (): void => {
  const bands = [...document.querySelectorAll<HTMLElement>('[data-marquee]')];
  if (bands.length === 0) return;

  // CSS drops the animation under reduced motion and creates a fresh one when motion is allowed
  // again, so the Animation objects are re-read on every preference change.
  const collect = (): { band: HTMLElement; animation: Animation }[] =>
    reduceMotion.matches
      ? []
      : bands.flatMap((band) => {
          const animation = band.querySelector('.track')?.getAnimations()[0];
          return animation ? [{ band, animation }] : [];
        });

  let marquees = collect();
  const visible = new Set<Element>();
  let userPaused = false;

  // Single source of truth for play state: on screen AND not paused by the user.
  const sync = (): void => {
    marquees.forEach(({ band, animation }) => {
      if (!userPaused && visible.has(band)) animation.play();
      else animation.pause();
    });
  };

  const visibility = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    },
    { rootMargin: '120px 0px' },
  );

  bands.forEach((band) => visibility.observe(band));

  // Speed up while scrolling down, slow down while scrolling up; ease back to 1x at rest.
  // One time base (performance.now) for both the scroll handler and the frame loop – mixing it
  // with the rAF timestamp (which can predate the scroll event) produced negative deltas → spikes.
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let boost = 0;
  let rate = 1;
  let frame = 0;

  const setRate = (next: number): void => {
    if (Math.abs(next - rate) < 0.005) return;
    rate = next;
    marquees.forEach(({ animation }) => animation.updatePlaybackRate(rate));
  };

  const stop = (): void => {
    frame = 0;
    boost = 0;
    if (rate !== 1) {
      rate = 1;
      marquees.forEach(({ animation }) => animation.updatePlaybackRate(1));
    }
  };

  const tick = (): void => {
    if (userPaused) {
      stop();
      return;
    }

    const now = performance.now();
    const y = window.scrollY;
    const velocity = (y - lastY) / Math.max(now - lastTime, 1); // px/ms, signed
    lastY = y;
    lastTime = now;

    boost += (clamp(velocity * 1.5, -0.7, 3) - boost) * 0.12;
    setRate(1 + boost);

    if (Math.abs(boost) > 0.01 || Math.abs(velocity) > 0.01) frame = requestAnimationFrame(tick);
    else stop();
  };

  window.addEventListener(
    'scroll',
    () => {
      if (frame || userPaused || marquees.length === 0) return;
      lastY = window.scrollY;
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    },
    { passive: true },
  );

  // WCAG 2.2.2 pause/play toggle – only shown when the marquees actually move.
  const toggle = document.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
  const showToggle = (): void => {
    if (toggle) toggle.hidden = marquees.length === 0;
  };

  // Reduced-motion preference flipped at runtime: stop the boost loop, re-read the animations.
  reduceMotion.addEventListener('change', () => {
    if (frame) cancelAnimationFrame(frame);
    stop();
    marquees = collect();
    sync();
    showToggle();
  });

  showToggle();
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    if (userPaused && frame) {
      cancelAnimationFrame(frame);
      stop();
    }
    sync();
  });
};

/**
 * In the pinned layout the strip is moved by a CSS scroll timeline, so the browser can't
 * scroll a stop into view itself: map stop index → page scroll position instead.
 * In the strip layout, scroll the strip only (a plain anchor would also jump the page).
 */
const initSeasons = (): void => {
  const root = document.querySelector<HTMLElement>('[data-seasons]');
  const strip = root?.querySelector<HTMLElement>('[data-strip]');
  if (!root || !strip) return;

  const stops = [...root.querySelectorAll<HTMLElement>('[data-stop]')];
  const isPinned = (): boolean => getComputedStyle(root).getPropertyValue('--pinned').trim() === '1';
  const behavior = (): ScrollBehavior => (reduceMotion.matches ? 'auto' : 'smooth');

  const show = (index: number, smooth: boolean): void => {
    const stop = stops[index];
    if (!stop) return;
    if (isPinned()) {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const travel = root.offsetHeight - window.innerHeight;
      const progress = stops.length > 1 ? index / (stops.length - 1) : 0;
      window.scrollTo({ top: top + travel * progress, behavior: smooth ? behavior() : 'auto' });
      return;
    }
    const left = stop.offsetLeft - parseFloat(getComputedStyle(strip).scrollPaddingInlineStart || '0');
    strip.scrollTo({ left, behavior: smooth ? behavior() : 'auto' });
  };

  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-stop-link]')];

  // Scroll spy: highlight the chip of the stop currently in the centre.
  let activeIndex = -1;
  const setActive = (index: number): void => {
    if (index === activeIndex) return;
    activeIndex = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  };

  // Measure what is actually centred (works for both the pinned CSS timeline and the native strip).
  const currentIndex = (): number => {
    const centre = strip.getBoundingClientRect().left + strip.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    stops.forEach((stop, i) => {
      const rect = stop.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  };

  let spyFrame = 0;
  let inView = false;
  const spy = (): void => {
    if (spyFrame || !inView) return;
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      setActive(currentIndex());
    });
  };

  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false;
    spy();
  }).observe(root);
  // The pinned strip keeps moving for a moment after the scroll event (CSS timeline), so re-check once scrolling settles.
  window.addEventListener('scrollend', spy, { passive: true });
  window.addEventListener('scroll', spy, { passive: true });
  strip.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy, { passive: true });

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const index = Number(link.dataset.stopLink);
      setActive(index);
      if (!isPinned()) strip.scrollIntoView({ block: 'nearest', behavior: behavior() });
      show(index, true);
    });
  });

  root.addEventListener('focusin', (event) => {
    if (!isPinned()) return;
    const stop = (event.target as Element).closest<HTMLElement>('[data-stop]');
    if (stop) show(stops.indexOf(stop), false);
  });
};

/**
 * The same shirt can appear twice on the page (timeline + featured). Duplicate
 * view-transition-names abort the transition, so the name lives only on the clicked one.
 */
const initMorph = (): void => {
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-shirt-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const visual =
      link.querySelector<HTMLElement>('[data-vt]') ??
      link.closest('article')?.querySelector<HTMLElement>('[data-vt]');
    const name = visual?.dataset.vt;
    if (!visual || !name) return;
    document.querySelectorAll<HTMLElement>(`[data-vt="${CSS.escape(name)}"]`).forEach((el) => {
      el.dataset.vtOrig ??= el.style.viewTransitionName;
      el.style.viewTransitionName = el === visual ? name : 'none';
    });
  });

  // Back/forward cache restore: put the markup's names back so the detail → home morph has its target again.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll<HTMLElement>('[data-vt-orig]').forEach((el) => {
      el.style.viewTransitionName = el.dataset.vtOrig ?? '';
      delete el.dataset.vtOrig;
    });
  });
};

initReveal();
initSeasons();
initMorph();
initMarquees();
