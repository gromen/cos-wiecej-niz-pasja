/**
 * Shared by the server (pre-folding `data-search` on cards) and the client runtime,
 * so both sides normalise text in exactly the same way.
 */

/** Letters that Unicode NFD does not decompose (ł, ø, đ…) – mapped by hand. */
const SPECIAL: Record<string, string> = { ł: 'l', ø: 'o', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe' };

/** Lowercase, strip diacritics, collapse whitespace: „Łobodziński” → „lobodzinski”. */
export const fold = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[łøđßæœ]/g, (char) => SPECIAL[char] ?? char)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Query → tokens; every token must match (name fragment or exact shirt number). */
export const tokenize = (query: string): string[] => fold(query).split(' ').filter(Boolean);

export const matchesTokens = (tokens: readonly string[], haystack: string, number: number): boolean =>
  tokens.every((token) => (/^\d+$/.test(token) ? number === Number(token) : haystack.includes(token)));

/** Polish plural form index: 1 koszulka · 2–4 koszulki · 5+ koszulek (22–24 koszulki, 12–14 koszulek). */
export const pluralIndex = (n: number): 0 | 1 | 2 => {
  if (n === 1) return 0;
  const units = n % 10;
  const tens = n % 100;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? 1 : 2;
};

export const plural = (n: number, forms: readonly [string, string, string]): string => forms[pluralIndex(n)];
