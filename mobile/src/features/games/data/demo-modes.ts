import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;

// Konsept modlar. Backend'de karşılığı yoktur; yatırımcı/kullanıcı demosu
// için örnek veridir. Marka ve fiyatlar örnektir.
export type GameMode = "budget" | "sponsored";

export const MODES: Record<
  GameMode,
  { title: string; tagline: string; icon: IconName }
> = {
  budget: {
    title: "Bütçe meydan okuması",
    tagline: "Belirlenen bütçeyle temaya en iyi kombini kur.",
    icon: "wallet-outline",
  },
  sponsored: {
    title: "Sponsorlu yarışma",
    tagline: "Markanın temasında yarış, kazanan kombin vitrine çıksın.",
    icon: "ribbon-outline",
  },
};

export const BUDGET = {
  theme: "Sonbahar ofis kombini",
  limitMinor: 500_00,
  pieces: [
    { id: "p1", title: "Krem triko kazak", priceMinor: 179_90, icon: "shirt-outline" },
    { id: "p2", title: "Kahve kumaş pantolon", priceMinor: 219_90, icon: "body-outline" },
    { id: "p3", title: "Siyah loafer", priceMinor: 249_90, icon: "footsteps-outline" },
    { id: "p4", title: "Deri görünümlü çanta", priceMinor: 149_90, icon: "bag-handle-outline" },
    { id: "p5", title: "Ekose oversize ceket", priceMinor: 299_90, icon: "shirt-outline" },
    { id: "p6", title: "Altın halka küpe", priceMinor: 59_90, icon: "diamond-outline" },
    { id: "p7", title: "Beyaz sneaker", priceMinor: 189_90, icon: "footsteps-outline" },
    { id: "p8", title: "Bordo şal", priceMinor: 89_90, icon: "ribbon-outline" },
  ] satisfies { id: string; title: string; priceMinor: number; icon: IconName }[],
};

export const SPONSORED = {
  brand: "Örnek Marka",
  theme: "Şehir şıklığı",
  prize: "1.000 TL hediye çeki + markanın vitrininde yer",
  rules: [
    "Kombinde markanın kataloğundan en az 2 parça kullan.",
    "30 dakika fotoğraf, 30 dakika oylama: Podyum kuralları geçerli.",
    "Kazanan kombin markanın Podyum vitrininde yayınlanır; parçalar ürün bağlantısıyla satılır.",
  ],
  timeline: [
    { label: "Duyuru", value: "Pazartesi" },
    { label: "Katılım", value: "Pzt–Cum" },
    { label: "Final oylaması", value: "Cumartesi" },
  ],
  revenue: [
    "Marka yarışma başına sponsorluk ücreti öder.",
    "Vitrindeki parçalardan satış komisyonu (affiliate) alınır.",
    "Kullanıcı ödül kazanır; marka gerçek tercih verisi görür.",
  ],
};

export function formatTry(minor: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(minor / 100);
}
