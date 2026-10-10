// Lig kademeleri ve defile puanları. Mobil `features/games/data/league.ts` ile
// aynı sınırları kullanır; değişirse ikisi birlikte güncellenir.
const TIERS = [
  { name: "Bronz", from: 0 },
  { name: "Gümüş", from: 500 },
  { name: "Altın", from: 1000 },
  { name: "Platin", from: 2000 },
  { name: "Elmas", from: 3500 },
];
// Herkese açık defilede ilk üç sıranın puanı; oy almayan kombin puan almaz.
export const RANK_POINTS = [50, 30, 20];

export function leagueFor(points: number) {
  let index = 0;
  while (index + 1 < TIERS.length && points >= TIERS[index + 1].from) index++;
  const tier = TIERS[index];
  const next = TIERS[index + 1];
  return {
    name: `${tier.name} Lig`,
    nextName: next ? `${next.name} Lig` : null,
    current: points - tier.from,
    span: next ? next.from - tier.from : null,
    remaining: next ? next.from - points : null,
  };
}
