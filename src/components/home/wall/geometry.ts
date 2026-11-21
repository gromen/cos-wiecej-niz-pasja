import { wallRows } from '../../../data/collection';
import type { ShirtEntry } from '../../../lib/shirts';

/** One interactive area over a single shirt on the wall photo. Geometry in % of the image. */
export interface Hotspot {
  entry: ShirtEntry;
  /** 1-based, as stored in shirts.json. */
  row: number;
  col: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Horizontal centre (%), used for Up/Down keyboard moves between rows of different widths. */
  x: number;
  /** Horizontal anchor of the museum label so it never leaves the photo. */
  h: 'l' | 'c' | 'r';
  /** Vertical placement of the label: below for the top row, above otherwise. */
  v: 'a' | 'b';
}

/**
 * The collector sits in the middle of the bottom row: shirts up to `afterCol` hang left of him,
 * the rest to the right. Photo geometry (src/assets/sciana-kolekcji.webp), % of image width.
 */
const GAP = { row: wallRows.length, afterCol: 9, from: 46.5, to: 53.5 } as const;
/** Labels whose shirt centre is closer than this (% of width) to an edge anchor to that edge. */
const EDGE = 15;

export const buildHotspots = (entries: ShirtEntry[]): Hotspot[] => {
  const placed = entries.filter((e) => e.data.wall);
  const seen = new Set<string>();
  const colsInRow = new Map<number, number>();

  placed.forEach((e) => {
    const { row, col } = e.data.wall!;
    const key = `${row}:${col}`;
    if (row < 1 || row > wallRows.length) throw new Error(`Wall: ${e.id} has row ${row} outside the photo`);
    if (seen.has(key)) throw new Error(`Wall: two shirts at row ${row}, col ${col}`);
    seen.add(key);
    colsInRow.set(row, Math.max(colsInRow.get(row) ?? 0, col));
  });

  const spots = placed.map((entry): Hotspot => {
    const { row, col } = entry.data.wall!;
    const geo = wallRows[row - 1];
    const cols = colsInRow.get(row)!;

    // Split the row into segments around the gap (only the bottom row has one).
    let from = geo.left;
    let to = geo.right;
    let index = col - 1;
    let count = cols;
    if (row === GAP.row && cols > GAP.afterCol) {
      if (col <= GAP.afterCol) {
        to = GAP.from;
        count = GAP.afterCol;
      } else {
        from = GAP.to;
        index = col - GAP.afterCol - 1;
        count = cols - GAP.afterCol;
      }
    }

    const width = (to - from) / count;
    const left = from + width * index;
    const x = left + width / 2;

    return {
      entry,
      row,
      col,
      left,
      top: geo.top,
      width,
      height: geo.bottom - geo.top,
      x,
      h: x < EDGE ? 'l' : x > 100 - EDGE ? 'r' : 'c',
      v: row === 1 ? 'b' : 'a',
    };
  });

  // DOM / reading order: row by row, left to right.
  return spots.sort((a, b) => a.row - b.row || a.col - b.col);
};

export const pct = (n: number): string => `${n.toFixed(3)}%`;
