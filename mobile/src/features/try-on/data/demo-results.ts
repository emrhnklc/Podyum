import type { ImageSourcePropType } from "react-native";

// Yatırımcı demosu için hazır "üzerimde dene" sonuçları. Yapay zekâ çağrısı
// yoktur: ürün + kullanıcının belirli kombini eşleşirse önceden hazırlanmış
// mock görsel gösterilir. Görseller uygulamaya gömülüdür (assets/images/try-on);
// backend/scripts/demo-try-on.ts aynı ürünleri ve kombin sorusunu kurar.
type DemoTryOn = {
  // Ürün sayfası yolunda geçen mağaza ürün kimliği.
  productKey: string;
  productImage: ImageSourcePropType;
  outfitQuestion: string;
  result: ImageSourcePropType;
};

export const DEMO_OUTFIT_QUESTION = "Bugünkü kombinim nasıl?";

const DEMOS: DemoTryOn[] = [
  {
    productKey: "p00526325",
    productImage: require("../../../../assets/images/try-on/zara-polo.jpg"),
    outfitQuestion: DEMO_OUTFIT_QUESTION,
    result: require("../../../../assets/images/try-on/zara-polo-result.jpg"),
  },
  {
    productKey: "p00840333",
    productImage: require("../../../../assets/images/try-on/zara-jean.jpg"),
    outfitQuestion: DEMO_OUTFIT_QUESTION,
    result: require("../../../../assets/images/try-on/zara-jean-result.jpg"),
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
