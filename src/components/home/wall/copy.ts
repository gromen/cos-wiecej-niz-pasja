/** All user-facing strings of the „Ściana” section (Polish). */

/** Polish plural: 1 koszulka, 2–4 koszulki, 5+ koszulek (12–14 always „koszulek”). */
const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
};

const shirts = (n: number) => `${n} ${plural(n, 'koszulka', 'koszulki', 'koszulek')}`;

export const copy = {
  eyebrow: 'Ściana kolekcji',
  title: { lead: 'Cała', accent: 'ściana' },
  lede: (total: number) => `${shirts(total)} na jednym płocie.`,
  ledeMore: 'Każda ma swój mecz, swoje nazwisko i swoją historię – wskaż koszulkę, a powie, czyja jest.',
  sash: (total: number, rows: number) => [
    'Cała ściana',
    shirts(total),
    `${rows} ${plural(rows, 'rząd', 'rzędy', 'rzędów')}`,
    'jeden płot',
  ],
  photoAlt: (total: number, rows: number) =>
    `Ściana kolekcji: ${shirts(total)} Wisły Kraków powieszonych w ${rows} rzędach na ogrodzeniu; w środku dolnego rzędu siedzi kolekcjoner.`,
  groupLabel: 'Koszulki na ścianie',
  linkName: (player: string, number: number, draft: boolean) =>
    `${player}, numer ${number}${draft ? ' – dane w przygotowaniu' : ''}`,
  tagNumber: (number: number) => `Nr ${number}`,
  tagDraft: 'w przygotowaniu',
  helpHover: 'Najedź na koszulkę, by zobaczyć podpis. Kliknij, by ją otworzyć.',
  helpTouch: 'Dotknij koszulki, by zobaczyć podpis. Dotknij ponownie, by ją otworzyć.',
  helpKeys: 'Strzałki przesuwają po ścianie, Home i End – na początek i koniec rzędu, Enter otwiera koszulkę.',
  stats: (total: number, described: number) =>
    `${shirts(total)} · ${described} ${plural(described, 'opisana', 'opisane', 'opisanych')}, reszta w przygotowaniu`,
  pan: 'Przesuń',
} as const;
