/**
 * Placeholder shirt geometry (viewBox 400×480), shared by the stand-alone <ShirtSvg>
 * (detail page) and the per-page <ShirtSymbols> sprite (collection grid).
 */
export const VIEWBOX = '0 0 400 480';

export const BODY =
  'M135 24 L60 54 L8 150 L62 176 L92 130 L92 450 Q200 470 308 450 L308 130 L338 176 L392 150 L340 54 L265 24 Q200 66 135 24 Z';

export const NECK_BACK = 'M135 24 Q200 46 265 24';
export const NECK_FRONT = 'M135 24 Q200 70 265 24';
export const SEAMS = 'M135 24 L92 130 M265 24 L308 130';
export const CUFFS = 'M8 150 L62 176 L70 164 L15 138 Z M392 150 L338 176 L330 164 L385 138 Z';
export const HEM = 'M92 441 Q200 461 308 441';
export const SASH_BAND = 'M80 92 L320 385 L320 420 L80 128 Z';
export const SIGNATURE =
  'M118 372 C132 340 150 318 160 330 C170 344 140 372 160 366 C190 356 196 330 206 340 C216 352 196 372 214 366 C240 356 252 334 262 346 C270 356 258 366 282 352 M112 388 C170 372 240 382 300 366';

export const star = (cx: number, cy: number, outer: number, inner: number): string =>
  Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');

export const CHEST_STAR = star(268, 104, 14, 5.6);

/** Pinstripe sash: edges + hairlines, parallel diagonals across the torso. */
export const STRIPES = [0, 0.25, 0.5, 0.75, 1].map((t) => {
  const y = 92 + 36 * t;
  const edge = t === 0 || t === 1;
  return { d: `M80 ${y} L320 ${y + 293}`, w: edge ? 2.4 : 0.9, o: edge ? 0.95 : 0.55 };
});

/** Symbol ids of the page sprite (<ShirtSymbols>), referenced by <ShirtUse>. */
export const SYMBOL_ID = { front: 'shirt-sym-front', back: 'shirt-sym-back' } as const;
