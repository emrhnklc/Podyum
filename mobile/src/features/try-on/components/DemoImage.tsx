import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";

// Uygulamaya gömülü demo görseli. cover kapsayıcıyı doldurur, contain ürünü kırpmaz.
export function DemoImage({
  source,
  tone,
  fit = "cover",
}: {
  source: ImageSourcePropType;
  tone: string;
  fit?: "cover" | "contain";
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: tone }]}>
      {/* Web'de gömülü görsel kendi piksel boyutunu alır; boyut açıkça verilir. */}
      <Image source={source} resizeMode={fit} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
