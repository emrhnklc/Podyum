// Yatırımcı demosu için hazır "üzerimde dene" sonuçları. Yapay zekâ çağrısı
// yoktur: ürün + kullanıcının belirli kombini eşleşirse önceden hazırlanmış
// mock görsel gösterilir. Görseller Git dışındadır (public/demo/try-on/);
// backend/scripts/demo-try-on.ts aynı ürün ve kombin sorusunu kurar.
type DemoTryOn = {
  // Ürün sayfası yolunda geçen mağaza ürün kimliği.
  productKey: string;
  productImage: string;
  outfitQuestion: string;
  result: string;
};

const DEMOS: DemoTryOn[] = [
  {
    productKey: "p00526325",
    productImage: "/demo/try-on/zara-polo.jpg",
    outfitQuestion: "Bugünkü kombinim nasıl?",
    result: "/demo/try-on/zara-polo-result.jpg",
  },
];

const find = (url?: string | null) =>
  url ? DEMOS.find((demo) => url.includes(demo.productKey)) : undefined;

export function demoProductImage(url?: string | null) {
  return find(url)?.productImage;
}

// Yalnız demo ürünü, demo kombininin ilk fotoğrafında denenirse sonuç vardır.
export function demoTryOnResult(
  url: string | undefined,
  outfit: { question: string; position: number } | null,
) {
  const demo = find(url);
  if (!demo || !outfit) return undefined;
  return outfit.question === demo.outfitQuestion && outfit.position === 1
    ? demo.result
    : undefined;
}
