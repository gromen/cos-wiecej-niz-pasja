/**
 * Seed data for prototypes.
 *
 * `featured` – two real entries transcribed from @cos_wiecej_niz_pasja posts.
 * `wall` – every shirt visible on the collection wall photo
 *   (src/assets/sciana-kolekcji.webp, 1440×834), row by row, left → right.
 *   Names marked `?` were not legible in the photo.
 *   Row geometry (approx., % of image): see `wallRows`.
 */

export type ShirtKind = 'home' | 'away' | 'third' | 'goalkeeper' | 'special';

export interface Shirt {
  no: number; // collection number (#93 in IG posts)
  player: string;
  number: number; // squad number
  season: string;
  occasion?: string;
  kind: ShirtKind;
  matchWorn: boolean;
  signed: boolean;
  maker?: string;
  story: { pl: string; en: string };
  instagram?: string;
}

export const COLLECTION_SIZE = 86;

export const featured: Shirt[] = [
  {
    no: 93,
    player: 'Ivica Iliev',
    number: 77,
    season: '2026/27',
    occasion: 'Wisła Royal Day',
    kind: 'special',
    matchWorn: true,
    signed: true,
    maker: 'Kappa',
    story: {
      pl: 'Grana koszulka Ivicy Ilieva z wydarzenia „Royal Day Wisła” – mecz pełen wspomnień o piłkarzach, których grą zachwycałem się jako dziecko.',
      en: 'Match-worn shirt of Ivica Iliev from the “Wisła Royal Day” – a game full of memories of players I admired as a kid.',
    },
    instagram: 'https://www.instagram.com/p/DfJ3knADisd/',
  },
  {
    no: 92,
    player: 'Wojciech Łobodziński',
    number: 21,
    season: '2008/09',
    occasion: 'el. Ligi Mistrzów',
    kind: 'home',
    matchWorn: false,
    signed: false,
    maker: 'Umbro',
    story: {
      pl: 'Koszulka przygotowana na eliminacje Ligi Mistrzów dla Wojciecha Łobodzińskiego – 70 meczów w Wiśle i 23 w reprezentacji Polski.',
      en: 'Prepared for the Champions League qualifiers for Wojciech Łobodziński – 70 games for Wisła and 23 caps for Poland.',
    },
    instagram: 'https://www.instagram.com/p/De3xhHGjsZj/',
  },
];

export type WallShirt = { player: string; number: number; color: 'red' | 'white' | 'blue' | 'green' | 'other' };

/** Approximate geometry of the 5 rows on the wall photo, in % of image size. */
export const wallRows = [
  { top: 13.5, bottom: 28.5, left: 6.5, right: 90.5 },
  { top: 28.0, bottom: 42.0, left: 6.5, right: 90.5 },
  { top: 41.5, bottom: 56.0, left: 7.0, right: 90.5 },
  { top: 55.5, bottom: 70.5, left: 6.0, right: 90.0 },
  // Row 5 has a gap (the collector sits between "Duda 41" and "Świątko 49", ~46.5%–53.5%)
  { top: 68.5, bottom: 82.0, left: 4.5, right: 94.0 },
];

export const wall: WallShirt[][] = [
  [
    { player: 'Mączyński', number: 29, color: 'blue' },
    { player: 'Pawłowski', number: 99, color: 'blue' },
    { player: 'Peszko', number: 7, color: 'blue' },
    { player: 'Wasilewski', number: 27, color: 'red' },
    { player: 'Klemenz', number: 5, color: 'red' },
    { player: 'Basha', number: 10, color: 'blue' },
    { player: 'Wojtkowski', number: 26, color: 'red' },
    { player: 'Korczyn', number: 51, color: 'white' },
    { player: 'Jović', number: 5, color: 'red' },
    { player: 'Zé Manuel', number: 70, color: 'white' },
    { player: 'Hołownia', number: 14, color: 'red' },
    { player: 'M. Zając', number: 15, color: 'red' },
    { player: 'Głowacki', number: 6, color: 'blue' },
    { player: 'Mączyński', number: 29, color: 'blue' },
    { player: 'Czekaj', number: 3, color: 'white' },
    { player: 'Buchalik', number: 22, color: 'blue' },
    { player: 'Broda', number: 48, color: 'green' },
  ],
  [
    { player: 'Cwielong', number: 86, color: 'red' },
    { player: '?', number: 24, color: 'red' },
    { player: 'Boguski', number: 9, color: 'white' },
    { player: 'Yeboah', number: 40, color: 'red' },
    { player: 'Basha', number: 20, color: 'red' },
    { player: 'Zieńczuk', number: 17, color: 'red' },
    { player: 'Chuca', number: 18, color: 'white' },
    { player: 'Plewka', number: 80, color: 'white' },
    { player: 'Wasilewski', number: 27, color: 'blue' },
    { player: 'Błaszczykowski', number: 16, color: 'red' },
    { player: 'Guzmics', number: 26, color: 'white' },
    { player: 'Burliga', number: 21, color: 'red' },
    { player: 'Cleber', number: 25, color: 'blue' },
    { player: 'Zając', number: 36, color: 'green' },
    { player: 'Małecki', number: 19, color: 'red' },
    { player: 'Paweł Brożek', number: 23, color: 'red' },
    { player: 'Sadlok', number: 4, color: 'red' },
  ],
  [
    { player: 'Ekwueme', number: 26, color: 'red' },
    { player: 'Buchalik', number: 22, color: 'green' },
    { player: 'Mójta', number: 15, color: 'red' },
    { player: 'Gruszkowski', number: 20, color: 'red' },
    { player: 'Manu', number: 28, color: 'blue' },
    { player: 'Colley', number: 5, color: 'white' },
    { player: 'Biegański', number: 31, color: 'green' },
    { player: 'Jaliens', number: 2, color: 'blue' },
    { player: 'Głowacki', number: 6, color: 'red' },
    { player: 'L. Fernández', number: 10, color: 'red' },
    { player: 'Sadlok', number: 4, color: 'red' },
    { player: 'Lamey', number: 31, color: 'white' },
    { player: 'Broda', number: 1, color: 'blue' },
    { player: 'Szywacz', number: 53, color: 'red' },
    { player: 'Biegański', number: 31, color: 'blue' },
    { player: '?', number: 12, color: 'other' },
    { player: 'Basha', number: 66, color: 'red' },
  ],
  [
    { player: 'Pawełek', number: 81, color: 'blue' },
    { player: 'Uryga', number: 6, color: 'red' },
    { player: 'Małecki', number: 19, color: 'blue' },
    { player: 'Satrústegui', number: 19, color: 'white' },
    { player: 'Juszczyk', number: 12, color: 'other' },
    { player: 'Szota', number: 17, color: 'red' },
    { player: 'Sobczak', number: 23, color: 'red' },
    { player: 'Broda', number: 46, color: 'green' },
    { player: 'Starzyński', number: 54, color: 'blue' },
    { player: 'Rodado', number: 9, color: 'red' },
    { player: 'Cissé', number: 70, color: 'red' },
    { player: 'Młyński', number: 11, color: 'red' },
    { player: 'Łasicki', number: 26, color: 'red' },
    { player: 'Letkiewicz', number: 28, color: 'other' },
    { player: 'Fred', number: 10, color: 'blue' },
    { player: 'Kiss', number: 13, color: 'red' },
    { player: 'Zwoliński', number: 99, color: 'white' },
  ],
  [
    { player: 'Małecki', number: 19, color: 'red' },
    { player: 'Sobolewski', number: 7, color: 'white' },
    { player: 'Żyro', number: 14, color: 'white' },
    { player: 'Sukiennicki', number: 19, color: 'red' },
    { player: 'Jović', number: 5, color: 'white' },
    { player: '?', number: 13, color: 'blue' },
    { player: 'Broda', number: 1, color: 'green' },
    { player: 'Boguski', number: 9, color: 'red' },
    { player: 'Duda', number: 41, color: 'red' },
    { player: 'Świątko', number: 49, color: 'white' },
    { player: 'Ondrášek', number: 14, color: 'white' },
    { player: '?', number: 7, color: 'other' },
    { player: 'Buchalik', number: 22, color: 'other' },
    { player: 'Buksa', number: 44, color: 'red' },
    { player: 'Duda', number: 41, color: 'red' },
    { player: 'Letkiewicz', number: 28, color: 'other' },
    { player: 'Łobodziński', number: 21, color: 'red' },
    { player: 'Iliev', number: 77, color: 'red' },
  ],
];

export const socials = {
  instagram: 'https://www.instagram.com/cos_wiecej_niz_pasja/',
  facebook: 'https://www.facebook.com/profile.php?id=100076397941904',
};
