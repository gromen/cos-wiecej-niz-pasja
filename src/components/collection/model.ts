/**
 * Server-side helpers: derive filter facets (with counts) from the collection.
 *
 * Only described shirts (draft: false) feed the facets – placeholders carry unknown
 * season / kind / status and would drown the real options. The client applies the same
 * rule (a draft never matches a facet chip, see `matches()` in collection.ts), so the
 * counts rendered here equal the ones the runtime computes.
 */
import { colorLabel, kindLabel, shirtPalette, statusLabel, type Lang, type ShirtData, type ShirtEntry } from '../../lib/shirts';

export type FacetGroup = 'era' | 'kind' | 'color' | 'status';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  /** CSS colour for colour swatches. */
  swatch?: string;
}

export interface Facet {
  group: FacetGroup;
  legend: string;
  options: FacetOption[];
}

export const UNKNOWN_ERA = 'unknown';

/** Decade key from the first year of the season: 2008 → '2000'; no season → 'unknown'. */
export const eraOf = (seasonStart?: number): string =>
  seasonStart === undefined ? UNKNOWN_ERA : String(Math.floor(seasonStart / 10) * 10);

/** '2000' → '2000–09', '1970' → '1970–79'. */
export const eraLabel = (era: string, unknown: string): string => {
  if (era === UNKNOWN_ERA) return unknown;
  const start = Number(era);
  return `${start}–${String((start + 9) % 100).padStart(2, '0')}`;
};

const countBy = (shirts: ShirtEntry[], pick: (data: ShirtData) => string): Map<string, number> =>
  shirts.reduce((map, { data }) => map.set(pick(data), (map.get(pick(data)) ?? 0) + 1), new Map<string, number>());

/** Options in schema order (label records preserve it), only values present in the data. */
const fromLabels = <K extends string>(
  labels: Record<K, Record<Lang, string>>,
  counts: Map<string, number>,
  lang: Lang,
  swatch?: (value: K) => string,
): FacetOption[] =>
  (Object.keys(labels) as K[])
    .filter((value) => counts.has(value))
    .map((value) => ({
      value,
      label: labels[value][lang],
      count: counts.get(value) ?? 0,
      swatch: swatch?.(value),
    }));

export const buildFacets = (
  entries: ShirtEntry[],
  lang: Lang,
  legends: Record<FacetGroup, string>,
  unknownEra: string,
): Facet[] => {
  const shirts = entries.filter(({ data }) => !data.draft);
  const eras = countBy(shirts, (data) => eraOf(data.seasonStart));
  const eraOptions = [...eras.keys()]
    .sort((a, b) => {
      if (a === UNKNOWN_ERA) return 1;
      if (b === UNKNOWN_ERA) return -1;
      return Number(b) - Number(a);
    })
    .map((value) => ({ value, label: eraLabel(value, unknownEra), count: eras.get(value) ?? 0 }));

  const facets: Facet[] = [
    { group: 'era', legend: legends.era, options: eraOptions },
    { group: 'kind', legend: legends.kind, options: fromLabels(kindLabel, countBy(shirts, (d) => d.kind), lang) },
    {
      group: 'color',
      legend: legends.color,
      options: fromLabels(colorLabel, countBy(entries, (d) => d.color), lang, (value) => shirtPalette[value].body),
    },
    { group: 'status', legend: legends.status, options: fromLabels(statusLabel, countBy(shirts, (d) => d.status), lang) },
  ];
  return facets.filter((facet) => facet.options.length > 0);
};
