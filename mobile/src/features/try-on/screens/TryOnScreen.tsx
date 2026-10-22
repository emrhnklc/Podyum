import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { brand, colors, common, fonts } from "@/theme";

export type TryOnProduct = {
  title: string;
  brand?: string;
  price?: string;
  url?: string;
};

type Step = "intro" | "pick" | "working" | "result";

const WORK_MS = 2400;

// Plus konsepti: ürünü kendi kombin fotoğrafında deneme. Bu ekran DEMODUR;
// ödeme alınmaz, fotoğraf sunucuya gönderilmez ve yapay zekâ görsel üretmez.
// Gerçek akışta fotoğraf + ürün görseli bir sanal deneme servisine gider.
export function TryOnScreen({ product }: { product: TryOnProduct }) {
  const [step, setStep] = useState<Step>("intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const message = usePreviewMessage();
  useEffect(() => {
    if (step !== "working") return;
    const timer = setTimeout(() => setStep("result"), WORK_MS);
    return () => clearTimeout(timer);
  }, [step]);

  async function pick() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
      });
      if (result.canceled) return;
      setPhoto(result.assets[0].uri);
      setStep("working");
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }
  async function openProduct() {
    if (!product.url || !/^https?:\/\//i.test(product.url)) return;
    try {
      await Linking.openURL(product.url);
    } catch {
      message("Ürün bağlantısı açılamadı.");
    }
  }

  return (
    <Screen>
      <BackButton />
      <View style={styles.demo}>
        <Ionicons name="flask-outline" size={16} color={brand.accentDark} />
        <Text style={styles.demoText}>
          Demo: ödeme alınmaz, fotoğrafın cihazından çıkmaz.
        </Text>
      </View>
      <View style={common.row}>
        <Text style={common.title}>Üzerimde dene</Text>
        <View style={styles.plus}>
          <Text style={styles.plusText}>PLUS</Text>
        </View>
      </View>
      <ProductCard product={product} />

      {step === "intro" && (
        <>
          <View style={[common.card, { gap: 12 }]}>
            {[
              ["sparkles-outline", "Beğendiğin parçayı kendi kombin fotoğrafında gör."],
              ["shirt-outline", "Paylaşılan linklerdeki ürünler fotoğrafına giydirilir."],
              ["shield-checkmark-outline", "Fotoğrafın yalnız deneme için kullanılır, paylaşılmaz."],
            ].map(([icon, text]) => (
              <View key={text} style={common.row}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={brand.accent}
                />
                <Text style={{ flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
          <Button
            title="Plus demosunu başlat"
            icon={<Ionicons name="sparkles" size={18} color={colors.onAccent} />}
            onPress={() => setStep("pick")}
          />
          <Text style={styles.note}>
            Plus fiyatı ve deneme hakkı henüz belirlenmedi.
          </Text>
        </>
      )}

      {step === "pick" && (
        <View style={[common.card, { alignItems: "center", gap: 14 }]}>
          <Ionicons name="image-outline" size={44} color={brand.accent} />
          <Text style={{ textAlign: "center", fontFamily: fonts.semibold }}>
            Boydan çekilmiş, iyi ışıklı bir kombin fotoğrafı seç.
          </Text>
          <Button title="Fotoğrafımı seç" onPress={() => void pick()} />
        </View>
      )}

      {step === "working" && photo && (
        <View style={styles.frame}>
          <Image source={{ uri: photo }} style={styles.photo} blurRadius={8} />
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.onAccent} size="large" />
            <Text style={styles.overlayText}>
              {product.title} deneniyor…
            </Text>
          </View>
        </View>
      )}

      {step === "result" && photo && (
        <>
          <View style={styles.frame}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <View style={styles.resultTag}>
              <Ionicons name="sparkles" size={14} color={brand.accent} />
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, flex: 1 }}>
                {product.title}
              </Text>
            </View>
            <View style={styles.conceptBadge}>
              <Text style={styles.conceptText}>KONSEPT ÖNİZLEME</Text>
            </View>
          </View>
          <Text style={styles.note}>
            Bu bir demo. Gerçek Plus özelliğinde yapay zekâ bu ürünü
            fotoğrafındaki kombine giydirerek yeni bir görsel üretecek.
          </Text>
          {!!product.url && (
            <Button title="Ürünü gör" onPress={() => void openProduct()} />
          )}
          <Button
            title="Başka fotoğrafla dene"
            variant="outline"
            onPress={() => setStep("pick")}
          />
        </>
      )}
    </Screen>
  );
}

function ProductCard({ product }: { product: TryOnProduct }) {
  return (
    <View style={styles.product}>
      <View style={styles.thumb}>
        <Ionicons name="shirt-outline" size={26} color={colors.photoText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold }}>
          {product.title}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {[product.brand, product.price].filter(Boolean).join(" · ") ||
            "Paylaşılan ürün"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: brand.accentSoft,
  },
  demoText: { flex: 1, fontSize: 13, color: brand.accentDark },
  plus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  plusText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.onAccent },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  photo: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17,17,17,0.35)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  overlayText: { fontFamily: fonts.bold, color: colors.onAccent, fontSize: 16 },
  resultTag: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  conceptBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  conceptText: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.onAccent },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: "center" },
});
