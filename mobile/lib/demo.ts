// Demo verisi. Backend bağlanana kadar ekranlar buradan beslenir.
// Alan adları ve enum değerleri backend sözleşmesine (docs/api-contract.md,
// backend/prisma/schema.prisma) yakın tutuldu ki API'ye geçiş kolay olsun.
//
// Medya public/demo/ altında durur ve repoya girmez (bkz. .gitignore):
//   image: "/demo/kullanici/1.jpg"   video: "/demo/kullanici/1.mp4"
// Dosya yoksa ya da alan boşsa pastel yer tutucu görünür. Video sessiz ve
// döngüde oynar, `image` varsa yüklenene kadar kapak olur.

export type PollCategory = "OUTFIT" | "SHOES" | "BAG" | "JEWELRY" | "ACCESSORY" | "TATTOO";

export const CATEGORY_LABEL: Record<PollCategory, string> = {
  OUTFIT: "Kombin",
  SHOES: "Ayakkabı",
  BAG: "Çanta",
  JEWELRY: "Takı",
  ACCESSORY: "Aksesuar",
  TATTOO: "Dövme",
};

export type DemoUser = {
  username: string;
  displayName: string;
  initials: string;
  bio?: string;
  avatar?: string;
  styles: string[];
  counts: { polls: number; friends: number; stars: number };
};

export type DemoOption = {
  label: "A" | "B";
  image?: string;
  video?: string;
  tone: string;
  productCount: number;
  percent: number;
};

export type DemoPost = {
  id: string;
  user: string;
  context: string;
  timeLeft: string;
  urgent: boolean;
  category: PollCategory;
  photoLabel: string;
  question: string;
  options: [DemoOption, DemoOption];
  totalVotes: number;
  commentCount: number;
  insight: string;
};

export const ME = "elifyz";

export const me = {
  username: ME,
  streakDays: 12,
  predictionStarsToday: 40,
  activePoll: { votes: 12, timeLeft: "27 dk" },
};

export const users: DemoUser[] = [
  {
    username: "elifyz",
    displayName: "Elif Yılmaz",
    initials: "EY",
    bio: "Minimal dolap, vintage zaaf.",
    styles: ["Minimal", "Vintage", "Sokak stili"],
    counts: { polls: 2, friends: 312, stars: 1240 },
  },
  {
    username: "luis",
    displayName: "Luis",
    initials: "LU",
    avatar: "/demo/luis/5.jpg",
    styles: ["Sokak stili", "Vintage"],
    counts: { polls: 3, friends: 148, stars: 860 },
  },
  {
    username: "louno",
    displayName: "Louno",
    initials: "LO",
    avatar: "/demo/louno/3.jpg",
    styles: ["Sokak stili", "Oversize"],
    counts: { polls: 2, friends: 207, stars: 1015 },
  },
  {
    username: "hannas",
    displayName: "Hannas",
    initials: "HA",
    avatar: "/demo/hannas/2.jpg",
    styles: ["Şık", "Minimal"],
    counts: { polls: 1, friends: 96, stars: 430 },
  },
];

export const posts: DemoPost[] = [
  {
    id: "luis-kahve",
    user: "luis",
    context: "Günlük",
    timeLeft: "18 dk",
    urgent: true,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Şehirde kahve günü. Hangisi?",
    options: [
      { label: "A", image: "/demo/luis/1.jpg", tone: "#E9E2C6", productCount: 3, percent: 64 },
      { label: "B", image: "/demo/luis/4.jpg", tone: "#E8D3D6", productCount: 3, percent: 36 },
    ],
    totalVotes: 186,
    commentCount: 24,
    insight: "186 oy verildi",
  },
  {
    id: "louno-sergi",
    user: "louno",
    context: "Sergi",
    timeLeft: "2 saat",
    urgent: false,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Sergi gezisi için hangisi?",
    options: [
      { label: "A", image: "/demo/louno/3.jpg", tone: "#D2DCE8", productCount: 4, percent: 57 },
      { label: "B", image: "/demo/louno/2.jpg", tone: "#E9E2C6", productCount: 4, percent: 43 },
    ],
    totalVotes: 92,
    commentCount: 9,
    insight: "92 oy verildi",
  },
  {
    id: "hannas-aksam",
    user: "hannas",
    context: "Akşam yürüyüşü",
    timeLeft: "45 dk",
    urgent: false,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Akşam yürüyüşü için hangisi?",
    options: [
      { label: "A", image: "/demo/hannas/1.jpg", tone: "#E8D3D6", productCount: 3, percent: 48 },
      { label: "B", image: "/demo/hannas/2.jpg", tone: "#D9D4CC", productCount: 3, percent: 52 },
    ],
    totalVotes: 241,
    commentCount: 31,
    insight: "241 oy verildi",
  },
  {
    id: "luis-ceket",
    user: "luis",
    context: "Serin akşam",
    timeLeft: "3 saat",
    urgent: false,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Serin akşam için hangi ceket?",
    options: [
      { label: "A", image: "/demo/luis/5.jpg", tone: "#E6D5C8", productCount: 4, percent: 61 },
      { label: "B", image: "/demo/luis/6.jpg", tone: "#D9D4CC", productCount: 3, percent: 39 },
    ],
    totalVotes: 154,
    commentCount: 12,
    insight: "154 oy verildi",
  },
  {
    id: "louno-konser",
    user: "louno",
    context: "Konser",
    timeLeft: "5 saat",
    urgent: false,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Konser akşamı. Hangisi?",
    options: [
      { label: "A", image: "/demo/louno/4.jpg", tone: "#D9D4CC", productCount: 5, percent: 45 },
      { label: "B", image: "/demo/louno/1.jpg", tone: "#CBD8D1", productCount: 5, percent: 55 },
    ],
    totalVotes: 203,
    commentCount: 18,
    insight: "203 oy verildi",
  },
  {
    id: "luis-yaz",
    user: "luis",
    context: "Yaz günü",
    timeLeft: "20 saat",
    urgent: false,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Yaz günü: şort mu, jean mi?",
    options: [
      { label: "A", image: "/demo/luis/2.jpg", tone: "#E8D3D6", productCount: 3, percent: 38 },
      { label: "B", image: "/demo/luis/3.jpg", tone: "#D9D3E6", productCount: 3, percent: 62 },
    ],
    totalVotes: 77,
    commentCount: 6,
    insight: "77 oy verildi",
  },
  {
    id: "ofis-ilk-gun",
    user: "elifyz",
    context: "İş",
    timeLeft: "27 dk",
    urgent: true,
    category: "OUTFIT",
    photoLabel: "Kombin fotoğrafı",
    question: "Yeni işte ilk gün. Hangisi daha iyi?",
    options: [
      { label: "A", tone: "#E8D3D6", productCount: 3, percent: 58 },
      { label: "B", tone: "#D2DCE8", productCount: 2, percent: 42 },
    ],
    totalVotes: 12,
    commentCount: 2,
    insight: "12 oy verildi",
  },
  {
    id: "hafta-sonu-canta",
    user: "elifyz",
    context: "Alışveriş",
    timeLeft: "bitti",
    urgent: false,
    category: "BAG",
    photoLabel: "Çanta fotoğrafı",
    question: "Hafta sonu için hangi çanta?",
    options: [
      { label: "A", tone: "#E9E2C6", productCount: 1, percent: 29 },
      { label: "B", tone: "#D9D3E6", productCount: 1, percent: 71 },
    ],
    totalVotes: 134,
    commentCount: 17,
    insight: "134 oy verildi",
  },
];

// Keşfet akışı kullanıcının kendi paylaşımlarını göstermez.
export const feed: DemoPost[] = posts.filter((p) => p.user !== ME);

export function getUser(username: string): DemoUser | undefined {
  return users.find((u) => u.username === username);
}

export function postsOf(username: string): DemoPost[] {
  return posts.filter((p) => p.user === username);
}

// ── Trendler ────────────────────────────────────────────────────────────
// Ölçüm: ürünün, seçilen (oy alan) kombinlerde kaç kez yer aldığı.
// Doğrudan ürün oyu ya da satış sayısı değildir (mentör notu §4).
// Cinsiyet kırılımı ürünü paylaşanı değil, tercih yapanları anlatır.

export type TrendPeriod = "WEEK" | "MONTH";
export type TrendVoter = "ANY" | "WOMEN" | "MEN";
export type PriceBand = "ALL" | "UNDER_750" | "FROM_750_TO_2000" | "OVER_2000";

export type TrendProduct = {
  id: string;
  title: string;
  brand: string;
  category: PollCategory;
  priceMinor: number;
  tone: string;
  image?: string;
  // Dönem → tercih yapan grubu → seçilme sayısı ve önceki döneme göre sıra farkı.
  picks: Record<TrendPeriod, Record<TrendVoter, number>>;
  rankChange: Record<TrendPeriod, number | "NEW">;
};

export const trendProducts: TrendProduct[] = [
  {
    id: "loafer-kahve",
    title: "Kahverengi deri loafer",
    brand: "Kuzey Sokak",
    category: "SHOES",
    priceMinor: 189900,
    tone: "#E6D5C8",
    picks: { WEEK: { ANY: 214, WOMEN: 121, MEN: 93 }, MONTH: { ANY: 702, WOMEN: 410, MEN: 292 } },
    rankChange: { WEEK: 2, MONTH: 1 },
  },
  {
    id: "blazer-oversize",
    title: "Oversize bej blazer",
    brand: "Atölye Nar",
    category: "OUTFIT",
    priceMinor: 249900,
    tone: "#E9E2C6",
    picks: { WEEK: { ANY: 198, WOMEN: 162, MEN: 36 }, MONTH: { ANY: 811, WOMEN: 640, MEN: 171 } },
    rankChange: { WEEK: 0, MONTH: 0 },
  },
  {
    id: "saten-gomlek",
    title: "Siyah saten gömlek",
    brand: "Lodos",
    category: "OUTFIT",
    priceMinor: 89900,
    tone: "#D9D3E6",
    picks: { WEEK: { ANY: 173, WOMEN: 104, MEN: 69 }, MONTH: { ANY: 498, WOMEN: 301, MEN: 197 } },
    rankChange: { WEEK: 4, MONTH: 2 },
  },
  {
    id: "omuz-cantasi",
    title: "Mini omuz çantası",
    brand: "Beyaz Kiraz",
    category: "BAG",
    priceMinor: 64900,
    tone: "#E8D3D6",
    picks: { WEEK: { ANY: 151, WOMEN: 143, MEN: 8 }, MONTH: { ANY: 560, WOMEN: 529, MEN: 31 } },
    rankChange: { WEEK: -1, MONTH: -2 },
  },
  {
    id: "beyaz-sneaker",
    title: "Beyaz deri sneaker",
    brand: "Kuzey Sokak",
    category: "SHOES",
    priceMinor: 159900,
    tone: "#D2DCE8",
    picks: { WEEK: { ANY: 139, WOMEN: 58, MEN: 81 }, MONTH: { ANY: 655, WOMEN: 270, MEN: 385 } },
    rankChange: { WEEK: -2, MONTH: 0 },
  },
  {
    id: "altin-halka",
    title: "Altın kaplama halka küpe",
    brand: "Beyaz Kiraz",
    category: "JEWELRY",
    priceMinor: 34900,
    tone: "#E9E2C6",
    picks: { WEEK: { ANY: 112, WOMEN: 109, MEN: 3 }, MONTH: { ANY: 344, WOMEN: 331, MEN: 13 } },
    rankChange: { WEEK: "NEW", MONTH: 3 },
  },
  {
    id: "keten-pantolon",
    title: "Bej keten pantolon",
    brand: "Lodos",
    category: "OUTFIT",
    priceMinor: 119900,
    tone: "#CBD8D1",
    picks: { WEEK: { ANY: 97, WOMEN: 44, MEN: 53 }, MONTH: { ANY: 431, WOMEN: 188, MEN: 243 } },
    rankChange: { WEEK: 1, MONTH: -1 },
  },
  {
    id: "deri-kemer",
    title: "Siyah deri kemer",
    brand: "Atölye Nar",
    category: "ACCESSORY",
    priceMinor: 44900,
    tone: "#D9D4CC",
    picks: { WEEK: { ANY: 71, WOMEN: 22, MEN: 49 }, MONTH: { ANY: 263, WOMEN: 90, MEN: 173 } },
    rankChange: { WEEK: -3, MONTH: "NEW" },
  },
];

// Bu sayının altındaki gruplar gösterilmez (küçük örneklem; backend eşiği
// ayrıca belirleyecek, burada yalnızca demo davranışı).
export const TREND_MIN_PICKS = 10;
