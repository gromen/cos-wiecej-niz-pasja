/**
 * Every UI string of the shirt detail page in one place.
 * To add English later: copy the `pl` block to `en` and translate.
 */
export const ui = {
  pl: {
    metaTitle: (player: string, number: number): string =>
      `${player} #${number} – koszulka meczowa Wisły Kraków | Coś więcej niż pasja`,
    metaDraft: (player: string, number: number): string =>
      `${player}, numer ${number} – koszulka Wisły Kraków z kolekcji „Coś więcej niż pasja”. Opis eksponatu w przygotowaniu.`,

    back: 'Kolekcja',
    exhibit: 'Eksponat',
    numberSr: 'numer',
    approx: 'ok.',
    /** Constant accessible name – the state is carried by aria-pressed. */
    flip: 'Obróć koszulkę',
    hintTouch: 'Stuknij koszulkę, by ją obrócić · przesuń w bok – kolejna',
    hintKeys: 'Kliknij koszulkę, by ją obrócić · klawisze ← → – kolejne',
    photoAlt: (side: 'front' | 'back', player: string, number: number): string =>
      `${side === 'front' ? 'Przód' : 'Tył'} koszulki: ${player}, numer ${number}`,

    /** Magnifier toggle (constant name; state in aria-pressed). */
    lens: 'Lupa',
    lensHelp: 'Włącza lupę: strzałki ją przesuwają, Esc lub ponowne naciśnięcie wyłącza. Na ekranie dotykowym przeciągnij palcem po koszulce.',

    originalsTitle: 'Zdjęcia oryginalne',
    originalsLead: 'Nieretuszowane zdjęcia z posta na Instagramie – tak ta koszulka wygląda naprawdę.',
    originalCaption: (index: number): string =>
      `${index === 0 ? 'Przód' : index === 1 ? 'Tył' : `Zdjęcie ${index + 1}`} · zdjęcie z Instagrama`,
    originalAlt: (index: number, player: string, number: number): string =>
      `Oryginalne zdjęcie z Instagrama (${index === 0 ? 'przód' : index === 1 ? 'tył' : `ujęcie ${index + 1}`}): koszulka ${player}, numer ${number}`,
    viewerTitle: 'Zdjęcia oryginalne – przeglądarka',
    viewerClose: 'Zamknij',
    viewerPrev: 'Poprzednie zdjęcie',
    viewerNext: 'Następne zdjęcie',
    viewerHintTouch: 'Uszczypnij lub stuknij dwa razy, by powiększyć · przesuń w bok – kolejne',
    viewerHintKeys: 'Kliknij dwa razy, by powiększyć · klawisze ← → – kolejne · Esc – zamknij',

    placardTitle: 'Metryczka',
    post: (n: number): string => `Post #${n}`,
    labels: {
      player: 'Zawodnik',
      number: 'Numer',
      season: 'Sezon',
      competition: 'Rozgrywki',
      match: 'Mecz',
      kind: 'Typ',
      status: 'Status',
      color: 'Kolor',
      maker: 'Producent',
      sponsor: 'Sponsor',
      signed: 'Autograf',
    },
    yes: 'tak',
    no: 'nie',
    igPost: 'Zobacz post na Instagramie',
    newTab: '(otwiera się w nowej karcie)',

    storyTitle: 'Historia',
    storyBy: '@cos_wiecej_niz_pasja',
    pendingTitle: 'Historia tej koszulki jest w przygotowaniu',
    pendingText:
      'Opisuję kolekcję koszulka po koszulce – mecz, zawodnik, droga do gabloty. Historie pojawiają się najpierw na Instagramie.',
    pendingLink: 'Obserwuj @cos_wiecej_niz_pasja',

    navLabel: 'Inne koszulki z kolekcji',
    prev: 'Poprzednia',
    next: 'Następna',
    all: 'Cała kolekcja',

    disclaimer: 'Nieoficjalna strona kolekcjonerska – nie jest powiązana z TS Wisła Kraków SA.',
  },
} as const;

export const t = ui.pl;
