import { useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { CATEGORY_LABEL } from "@/constants/poll-categories";
import { catalogLink, catalogPrice } from "../catalog-product";
import { colors, common } from "@/theme";
import type { CatalogProduct } from "../api/catalog";

export function CatalogProductScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const query = useApiQuery<CatalogProduct>(
    `/catalog/products/${encodeURIComponent(id)}`,
  );
  const [linkError, setLinkError] = useState<string | null>(null);
  const product = query.data;
  const url = catalogLink(product?.canonicalUrl ?? null);
  async function open() {
    if (!url) return;
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError("Ürün bağlantısı açılamadı. Tekrar deneyebilirsin.");
    }
  }
  return (
    <Screen>
      <BackButton fallback="/trendler" />
      {!session ? (
        <>
          <Text>Ürün detayını görmek için giriş yap.</Text>
          <Button
            title="Giriş yap"
            onPress={() => router.push("/auth/login")}
          />
        </>
      ) : (
        <>
          <ApiStatus
            loading={query.loading}
            error={query.error}
            retry={query.refresh}
          />
          {product && (
            <View style={[common.card, { gap: 14 }]}>
              <Ionicons name="shirt-outline" size={54} color={colors.muted} />
              <Text style={common.title}>{product.title}</Text>
              <Text style={common.subtitle}>
                {[product.brand, CATEGORY_LABEL[product.category]]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={common.title}>
                {catalogPrice(product.priceMinor, product.currency)}
              </Text>
              {product.priceRecordedAt && (
                <Text style={common.subtitle}>
                  Fiyat kaydı:{" "}
                  {new Date(product.priceRecordedAt).toLocaleDateString(
                    "tr-TR",
                    { timeZone: "Europe/Istanbul" },
                  )}
                </Text>
              )}
              {product.store && (
                <Text>
                  {product.store.name} · {product.store.domain}
                </Text>
              )}
              <Text style={common.subtitle}>
                Güncel katalog bilgisi. Trend fiyat filtresi, kombin
                yayımlandığındaki fiyatı kullanır. Mağazadaki fiyat değişmiş
                olabilir.
              </Text>
              {url ? (
                <Button title="Mağazada gör" onPress={() => void open()} />
              ) : (
                <Text>Bu ürün için mağaza bağlantısı bulunmuyor.</Text>
              )}
              <ApiStatus
                loading={false}
                error={linkError}
                retry={url ? open : undefined}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
