import { posts } from "@/features/polls/data/demo-polls";
import { products } from "@/features/polls/data/demo-products";
import { demoDemographics } from "@/features/polls/data/demo-demographics";
import { demoResults } from "@/features/polls/hooks/use-demo-polls";
import type { TrendProduct, TrendVoter } from "../types";

// Trend listesi demo oylamalardan hesaplanır: bir ürünün sayısı, etiketlendiği
// seçeneklere verilen oyların toplamıdır ("seçilen kombinlerde yer alma").
// Ürün oyu ya da satış değildir. Kadın/erkek ayrımı oylamanın mock
// dağılımından, aylık sayı haftalığın sabit bir katından türetilir.
function build(): TrendProduct[] {
  const totals = new Map<
    string,
    { optionCount: number; week: Record<TrendVoter, number> }
  >();
  for (const post of posts) {
    const results = demoResults(post);
    const [women, men] = demoDemographics(post, results.total).gender;
    for (const option of results.options) {
      const share = results.total ? option.votes / results.total : 0;
      for (const id of option.products) {
        const entry = totals.get(id) ?? {
          optionCount: 0,
          week: { ANY: 0, WOMEN: 0, MEN: 0 },
        };
        entry.optionCount++;
        entry.week.ANY += option.votes;
        entry.week.WOMEN += Math.round(women.count * share);
        entry.week.MEN += Math.round(men.count * share);
        totals.set(id, entry);
      }
    }
  }
  return [...totals].flatMap(([id, entry]) => {
    const product = products[id];
    if (!product) return [];
    const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const monthly = 3.2 + (seed % 9) / 10;
    const scale = (value: number) => Math.round(value * monthly);
    return [
      {
        ...product,
        optionCount: entry.optionCount,
        picks: {
          WEEK: entry.week,
          MONTH: {
            ANY: scale(entry.week.ANY),
            WOMEN: scale(entry.week.WOMEN),
            MEN: scale(entry.week.MEN),
          },
        },
      },
    ];
  });
}

export const trendProducts: TrendProduct[] = build();

// Bu sayının altındaki gruplar gösterilmez (küçük örneklem; backend eşiği
// ayrıca belirleyecek, burada yalnızca demo davranışı).
export const TREND_MIN_PICKS = 10;

// Listede gösterilen en fazla ürün.
export const TREND_LIMIT = 15;
