import type { PollCategory } from "@/constants/poll-categories";
import type { DemoProduct } from "../types";

// Demo kombin fotoğraflarında görünen parçalar. Başlıklar fotoğrafa bakılarak
// yazıldı; marka ve gerçek ürün eşleşmesi yoktur. Bağlantılar belirli bir
// ürüne değil, benzer ürün aramasına gider. Fiyatlar örnektir.
function product(
  id: string,
  title: string,
  category: PollCategory,
  priceMinor: number,
  tone: string,
  query: string,
): DemoProduct {
  return {
    id,
    title,
    category,
    priceMinor,
    tone,
    image: `/demo/products/${id}.jpg`,
    query,
  };
}

const list: DemoProduct[] = [
  product("beyaz-tisort", "Beyaz basic tişört", "OUTFIT", 49900, "#E9E2C6", "beyaz basic erkek tişört"),
  product("leopar-jean", "Leopar desenli beyaz bol jean", "OUTFIT", 189900, "#E9E2C6", "leopar desenli beyaz baggy jean"),
  product("kahve-loafer", "Kahverengi deri loafer", "SHOES", 249900, "#E6D5C8", "kahverengi deri loafer erkek"),
  product("gunes-gozlugu", "İnce çerçeve güneş gözlüğü", "ACCESSORY", 59900, "#D9D4CC", "ince çerçeve dikdörtgen güneş gözlüğü"),
  product("baskili-tisort", "Yazı baskılı kırık beyaz tişört", "OUTFIT", 69900, "#E8D8CC", "yazı baskılı kırık beyaz tişört"),
  product("siyah-bol-pantolon", "Siyah bol paça pantolon", "OUTFIT", 149900, "#D9D4CC", "siyah bol paça erkek pantolon"),
  product("parmak-arasi", "Siyah parmak arası terlik", "SHOES", 39900, "#E8D8CC", "siyah parmak arası terlik"),
  product("bej-bomber", "Bej süet görünümlü kolej ceket", "OUTFIT", 399900, "#E6D5C8", "bej süet kolej ceket varsity"),
  product("yirtik-bol-jean", "Açık mavi yırtık bol jean", "OUTFIT", 179900, "#D9D6CF", "açık mavi yırtık baggy jean"),
  product("beyaz-sneaker", "Kırık beyaz bilekli kanvas sneaker", "SHOES", 279900, "#E9E2C6", "kırık beyaz bilekli kanvas sneaker"),
  product("yagli-ceket", "Haki mumlu pamuk ceket", "OUTFIT", 499900, "#D9D4CC", "haki mumlu pamuk ceket erkek"),
  product("koyu-bol-jean", "Füme bol paça jean", "OUTFIT", 169900, "#D9D4CC", "füme bol paça jean"),
  product("siyah-tisort", "Siyah basic tişört", "OUTFIT", 49900, "#D9D4CC", "siyah basic erkek tişört"),
  product("ekose-sort", "Mavi ekose bermuda şort", "OUTFIT", 89900, "#D9D6CF", "mavi ekose bermuda şort erkek"),
  product("mor-tisort", "Mor baskılı tişört", "OUTFIT", 69900, "#DDD5CC", "mor baskılı tişört"),
  product("bol-mavi-jean", "Mavi bol kesim jean", "OUTFIT", 159900, "#D9D6CF", "mavi bol kesim jean"),
  product("kirmizi-sneaker", "Kırmızı deri sneaker", "SHOES", 329900, "#E8D8CC", "kırmızı deri sneaker"),
  product("zincir-kolye", "Gümüş zincir kolye", "JEWELRY", 44900, "#DDD5CC", "gümüş zincir kolye haç uçlu"),
  product("cizgili-gomlek", "Mavi çizgili gömlek", "OUTFIT", 119900, "#D9D6CF", "mavi çizgili kadın gömlek"),
  product("kravat-kemer", "Kemer olarak bağlanan bordo kravat", "ACCESSORY", 34900, "#E8D8CC", "bordo desenli kravat"),
  product("trenckot", "Haki trençkot", "OUTFIT", 449900, "#E9E2C6", "haki oversize trençkot"),
  product("rugby-polo", "Sarı lacivert rugby polo", "OUTFIT", 139900, "#E9E2C6", "sarı lacivert rugby polo sweatshirt"),
  product("lacivert-bol-pantolon", "Lacivert bol paça pantolon", "OUTFIT", 159900, "#D9D6CF", "lacivert bol paça pantolon"),
  product("bordo-clutch", "Bordo deri el çantası", "BAG", 129900, "#E8D8CC", "bordo deri clutch çanta"),
  product("sari-sneaker", "Sarı sneaker", "SHOES", 289900, "#E9E2C6", "sarı sneaker"),
  product("deri-bomber", "Siyah deri bomber ceket", "OUTFIT", 549900, "#D9D4CC", "siyah deri bomber ceket"),
  product("siyah-bol-jean", "Siyah yıkamalı baggy jean", "OUTFIT", 179900, "#D9D4CC", "siyah yıkamalı baggy jean"),
  product("siyah-sapka", "Siyah düz siperli şapka", "ACCESSORY", 79900, "#D9D4CC", "siyah düz siperli şapka"),
  product("siyah-omuz-cantasi", "Siyah omuz çantası", "BAG", 189900, "#D9D4CC", "siyah baget omuz çantası"),
  product("postal-bot", "Kalın tabanlı siyah bot", "SHOES", 349900, "#D9D4CC", "kalın tabanlı siyah postal bot"),
  product("kot-ceket", "Koyu mavi kot ceket", "OUTFIT", 219900, "#D9D6CF", "koyu mavi oversize kot ceket"),
  product("kamuflaj-bermuda", "Kamuflaj kargo bermuda", "OUTFIT", 129900, "#D8D3C6", "kamuflaj kargo bermuda"),
  product("topuklu-bot", "Sivri burun topuklu siyah bot", "SHOES", 319900, "#D9D4CC", "sivri burun topuklu siyah bot"),
  product("kamuflaj-sapka", "Kamuflaj şapka", "ACCESSORY", 59900, "#D8D3C6", "kamuflaj beyzbol şapkası"),
  product("bordo-bluz", "Bordo pelerin kollu bluz", "OUTFIT", 109900, "#E8D8CC", "bordo pelerin kollu bluz"),
  product("beyaz-bol-pantolon", "Beyaz bol paça pantolon", "OUTFIT", 139900, "#E9E2C6", "beyaz bol paça kadın pantolon"),
  product("krem-canta", "Krem omuz çantası", "BAG", 99900, "#E9E2C6", "krem omuz çantası"),
  product("yun-kaban", "Kahverengi kısa yün kaban", "OUTFIT", 459900, "#E6D5C8", "kahverengi kısa yün kaban kadın"),
];

export const products: Record<string, DemoProduct> = Object.fromEntries(
  list.map((item) => [item.id, item]),
);

export function getProducts(ids: string[]): DemoProduct[] {
  return ids.flatMap((id) => (products[id] ? [products[id]] : []));
}

// Belirli bir mağaza ürünü değil; aynı tarife uyan ürünlerin alışveriş araması.
export function productSearchUrl(item: DemoProduct): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.query)}`;
}

export function formatPrice(priceMinor: number): string {
  return `${(priceMinor / 100).toLocaleString("tr-TR")} TL`;
}
