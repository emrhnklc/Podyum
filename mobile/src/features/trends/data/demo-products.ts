import type { TrendProduct } from "../types";

export const trendProducts: TrendProduct[] = [
  {
    id: "loafer-kahve",
    title: "Kahverengi deri loafer",
    brand: "Kuzey Sokak",
    category: "SHOES",
    priceMinor: 189900,
    tone: "#E6D5C8",
    picks: {
      WEEK: { ANY: 214, WOMEN: 121, MEN: 93 },
      MONTH: { ANY: 702, WOMEN: 410, MEN: 292 },
    },
    rankChange: { WEEK: 2, MONTH: 1 },
  },
  {
    id: "blazer-oversize",
    title: "Oversize bej blazer",
    brand: "Atölye Nar",
    category: "OUTFIT",
    priceMinor: 249900,
    tone: "#E9E2C6",
    picks: {
      WEEK: { ANY: 198, WOMEN: 162, MEN: 36 },
      MONTH: { ANY: 811, WOMEN: 640, MEN: 171 },
    },
    rankChange: { WEEK: 0, MONTH: 0 },
  },
  {
    id: "saten-gomlek",
    title: "Siyah saten gömlek",
    brand: "Lodos",
    category: "OUTFIT",
    priceMinor: 89900,
    tone: "#D9D3E6",
    picks: {
      WEEK: { ANY: 173, WOMEN: 104, MEN: 69 },
      MONTH: { ANY: 498, WOMEN: 301, MEN: 197 },
    },
    rankChange: { WEEK: 4, MONTH: 2 },
  },
  {
    id: "omuz-cantasi",
    title: "Mini omuz çantası",
    brand: "Beyaz Kiraz",
    category: "BAG",
    priceMinor: 64900,
    tone: "#E8D3D6",
    picks: {
      WEEK: { ANY: 151, WOMEN: 143, MEN: 8 },
      MONTH: { ANY: 560, WOMEN: 529, MEN: 31 },
    },
    rankChange: { WEEK: -1, MONTH: -2 },
  },
  {
    id: "beyaz-sneaker",
    title: "Beyaz deri sneaker",
    brand: "Kuzey Sokak",
    category: "SHOES",
    priceMinor: 159900,
    tone: "#D2DCE8",
    picks: {
      WEEK: { ANY: 139, WOMEN: 58, MEN: 81 },
      MONTH: { ANY: 655, WOMEN: 270, MEN: 385 },
    },
    rankChange: { WEEK: -2, MONTH: 0 },
  },
  {
    id: "altin-halka",
    title: "Altın kaplama halka küpe",
    brand: "Beyaz Kiraz",
    category: "JEWELRY",
    priceMinor: 34900,
    tone: "#E9E2C6",
    picks: {
      WEEK: { ANY: 112, WOMEN: 109, MEN: 3 },
      MONTH: { ANY: 344, WOMEN: 331, MEN: 13 },
    },
    rankChange: { WEEK: "NEW", MONTH: 3 },
  },
  {
    id: "keten-pantolon",
    title: "Bej keten pantolon",
    brand: "Lodos",
    category: "OUTFIT",
    priceMinor: 119900,
    tone: "#CBD8D1",
    picks: {
      WEEK: { ANY: 97, WOMEN: 44, MEN: 53 },
      MONTH: { ANY: 431, WOMEN: 188, MEN: 243 },
    },
    rankChange: { WEEK: 1, MONTH: -1 },
  },
  {
    id: "deri-kemer",
    title: "Siyah deri kemer",
    brand: "Atölye Nar",
    category: "ACCESSORY",
    priceMinor: 44900,
    tone: "#D9D4CC",
    picks: {
      WEEK: { ANY: 71, WOMEN: 22, MEN: 49 },
      MONTH: { ANY: 263, WOMEN: 90, MEN: 173 },
    },
    rankChange: { WEEK: -3, MONTH: "NEW" },
  },
];

// Bu sayının altındaki gruplar gösterilmez (küçük örneklem; backend eşiği
// ayrıca belirleyecek, burada yalnızca demo davranışı).
export const TREND_MIN_PICKS = 10;
