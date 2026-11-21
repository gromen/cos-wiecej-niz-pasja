// One-off seed: 7 real entries (transcribed from @cos_wiecej_niz_pasja posts #87–#93)
// + placeholders for the remaining shirts from the wall photo (src/data/collection.ts).
// Run: node scripts/seed-shirts.mjs  → writes src/content/shirts.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const lastName = (player) => player.split(' ').at(-1);

const real = [
  {
    igPost: 93,
    player: 'Ivica Iliev',
    number: 77,
    season: '2026/27',
    seasonStart: 2026,
    competition: 'Wisła Royal Day',
    kind: 'special',
    color: 'red',
    status: 'match-worn',
    signed: true,
    maker: 'Kappa',
    sponsor: 'Superbet',
    story: {
      pl: 'Grana koszulka Ivicy Ilieva z wydarzenia „Royal Day Wisła”. Mecz był świetną okazją do wspomnień – na boisku zobaczyłem piłkarzy, których grą zachwycałem się jako dziecko, a później nastolatek przed telewizorem.',
      en: 'Match-worn shirt of Ivica Iliev from the “Wisła Royal Day”. The game brought back memories – on the pitch I saw players I admired as a kid and later as a teenager in front of the TV.',
    },
    instagram: 'https://www.instagram.com/p/DfJ3knADisd/',
  },
  {
    igPost: 92,
    player: 'Wojciech Łobodziński',
    number: 21,
    season: '2008/09',
    seasonStart: 2008,
    competition: 'el. Ligi Mistrzów',
    kind: 'home',
    color: 'red',
    status: 'match-issued',
    signed: false,
    maker: 'Umbro',
    sponsor: 'TF Kable',
    story: {
      pl: 'Koszulka przygotowana na eliminacje Ligi Mistrzów dla Wojciecha Łobodzińskiego, który w Wiśle rozegrał 70 meczów oraz 23 w pierwszej reprezentacji Polski.',
      en: 'Prepared for the Champions League qualifiers for Wojciech Łobodziński, who played 70 games for Wisła and won 23 caps for Poland.',
    },
    instagram: 'https://www.instagram.com/p/De3xhHGjsZj/',
  },
  {
    igPost: 91,
    player: 'Patryk Letkiewicz',
    number: 28,
    season: '2025/26',
    seasonStart: 2025,
    competition: 'STS Puchar Polski',
    match: { pl: 'I runda: Odra Bytom Odrzański – Wisła Kraków 0:1 (Rodado), 25.09.2025', en: 'Round 1: Odra Bytom Odrzański – Wisła Kraków 0:1 (Rodado), 25 Sep 2025' },
    kind: 'goalkeeper',
    color: 'orange',
    status: 'match-worn',
    signed: true,
    maker: 'Kappa',
    sponsor: 'Texom',
    story: {
      pl: 'Patryk rozegrał całe 90 minut. Zabrudzenie przy patchu STS potwierdza na 99 procent, że koszulka była użyta w meczu. Przy jej przesyłce była mała afera z Pocztą Polską – ale finalnie wszystko skończyło się dobrze.',
      en: 'Patryk played the full 90 minutes. A stain next to the STS patch makes it 99% certain the shirt was worn in the game. Its delivery caused a small drama with the Polish Post – but it all ended well.',
    },
    instagram: 'https://www.instagram.com/p/Ddyhb8Zjr-w/',
  },
  {
    igPost: 90,
    player: 'Kacper Duda',
    number: 41,
    season: '2025/26',
    seasonStart: 2025,
    competition: 'Fortuna 1 Liga',
    match: { pl: '27. kolejka: Wisła Kraków – Górnik Łęczna 3:2 (Fred, Božić, Ertlthaler), 6.04.2026', en: 'Matchday 27: Wisła Kraków – Górnik Łęczna 3:2 (Fred, Božić, Ertlthaler), 6 Apr 2026' },
    kind: 'home',
    color: 'red',
    status: 'match-worn',
    signed: true,
    maker: 'Kappa',
    sponsor: 'Texom',
    story: {
      pl: 'Kacper Duda rozegrał w niej 83 minuty, zmienił go Marc Carbo. Wyjątkowa koszulka z akcją „1,5% podatku” dla Fundacji Wisły Kraków.',
      en: 'Kacper Duda played 83 minutes in it before being replaced by Marc Carbo. A special shirt promoting the “1.5% tax” campaign for the Wisła Kraków Foundation.',
    },
    instagram: 'https://www.instagram.com/p/DX1mBE0gpti/',
  },
  {
    igPost: 89,
    player: 'Aleksander Buksa',
    number: 44,
    season: '2020/21',
    seasonStart: 2020,
    competition: 'PKO Ekstraklasa',
    kind: 'home',
    color: 'red',
    status: 'unconfirmed',
    signed: false,
    sponsor: 'Łączy nas pasja',
    story: {
      pl: 'Aleksander nie był jeszcze pełnoletni, więc nie mógł grać w koszulce z logo bukmachera LV BET – stąd napis „Łączy nas pasja”.',
      en: 'Aleksander was not yet 18, so he could not wear a shirt with the LV BET bookmaker logo – hence the “Łączy nas pasja” (“Passion unites us”) print.',
    },
    instagram: 'https://www.instagram.com/p/DWv4KyaDAQl/',
  },
  {
    igPost: 88,
    player: 'Michał Buchalik',
    number: 22,
    season: '2015/16',
    seasonStart: 2015,
    competition: 'Ekstraklasa',
    kind: 'goalkeeper',
    color: 'yellow',
    status: 'match-issued',
    signed: true,
    maker: 'adidas',
    sponsor: 'Telefonika',
    story: {
      pl: 'Koszulka bramkarska przygotowana na sezon 2015/16 – pierwsza żółta koszulka w kolekcji, od której zacząłem kolejny rok zbierania.',
      en: 'Goalkeeper shirt prepared for the 2015/16 season – the first yellow shirt in the collection and the start of another collecting year.',
    },
    instagram: 'https://www.instagram.com/p/DUQWxmGDMK3/',
  },
  {
    igPost: 87,
    player: 'Andrzej Iwan',
    number: 7,
    season: 'lata 70/80',
    seasonStart: 1979,
    seasonApprox: true,
    competition: 'I liga',
    kind: 'home',
    color: 'red',
    status: 'unconfirmed',
    signed: true,
    story: {
      pl: 'Najstarsza i najbardziej kontrowersyjna koszulka w kolekcji – z podpisem śp. Andrzeja Iwana. Nie znalazłem jeszcze nic, co potwierdzałoby, że jest meczowa. Jest kilka teorii – może razem ustalimy, czy Pan Andrzej rzeczywiście w niej grał i w którym sezonie.',
      en: 'The oldest and most controversial shirt in the collection – signed by the late Andrzej Iwan. I have not yet found proof that it was match-worn. There are a few theories – maybe together we can find out whether he really played in it, and in which season.',
    },
    instagram: 'https://www.instagram.com/p/DS2nEoujPUm/',
  },
];

// IG posts #87–#93 are the last 7 shirts of the bottom wall row (row 5, columns 12–18),
// hung in acquisition order. Real entries take those wall slots; no placeholders there.
const wallSlotByPost = { 87: 12, 88: 13, 89: 14, 90: 15, 91: 16, 92: 17, 93: 18 };
const coveredSlots = new Set(Object.values(wallSlotByPost).map((col) => `5-${col}`));

const src = readFileSync(new URL('../src/data/collection.ts', import.meta.url), 'utf8');
const wallSrc = src.slice(src.indexOf('export const wall'));
const rows = wallSrc.split(/\n\s*\],\s*\n\s*\[/);
const entryRe = /\{ player: '([^']+)', number: (\d+), color: '(\w+)' \}/g;

const placeholders = [];
rows.forEach((rowSrc, r) => {
  [...rowSrc.matchAll(entryRe)].forEach((m, c) => {
    const [, player, num, color] = m;
    if (coveredSlots.has(`${r + 1}-${c + 1}`)) return;
    const known = player !== '?';
    placeholders.push({
      id: `${known ? slugify(player) : 'nieznany'}-${num}-r${r + 1}k${String(c + 1).padStart(2, '0')}`,
      player: known ? player : 'Do uzupełnienia',
      number: Number(num),
      kind: color === 'green' ? 'goalkeeper' : 'unknown',
      color: color === 'other' ? 'other' : color,
      status: 'unconfirmed',
      signed: false,
      draft: true,
      wall: { row: r + 1, col: c + 1 },
    });
  });
});

// Real photos produced by scripts/cutout.py (paths relative to src/content/shirts.json).
const photosFor = (post) => {
  const dir = new URL(`../src/assets/shirts/${post}/`, import.meta.url);
  if (!existsSync(dir)) return {};
  const files = readdirSync(dir);
  const rel = (f) => `../assets/shirts/${post}/${f}`;
  const images = {};
  if (files.includes('front.png')) images.front = rel('front.png');
  if (files.includes('back.png')) images.back = rel('back.png');
  const originals = files.filter((f) => f.startsWith('original-')).sort().map(rel);
  return {
    ...(Object.keys(images).length ? { images } : {}),
    ...(originals.length ? { originals } : {}),
  };
};

const realEntries = real.map((s) => ({
  id: `${s.igPost}-${slugify(lastName(s.player))}-${s.number}`,
  ...s,
  draft: false,
  wall: { row: 5, col: wallSlotByPost[s.igPost] },
  ...photosFor(s.igPost),
}));

const all = [...realEntries, ...placeholders];
mkdirSync(new URL('../src/content/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/content/shirts.json', import.meta.url), `${JSON.stringify(all, null, 2)}\n`);
console.log(`real: ${realEntries.length}, placeholders: ${placeholders.length}, total: ${all.length}`);
