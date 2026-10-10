// Önizleme lig kademeleri; gerçek lig puanı oyun API'si bağlanınca gelecek.
const TIERS = [
  { name: "Bronz", from: 0 },
  { name: "Gümüş", from: 500 },
  { name: "Altın", from: 1000 },
  { name: "Platin", from: 2000 },
  { name: "Elmas", from: 3500 },
];

export function leagueFor(stars: number) {
  let index = 0;
  while (index + 1 < TIERS.length && stars >= TIERS[index + 1].from) index++;
  const tier = TIERS[index];
  const next = TIERS[index + 1];
  const span = next ? next.from - tier.from : 0;
  const current = stars - tier.from;
  return {
    name: `${tier.name} Lig`,
    next: next?.name,
    remaining: span - current,
    current,
    span,
    progress: next ? current / span : 1,
  };
}
