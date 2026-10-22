import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { ApiImage } from "@/components/media/ApiImage";
import { DemoImage } from "../components/DemoImage";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { errorMessage } from "@/lib/api/client";
import type { ApiPoll } from "@/features/polls/api/types";
import { brand, colors, common, fonts } from "@/theme";
import { demoProductImage, demoTryOnResult } from "../data/demo-results";

export type TryOnProduct = {
  title: string;
  brand?: string;
  price?: string;
  url?: string;
};

type Step = "outfits" | "working" | "result";
// Seçilen fotoğraf: profildeki bir kombin (sunucu yolu) ya da galeriden yerel dosya.
type Photo =
  | { kind: "outfit"; path: string | null }
  | { kind: "local"; uri: string };
type OwnPoll = {
  id: string;
  question: string;
  thumbnailPath: string | null;
  effectiveStatus: ApiPoll["effectiveStatus"];
};

const WORK_MS = 2400;

// Plus konsepti: ürünü kendi kombin fotoğrafında deneme. Bu ekran DEMODUR;
// ödeme alınmaz ve yapay zekâ görsel üretmez. Demo ürünü hangi fotoğrafta
// denenirse denensin önceden hazırlanmış mock sonuç gösterilir.
export function TryOnScreen({ product }: { product: TryOnProduct }) {
  const { client } = useAuth();
  const [step, setStep] = useState<Step>("outfits");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const opening = useRef(false);
  const message = usePreviewMessage();
  const outfits = useApiQuery<{ items: OwnPoll[] }>(
    step === "outfits" ? "/me/polls?limit=20" : null,
  );
  // Taslak ve iptal edilen paylaşımlar denemeye uygun değildir.
  const ownOutfits = (outfits.data?.items ?? []).filter(
    (poll) => poll.effectiveStatus === "OPEN" || poll.effectiveStatus === "CLOSED",
  );
  const productImage = demoProductImage(product.url);
  const demoResult = demoTryOnResult(product.url);
  useEffect(() => {
    if (step !== "working") return;
    const timer = setTimeout(() => setStep("result"), WORK_MS);
    return () => clearTimeout(timer);
  }, [step]);

  async function pickFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
      });
      if (result.canceled) return;
      setPhoto({ kind: "local", uri: result.assets[0].uri });
      setStep("working");
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }
  async function openOutfit(id: string) {
    if (opening.current) return;
    opening.current = true;
    setLoadError(null);
    try {
      // Kıyafet kombinin ilk (A) fotoğrafında değiştirilir.
      const poll = await client.request<ApiPoll>(`/polls/${id}`);
      const first = [...poll.options].sort((a, b) => a.position - b.position)[0];
      setPhoto({ kind: "outfit", path: first?.media.displayPath ?? null });
      setStep("working");
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      opening.current = false;
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
          Demo: ödeme alınmaz, yapay zekâ çalışmaz.
        </Text>
      </View>
      <View style={common.row}>
        <Text style={common.title}>Üzerimde dene</Text>
        <View style={styles.plus}>
          <Text style={styles.plusText}>PLUS</Text>
        </View>
      </View>
      <ProductCard product={product} image={productImage} />

      {step === "outfits" && (
        <>
          <Text style={styles.label}>Profilindeki hangi kombinde deneyelim?</Text>
          <ApiStatus
            loading={outfits.loading}
            error={outfits.error ?? loadError}
            retry={outfits.refresh}
          />
          <View style={styles.grid}>
            {ownOutfits.map((poll) => (
              <Pressable
                key={poll.id}
                accessibilityRole="button"
                accessibilityLabel={`Kombin: ${poll.question}`}
                onPress={() => void openOutfit(poll.id)}
                style={styles.tile}
              >
                <ApiImage path={poll.thumbnailPath} />
                <View style={styles.tileLabel}>
                  <Text numberOfLines={2} style={{ fontSize: 11 }}>
                    {poll.question}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {outfits.data && !ownOutfits.length && (
            <Text style={styles.note}>
              Henüz paylaştığın bir kombin yok. Galeriden de seçebilirsin.
            </Text>
          )}
          <Button
            title="Galeriden fotoğraf seç"
            variant="outline"
            onPress={() => void pickFromGallery()}
          />
        </>
      )}

      {step === "working" && photo && (
        <View style={styles.frame}>
          <PhotoView photo={photo} blurred />
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.onAccent} size="large" />
            <Text style={styles.overlayText}>{product.title} deneniyor…</Text>
          </View>
        </View>
      )}

      {step === "result" && photo && (
        <>
          <View style={styles.frame}>
            {demoResult ? (
              <DemoImage source={demoResult} tone={colors.surface} />
            ) : (
              <PhotoView photo={photo} />
            )}
            <View style={styles.resultTag}>
              <Ionicons name="sparkles" size={14} color={brand.accent} />
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, flex: 1 }}>
                {product.title}
              </Text>
            </View>
            <View style={styles.conceptBadge}>
              <Text style={styles.conceptText}>
                {demoResult ? "MOCK SONUÇ" : "KONSEPT ÖNİZLEME"}
              </Text>
            </View>
          </View>
          <Text style={styles.note}>
            {demoResult
              ? "Bu sonuç demo için önceden hazırlandı. Gerçek Plus özelliğinde yapay zekâ ürünü kombinine giydirerek üretecek."
              : "Bu bir demo. Gerçek Plus özelliğinde yapay zekâ bu ürünü fotoğrafındaki kombine giydirerek yeni bir görsel üretecek."}
          </Text>
          {!!product.url && (
            <Button title="Ürünü gör" onPress={() => void openProduct()} />
          )}
          <Button
            title="Başka kombinde dene"
            variant="outline"
            onPress={() => setStep("outfits")}
          />
        </>
      )}
    </Screen>
  );
}

function PhotoView({ photo, blurred = false }: { photo: Photo; blurred?: boolean }) {
  if (photo.kind === "outfit") return <ApiImage path={photo.path} />;
  return (
    <Image
      source={{ uri: photo.uri }}
      style={styles.photo}
      blurRadius={blurred ? 8 : 0}
    />
  );
}

function ProductCard({
  product,
  image,
}: {
  product: TryOnProduct;
  image?: ImageSourcePropType;
}) {
  return (
    <View style={styles.product}>
      <View style={styles.thumb}>
        {image ? (
          <DemoImage source={image} tone="#E8E6E0" fit="contain" />
        ) : (
          <Ionicons name="shirt-outline" size={28} color={colors.photoText} />
        )}
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
  label: { fontFamily: fonts.bold, fontSize: 16 },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.surface,
  },
  tileLabel: {
    margin: 5,
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  frame: {
    width: "100%",
    aspectRatio: 920 / 1636,
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
    backgroundColor: "rgba(17,17,17,0.45)",
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
