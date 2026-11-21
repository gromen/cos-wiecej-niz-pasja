import { getCollection, type CollectionEntry } from 'astro:content';

export type ShirtEntry = CollectionEntry<'shirts'>;
export type ShirtData = ShirtEntry['data'];
export type Lang = 'pl' | 'en';

/** Body + trim colours for the SVG placeholder (until real photos arrive). */
export const shirtPalette: Record<ShirtData['color'], { body: string; trim: string }> = {
  red: { body: '#c6102e', trim: '#fafafa' },
  white: { body: '#f2f2ef', trim: '#c6102e' },
  blue: { body: '#1f4fa3', trim: '#fafafa' },
  green: { body: '#3fae4f', trim: '#fafafa' },
  yellow: { body: '#e8d21d', trim: '#0d314f' },
  orange: { body: '#f08a1c', trim: '#0d314f' },
  other: { body: '#2a2f36', trim: '#fafafa' },
};

export const kindLabel: Record<ShirtData['kind'], Record<Lang, string>> = {
  home: { pl: 'domowa', en: 'home' },
  away: { pl: 'wyjazdowa', en: 'away' },
  third: { pl: 'trzecia', en: 'third' },
  goalkeeper: { pl: 'bramkarska', en: 'goalkeeper' },
  special: { pl: 'okolicznościowa', en: 'special edition' },
  unknown: { pl: 'do ustalenia', en: 'tbc' },
};

export const statusLabel: Record<ShirtData['status'], Record<Lang, string>> = {
  'match-worn': { pl: 'meczowa – grana', en: 'match-worn' },
  'match-issued': { pl: 'meczowa – przygotowana', en: 'match-issued' },
  unconfirmed: { pl: 'niepotwierdzona', en: 'unconfirmed' },
};

export const colorLabel: Record<ShirtData['color'], Record<Lang, string>> = {
  red: { pl: 'czerwona', en: 'red' },
  white: { pl: 'biała', en: 'white' },
  blue: { pl: 'niebieska', en: 'blue' },
  green: { pl: 'zielona', en: 'green' },
  yellow: { pl: 'żółta', en: 'yellow' },
  orange: { pl: 'pomarańczowa', en: 'orange' },
  other: { pl: 'inna', en: 'other' },
};

export const lastName = (player: string): string => player.split(' ').at(-1) ?? player;

/** Shared view-transition name for the shirt visual (card ↔ detail page). */
export const shirtTransitionName = (id: string): string => `shirt-${id}`;

/** Real entries first (newest IG post first), then placeholders in wall order. */
export const getShirts = async (): Promise<ShirtEntry[]> => {
  const all = await getCollection('shirts');
  return all.sort((a, b) => {
    if (a.data.draft !== b.data.draft) return a.data.draft ? 1 : -1;
    if (!a.data.draft) return (b.data.igPost ?? 0) - (a.data.igPost ?? 0);
    const wa = a.data.wall ?? { row: 0, col: 0 };
    const wb = b.data.wall ?? { row: 0, col: 0 };
    return wa.row - wb.row || wa.col - wb.col;
  });
};

export const shirtHref = (id: string, lang: Lang = 'pl'): string =>
  lang === 'pl' ? `/kolekcja/${id}/` : `/en/collection/${id}/`;
