/**
 * Shape of every user-facing string on the collection page. The page owns the
 * actual copy (one object at its top) – an EN page only needs another object of this type.
 */

/** Strings the client runtime needs; serialised into `data-strings` on the page root. */
export interface ClientStrings {
  /** Plural forms: [1, 2–4, 5+] – e.g. ['koszulka', 'koszulki', 'koszulek']. */
  forms: [string, string, string];
  /** Plural forms after a verb (accusative): „Pokaż 1 koszulkę”. */
  applyForms: [string, string, string];
  /** „12 z 87” – the joiner before the total. */
  of: string;
  /** Sheet button – `{n}` count, `{forms}` plural noun. */
  apply: string;
  applyEmpty: string;
  /** Live region – `{n}`, `{forms}`, `{total}`. */
  status: string;
  statusAll: string;
  statusEmpty: string;
}

export interface CollectionStrings {
  lang: 'pl' | 'en';
  meta: { title: string; description: string };
  skip: string;
  masthead: {
    eyebrow: string;
    heading: string;
    lead: string;
    /** `{described}` / `{drafts}` placeholders. */
    tally: string;
    /** After the live count: „86 koszulek / w szatni”. */
    countSuffix: string;
    /** Visible heading of the browse area („Szatnia”). */
    room: string;
    sash: string;
    /** Marquee pause control (WCAG 2.2.2): one constant label, state carried by aria-pressed. */
    sashPause: string;
  };
  filters: {
    region: string;
    search: string;
    searchPlaceholder: string;
    open: string;
    sheetTitle: string;
    close: string;
    reset: string;
    groups: { era: string; kind: string; color: string; status: string; options: string };
    unknownEra: string;
    signed: string;
    described: string;
    sort: string;
    sortOptions: { newest: string; number: string; season: string };
    activeCount: string;
  };
  /** Quick-chip rail + „Wszystkie filtry” dialog. */
  quick: {
    all: string;
    allShort: string;
    rail: string;
    railShort: string;
    clear: string;
    prev: string;
    next: string;
    colorPrefix: string;
    signed: string;
    described: string;
    /** Decade chips; eras missing from the data are dropped. */
    decades: { label: string; eras: string[] }[];
    kinds: { label: string; kind: string }[];
  };
  card: {
    draft: string;
    signed: string;
    number: string;
    unknownSeason: string;
    unknownPlayer: string;
    unknownPlayerFull: string;
    /** Flip affordance on touch screens (state carried by aria-pressed). */
    flip: string;
  };
  results: {
    heading: string;
    emptyTitle: string;
    emptyText: string;
    emptyReset: string;
  };
  footer: { disclaimer: string; instagram: string; newTab: string };
  client: ClientStrings;
}
