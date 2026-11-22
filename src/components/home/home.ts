/**
 * Home page – tiny runtime. Everything visual is CSS; JS only handles
 *  1. `.is-in` flag for the time-based fallbacks (browsers without scroll-driven animations),
 *  2. pausing marquees while off-screen or on user request (WCAG 2.2.2 toggle),
 *  3. scroll-velocity reaction of the marquees,
 *  4. „Sezony”: index chips, scroll spy + keyboard-focus centring (pinned and strip layouts),
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
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-stop-link]')];
  const dots = [...root.querySelectorAll<HTMLElement>('[data-stop-dot]')];
  const steps = [...root.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const behavior = (): ScrollBehavior => (reduceMotion.matches ? 'auto' : 'smooth');

  /*
   * Pinned geometry, cached (the spy runs on every scroll frame and must not read layout).
   * The track's travel runs over the section's `contain` range: from its top at the viewport
   * top to its bottom at the viewport bottom. clientHeight = the scrollport the timeline uses
   * (innerHeight would include a horizontal scrollbar).
   */
  interface Geometry {
    pinned: boolean;
    top: number;
    /** Page scroll over the whole pinned range (the timeline's `contain` range). */
    travel: number;
    /** Page scroll per stop (≈ one --stop-w, i.e. 1px of scroll ≈ 1px of track travel). */
    pxPerStop: number;
  }
  let geometry: Geometry | null = null;
  const measure = (): Geometry => {
    if (!geometry) {
      const travel = root.offsetHeight - document.documentElement.clientHeight;
      geometry = {
        pinned: getComputedStyle(root).getPropertyValue('--pinned').trim() === '1',
        top: root.getBoundingClientRect().top + window.scrollY,
        travel,
        pxPerStop: stops.length > 1 ? travel / (stops.length - 1) : 0,
      };
    }
    return geometry;
  };
  const invalidate = (): void => {
    geometry = null;
  };
  const isPinned = (): boolean => measure().pinned;

  /** Page scroll at which stop `index` is centred – also where its CSS snap anchor sits. */
  const anchorY = (index: number): number => {
    const { top, pxPerStop } = measure();
    return top + pxPerStop * index;
  };
  /** Index of the stop the page is resting on (within 1.5px of its anchor), else -1. */
  const restingAt = (y: number): number => {
    const { top, pxPerStop } = measure();
    if (!pxPerStop) return -1;
    const index = Math.round((y - top) / pxPerStop);
    return index >= 0 && index < stops.length && Math.abs(y - anchorY(index)) < 1.5 ? index : -1;
  };

  // Settling correction after a smooth jump: the landing spot can be stale (images above
  // loading after the click) – re-measure and land on the stop's anchor once it stops. It targets
  // exactly the CSS snap position, so it never fights the snapping (usually it's a no-op).
  // Set while show()/recentre() scroll the page themselves – the magnet below leaves that scroll alone.
  let jumping = false;
  let jumpTarget = 0;
  let lastScrollAt = 0;
  let cancelSettle = (): void => {};
  const recentre = (index: number): void => {
    if (!stops[index] || !isPinned()) return;
    invalidate();
    const target = anchorY(index);
    if (Math.abs(window.scrollY - target) <= 1) return;
    // Our own scroll: the magnet must not read it as a user gesture.
    jumping = true;
    window.scrollTo({ top: target, behavior: 'instant' });
  };
  const settle = (index: number): void => {
    cancelSettle();
    let timer = 0;
    const done = (): void => {
      cancelSettle();
      // The CSS timeline applies on the next frame – measure after it.
      requestAnimationFrame(() => recentre(index));
    };
    const fallback = (): void => {
      // Still moving (a long smooth scroll): wait a bit more instead of cutting it short.
      if (performance.now() - lastScrollAt < 120) timer = window.setTimeout(fallback, 150);
      else done();
    };
    const abort = (): void => cancelSettle();
    cancelSettle = (): void => {
      window.clearTimeout(timer);
      window.removeEventListener('scrollend', done);
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) => window.removeEventListener(type, abort));
      cancelSettle = (): void => {};
    };
    window.addEventListener('scrollend', done, { once: true });
    // The user taking over cancels the correction.
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) =>
      window.addEventListener(type, abort, { once: true, passive: true }),
    );
    timer = window.setTimeout(fallback, 700);
  };


  const show = (index: number, smooth: boolean): void => {
    const stop = stops[index];
    if (!stop) return;
    invalidate();
    if (isPinned()) {
      const target = anchorY(index);
      if (Math.abs(window.scrollY - target) < 1) return;
      jumping = true;
      jumpTarget = index;
      window.scrollTo({ top: target, behavior: smooth ? behavior() : 'instant' });
      settle(index);
      return;
    }
    // Stops snap to the centre (the strip is their offsetParent, so offsetLeft is in scroll coordinates).
    const left = stop.offsetLeft + stop.offsetWidth / 2 - strip.clientWidth / 2;
    strip.scrollTo({ left, behavior: smooth ? behavior() : 'instant' });
  };

  // Scroll spy: highlight the chip of the stop currently in the centre.
  let activeIndex = -1;
  const setActive = (index: number): void => {
    if (index === activeIndex) return;
    activeIndex = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    dots.forEach((dot, i) => dot.toggleAttribute('data-active', i === index));
    steps.forEach((step) => {
      const to = index + Number(step.dataset.step);
      step.setAttribute('aria-disabled', String(to < 0 || to >= stops.length));
    });
  };

  const currentIndex = (): number => {
    const { pinned, top, pxPerStop } = measure();
    // Pinned: the track's translate is linear in page scroll – no layout reads needed.
    if (pinned) {
      if (!pxPerStop) return 0;
      return clamp(Math.round((window.scrollY - top) / pxPerStop), 0, stops.length - 1);
    }
    // Strip: measure what is actually centred.
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

  /*
   * „Magnet” (pinned only). CSS does the snapping: one invisible anchor per stop and
   * `scroll-snap-type: y proximity` on the root while the section carries data-snap. data-snap is
   * set only strictly inside the pinned range – resting on the first/last stop or anywhere outside
   * the section, nothing snaps, so leaving (or stopping just above/below) never pulls back in.
   */
  const syncSnap = (): void => {
    const { pinned, top, travel } = measure();
    const y = window.scrollY;
    const inside = pinned && inView && y > top + 1.5 && y < top + travel - 1.5;
    if (inside !== root.hasAttribute('data-snap')) root.toggleAttribute('data-snap', inside);
  };

  /*
   * Proximity alone has two gaps, closed at the end of each scroll gesture inside the range:
   *  - from a resting stop, a short move (a wheel notch, a small trackpad nudge) is snapped straight
   *    back – Chrome even refuses to move – so the user would be stuck: continue to the next stop in
   *    the gesture's direction instead;
   *  - a gesture ending between stops, beyond the snap distance (≈ 1/3 of the viewport in Chrome),
   *    would rest half-way: finish it to the neighbouring stop in the gesture's direction.
   *  Gestures ending outside the pinned range are left alone, so leaving is always free.
   * Direction = the input's (wheel delta, scroll keys), else the net movement (scrollbar drag).
   */
  let gesture = false;
  // Where the page last came to rest. The gesture starts from there: by the time the first wheel or
  // scroll event is handled, the page may already have moved.
  let restY = window.scrollY;
  let gestureStartY = 0;
  let gestureFrom = -1;
  let intent = 0;
  let gestureTimer = 0;
  const beginGesture = (): void => {
    if (gesture) return;
    gesture = true;
    gestureStartY = restY;
    gestureFrom = restingAt(restY);
    intent = 0;
  };
  const endGesture = (idle: boolean): void => {
    window.clearTimeout(gestureTimer);
    if (!gesture) {
      if (idle) restY = window.scrollY;
      return;
    }
    // Input went quiet but the page is still moving (smooth wheel / fling): scrollend follows.
    if (!idle && performance.now() - lastScrollAt < 150) {
      gestureTimer = window.setTimeout(() => endGesture(false), 150);
      return;
    }
    gesture = false;
    restY = window.scrollY;
    syncSnap();
    if (jumping) {
      jumping = false;
      return;
    }
    const { pinned, top, travel, pxPerStop } = measure();
    const y = window.scrollY;
    if (!pinned || !pxPerStop || y < top - 1 || y > top + travel + 1) return;
    // No input and (almost) no net movement – e.g. a layout shift or a resnap: nothing to finish.
    if (!intent && Math.abs(y - gestureStartY) < 2) return;
    const dir = intent || Math.sign(y - gestureStartY);
    const at = restingAt(y);
    const position = (y - top) / pxPerStop;
    // Between stops: onward in the gesture's direction – unless it only just crossed a stop without
    // having rested on it (e.g. entering the section from above): then back to that stop.
    const slack = gestureFrom >= 0 ? 0 : 0.25;
    const onward =
      dir > 0
        ? position - Math.floor(position) < slack
          ? Math.floor(position)
          : Math.ceil(position)
        : dir < 0
          ? Math.ceil(position) - position < slack
            ? Math.ceil(position)
            : Math.floor(position)
          : Math.round(position);
    const target = at >= 0 ? (at === gestureFrom && dir ? at + dir : -1) : onward;
    if (target >= 0 && target < stops.length && target !== at) show(target, true);
  };
  const onIntent = (dir: number): void => {
    if (!isPinned()) return;
    jumping = false;
    beginGesture();
    if (dir) intent = dir;
    window.clearTimeout(gestureTimer);
    gestureTimer = window.setTimeout(() => endGesture(false), 200);
  };
  window.addEventListener(
    'wheel',
    (event) => {
      // Ctrl/⌘ + wheel is zoom (incl. the macOS trackpad pinch), not scrolling.
      if (event.ctrlKey || event.metaKey) return;
      onIntent(Math.sign(event.deltaY));
    },
    { passive: true },
  );
  const keyDirs: Record<string, number> = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
  window.addEventListener('keydown', (event) => {
    const dir = keyDirs[event.key];
    const target = event.target as HTMLElement;
    if (!dir || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    // Only page-level scrolling keys: focus on the page itself or inside this section. Elsewhere,
    // keys may drive other widgets (roving tabindex, summary, links in other strips).
    const pageLevel = target === document.body || target === document.documentElement || root.contains(target);
    if (!pageLevel) return;
    if (target.isContentEditable || target.closest('input, textarea, select, button, [role="slider"]')) return;
    onIntent(event.key === ' ' && event.shiftKey ? -1 : dir);
  });
  window.addEventListener('scrollend', () => endGesture(true));

  let spyFrame = 0;
  let inView = false;
  const spy = (): void => {
    if (spyFrame) return;
    if (!inView) {
      root.removeAttribute('data-snap');
      return;
    }
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      syncSnap();
      setActive(currentIndex());
    });
  };

  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false;
    spy();
  }).observe(root);
  // Anything above the section changing height (late images, fonts) moves its top: re-measure.
  new ResizeObserver(() => {
    invalidate();
    spy();
  }).observe(document.body);
  reduceMotion.addEventListener('change', () => {
    invalidate();
    spy();
  });
  window.addEventListener('scrollend', spy, { passive: true });
  window.addEventListener(
    'scroll',
    () => {
      lastScrollAt = performance.now();
      if (isPinned()) beginGesture();
      spy();
    },
    { passive: true },
  );
  strip.addEventListener('scroll', spy, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      invalidate();
      spy();
    },
    { passive: true },
  );

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const index = Number(link.dataset.stopLink);
      setActive(index);
      if (!isPinned()) strip.scrollIntoView({ block: 'nearest', behavior: behavior() });
      show(index, true);
    });
  });

  // Prev/next arrows: from the stop a running jump is heading to, so quick repeated clicks add up.
  steps.forEach((step) => {
    step.addEventListener('click', () => {
      if (step.getAttribute('aria-disabled') === 'true') return;
      const from = jumping ? jumpTarget : activeIndex < 0 ? currentIndex() : activeIndex;
      const index = clamp(from + Number(step.dataset.step), 0, stops.length - 1);
      setActive(index);
      show(index, true);
    });
  });

  // Keyboard only: a mouse click on a card link must not yank the strip around.
  root.addEventListener('focusin', (event) => {
    const target = event.target as Element;
    if (!target.matches(':focus-visible')) return;
    const stop = target.closest<HTMLElement>('[data-stop]');
    if (stop) show(stops.indexOf(stop), false);
  });

  // Back/forward cache restore: the page may come back at another position with stale state.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    cancelSettle();
    window.clearTimeout(gestureTimer);
    gesture = false;
    jumping = false;
    intent = 0;
    restY = window.scrollY;
    invalidate();
    activeIndex = -1;
    syncSnap();
    spy();
  });

  // The chips are wired up – show them (CSS hides them without JS).
  root.dataset.ready = '';
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
