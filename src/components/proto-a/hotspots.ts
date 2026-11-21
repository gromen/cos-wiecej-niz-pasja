import { COLLECTION_SIZE, wall, wallRows } from '../../data/collection';

/** One interactive area over a single shirt on the wall photo. Geometry is in % of the image. */
export interface Hotspot {
  id: number;
  row: number;
  player: string;
  number: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Intro "light-up" delay in ms (seeded shuffle, so the build is deterministic). */
  delay: number;
  /** Which way the museum label should anchor so it never leaves the photo. */
  edge: 'l' | 'c' | 'r';
  /** Shirt the scroll transition zooms into (Iliev 77, bottom-right). */
  target: boolean;
}

/** The collector sits in the middle of the bottom row (% of image width). */
const GAP = { from: 46.5, to: 53.5 } as const;
const GAP_ROW = wallRows.length - 1;
const INTRO_SPREAD_MS = 1100;

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buildHotspots = (): Hotspot[] => {
  const spots: Omit<Hotspot, 'delay'>[] = [];

  wall.forEach((shirts, row) => {
    const geo = wallRows[row];
    const height = geo.bottom - geo.top;
    const segments: { from: number; to: number; items: typeof shirts }[] = [];

    if (row === GAP_ROW) {
      const split = shirts.findIndex((s) => s.player === 'Świątko');
      const at = split > 0 ? split : Math.ceil(shirts.length / 2);
      segments.push({ from: geo.left, to: GAP.from, items: shirts.slice(0, at) });
      segments.push({ from: GAP.to, to: geo.right, items: shirts.slice(at) });
    } else {
      segments.push({ from: geo.left, to: geo.right, items: shirts });
    }

    segments.forEach(({ from, to, items }) => {
      const cell = (to - from) / items.length;
      items.forEach((shirt, i) => {
        const left = from + cell * i;
        const centre = left + cell / 2;
        spots.push({
          id: 0,
          row,
          player: shirt.player,
          number: shirt.number,
          left,
          top: geo.top,
          width: cell,
          height,
          edge: centre < 12 ? 'l' : centre > 88 ? 'r' : 'c',
          target: row === GAP_ROW && shirt.player === 'Iliev' && shirt.number === 77,
        });
      });
    });
  });

  const rand = mulberry32(86);
  const order = spots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const delays = new Array<number>(spots.length);
  order.forEach((spotIndex, rank) => {
    delays[spotIndex] = Math.round((rank / (spots.length - 1)) * INTRO_SPREAD_MS);
  });

  return spots.map((s, i) => ({ ...s, id: i + 1, delay: delays[i] }));
};

export const hotspots = buildHotspots();

if (hotspots.length !== COLLECTION_SIZE) {
  throw new Error(`proto-a: expected ${COLLECTION_SIZE} hotspots, got ${hotspots.length}`);
}
