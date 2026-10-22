import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { catalogPrice } from "@/features/catalog/catalog-product";
import { colors, common, fonts } from "@/theme";
import { DemoImage } from "@/features/try-on/components/DemoImage";
import { demoProductImage } from "@/features/try-on/data/demo-results";
import { useTrends } from "../hooks/use-trends";
import type {
  PriceBand,
  TrendPeriod,
  TrendVoter,
  TrendAge,
  TrendCurrency,
} from "../types";

const periods: { value: TrendPeriod; label: string }[] = [
  { value: "DAY", label: "Bugün" },
  { value: "WEEK", label: "Bu hafta" },
  { value: "MONTH", label: "Bu ay" },
];
const categories = [
  { value: "ALL" as const, label: "Tümü" },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
    value: value as PollCategory,
    label,
  })),
];
const voters: { value: TrendVoter; label: string }[] = [
  { value: "ANY", label: "Herkes" },
  { value: "WOMAN", label: "Kadınlar" },
  { value: "MAN", label: "Erkekler" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "UNSPECIFIED", label: "Belirtilmemiş" },
];
const ages: { value: TrendAge; label: string }[] = [
  { value: "ANY", label: "Tüm yaşlar" },
  { value: "AGE_18_24", label: "18–24" },
  { value: "AGE_25_34", label: "25–34" },
  { value: "AGE_35_PLUS", label: "35+" },
];
const currencies: { value: TrendCurrency; label: string }[] = [
  { value: "TRY", label: "TL" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
];
function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? "";
}

export function TrendsScreen() {
  const trends = useTrends();
  const filters = trends.filters;
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const currencyLabel = labelOf(currencies, filters.currency);
  const prices: { value: PriceBand; label: string }[] = [
    { value: "ALL", label: "Tüm fiyatlar" },
    { value: "UNDER_750", label: `750 ${currencyLabel} altı` },
    { value: "FROM_750_TO_2000", label: `750–2.000 ${currencyLabel}` },
    { value: "OVER_2000", label: `2.000 ${currencyLabel} üstü` },
  ];
  const summary = [
    labelOf(periods, filters.period),
    filters.category !== "ALL" && labelOf(categories, filters.category),
    filters.voter !== "ANY" && labelOf(voters, filters.voter),
    filters.age !== "ANY" && labelOf(ages, filters.age),
    filters.brand,
    filters.price !== "ALL" && labelOf(prices, filters.price),
    filters.currency !== "TRY" && currencyLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const page = trends.page;
  return (
    <Screen>
      <BrandTitle title="Trendler" />
      <Text style={common.subtitle}>
        Seçilen kombinlerde en çok yer alan parçalar
      </Text>
      {!trends.authenticated ? (
        <>
          <EmptyState
            title="Trendleri görmek için giriş yap"
            message="Gerçek ürün tercihlerini ve filtreli sonuçları hesabınla inceleyebilirsin."
          />
          <Button
            title="Giriş yap"
            onPress={() => router.push("/auth/login")}
          />
        </>
      ) : (
        <>
          <View style={styles.filterBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filtreler: ${summary}`}
              accessibilityState={{ expanded: open }}
              onPress={() => setOpen((value) => !value)}
              style={styles.filterBar}
            >
              <Ionicons name="options-outline" size={20} color={colors.text} />
              <Text numberOfLines={1} style={styles.summary}>
                {summary}
              </Text>
              {trends.activeCount > 0 && (
                <View style={styles.count}>
                  <Text style={styles.countText}>{trends.activeCount}</Text>
                </View>
              )}
              <Ionicons
                name={open ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.muted}
              />
            </Pressable>
            {open && (
              <View style={styles.panel}>
                <ChipRow
                  label="Dönem"
                  options={periods}
                  value={filters.period}
                  onChange={(value) => trends.set("period", value)}
                />
                <ChipRow
                  label="Kategori"
                  options={categories}
                  value={filters.category}
                  onChange={(value) => trends.set("category", value)}
                />
                <ChipRow
                  label="Tercih yapanlar"
                  options={voters}
                  value={filters.voter}
                  onChange={(value) => trends.set("voter", value)}
                />
                <ChipRow
                  label="Yaş grubu"
                  options={ages}
                  value={filters.age}
                  onChange={(value) => trends.set("age", value)}
                />
                <TextInput
                  accessibilityLabel="Marka"
                  placeholder="Yayın anındaki marka adı"
                  placeholderTextColor={colors.muted}
                  value={brand}
                  maxLength={100}
                  autoCapitalize="none"
                  onChangeText={setBrand}
                  onSubmitEditing={() => trends.set("brand", brand.trim())}
                  style={{
                    color: colors.text,
                    borderColor: colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                  }}
                />
                <Button
                  title="Markayı uygula"
                  variant="outline"
                  onPress={() => trends.set("brand", brand.trim())}
                />
                <ChipRow
                  label="Para birimi"
                  options={currencies}
                  value={filters.currency}
                  onChange={(value) => trends.set("currency", value)}
                />
                <ChipRow
                  label="Yayın anındaki fiyat"
                  options={prices}
                  value={filters.price}
                  onChange={(value) => trends.set("price", value)}
                />
                {trends.activeCount > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setBrand("");
                      trends.reset();
                    }}
                    style={styles.reset}
                  >
                    <Text style={styles.resetText}>Filtreleri temizle</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <Button
            title="Trendleri yenile"
            variant="outline"
            disabled={trends.loading}
            icon={
              <Ionicons name="refresh-outline" size={17} color={colors.text} />
            }
            onPress={() => void trends.refresh()}
          />
          <ApiStatus
            loading={trends.loading || (!page && !trends.error)}
            error={trends.error}
            retry={trends.refresh}
          />
          {trends.notice && (
            <Text accessibilityLiveRegion="polite" style={styles.note}>
              {trends.notice}
            </Text>
          )}
          {page && (
            <Text style={styles.note}>
              {page.population === "CONSENTED_VOTER_SNAPSHOT"
                ? "Analize izin verenlerin oy anındaki bilgilerine göre."
                : "Genel kombin tercihleri."}{" "}
              Dönem İstanbul takvimine göredir.
            </Text>
          )}
          {trends.rows.map((item) => {
            const product = item.product;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.rank}. ${product.title}, ${item.score} trend katkısı. Ürün detayı`}
                onPress={() =>
                  router.push({
                    pathname: "/catalog/[id]",
                    params: { id: product.id },
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor:
                      item.rank === 1 ? colors.accentSoft : colors.surface,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rank,
                    { color: item.rank === 1 ? colors.accent : colors.text },
                  ]}
                >
                  {item.rank}
                </Text>
                <View
                  style={[
                    styles.thumb,
                    {
                      backgroundColor: colors.background,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  {demoProductImage(product.canonicalUrl) ? (
                    <DemoImage
                      source={demoProductImage(product.canonicalUrl)!}
                      tone="#E8E6E0"
                      fit="contain"
                    />
                  ) : (
                    <Ionicons
                      name="shirt-outline"
                      size={30}
                      color={colors.muted}
                    />
                  )}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={2} style={styles.title}>
                    {product.title}
                  </Text>
                  <Text style={styles.meta}>
                    {[product.brand, CATEGORY_LABEL[product.category]]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text style={styles.meta}>
                    {catalogPrice(product.priceMinor, product.currency)} ·
                    Güncel katalog
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                      {item.score.toLocaleString("tr-TR")}
                    </Text>{" "}
                    trend katkısı ·{" "}
                    {item.distinctVoters.toLocaleString("tr-TR")} farklı hesap
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.muted}
                />
              </Pressable>
            );
          })}
          {!trends.loading && !trends.error && page?.status === "NO_DATA" && (
            <EmptyState
              title="Bu filtrede henüz veri yok"
              message="Filtreleri genişlet veya yeni kombin tercihleri geldikçe tekrar bak."
              icon="filter-outline"
            />
          )}
          {!trends.loading &&
            !trends.error &&
            page?.status === "INSUFFICIENT_SAMPLE" && (
              <EmptyState
                title="Henüz yeterli katılım yok"
                message={`Bir ürünün görünmesi için seçili filtrelerde en az ${page.policy.minimumDistinctVoters} farklı hesabın tercihi gerekir.`}
                icon="people-outline"
              />
            )}
          {trends.hasMore && (
            <Button
              title="Daha fazla göster"
              variant="outline"
              disabled={trends.loading}
              onPress={() => void trends.loadMore()}
            />
          )}
          {page && (
            <Text style={styles.note}>
              Bir hesap aynı ürüne günde en fazla 1 katkı verir. Bu sayı ürün
              oyu veya satış değildir. Fiyat filtresi yayın anındaki fiyatı,
              kartlar güncel katalog bilgisini kullanır. Yeni tercihler kısa bir
              gecikmeyle yansıyabilir.{"\n"}Son hesaplama:{" "}
              {new Date(page.computedAt).toLocaleString("tr-TR", {
                timeZone: "Europe/Istanbul",
              })}
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: "hidden",
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  summary: { flex: 1, fontFamily: fonts.semibold, fontSize: 14 },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent },
  panel: {
    gap: 14,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  reset: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  resetText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    paddingRight: 14,
    borderRadius: 18,
  },
  rank: { width: 20, textAlign: "center", fontFamily: fonts.extraBold },
  thumb: { width: 68, height: 68, borderRadius: 14, overflow: "hidden" },
  title: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 12, color: colors.muted },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
