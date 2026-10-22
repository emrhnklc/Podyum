import type { ImageSourcePropType } from "react-native";

// Yatırımcı demosu için hazır "üzerimde dene" sonuçları. Yapay zekâ çağrısı
// yoktur: demo ürünü denenince önceden hazırlanmış mock görsel gösterilir.
// Görseller uygulamaya gömülüdür (assets/images/try-on);
// backend/scripts/demo-try-on.ts aynı ürünleri ve kombin oylamasını kurar.
type DemoTryOn = {
  // Ürün sayfası yolunda geçen mağaza ürün kimliği.
  productKey: string;
  productImage: ImageSourcePropType;
  result: ImageSourcePropType;
};

const DEMOS: DemoTryOn[] = [
  {
    productKey: "p00526325",
    productImage: require("../../../../assets/images/try-on/zara-polo.jpg"),
    result: require("../../../../assets/images/try-on/zara-polo-result.jpg"),
  },
  {
    productKey: "p00840333",
    productImage: require("../../../../assets/images/try-on/zara-jean.jpg"),
    result: require("../../../../assets/images/try-on/zara-jean-result.jpg"),
  },
];

const find = (url?: string | null) =>
  url ? DEMOS.find((demo) => url.includes(demo.productKey)) : undefined;

export function demoProductImage(url?: string | null) {
  return find(url)?.productImage;
}

// Demo ürünü hangi fotoğrafta denenirse denensin hazır sonuç gösterilir;
// sunumda A/B ya da galeri seçimine göre sonuç kaybolmaz.
export function demoTryOnResult(url: string | undefined) {
  return find(url)?.result;
}
