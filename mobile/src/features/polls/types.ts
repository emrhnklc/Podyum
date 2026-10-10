import type { PollCategory } from "@/constants/poll-categories";

export type DemoOption = {
  label: "A" | "B";
  image?: string;
  video?: string;
  tone: string;
  // Seçenekte etiketlenen parçalar; data/demo-products.ts içindeki kimlikler.
  products: string[];
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

export type DemoProduct = {
  id: string;
  title: string;
  category: PollCategory;
  // Örnek fiyat; gerçek mağaza fiyatı değildir.
  priceMinor: number;
  tone: string;
  // Kombin fotoğrafından kırpılmış küçük görsel (public/demo/products/).
  image: string;
  // Benzer ürün aramasında kullanılan sorgu.
  query: string;
};
