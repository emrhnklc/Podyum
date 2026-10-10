import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewImage } from "@/components/media/PreviewImage";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import {
  formatPrice,
  productSearchUrl,
} from "@/features/polls/data/demo-products";
import { colors, common, fonts } from "@/theme";
import { useTrends } from "../hooks/use-trends";
import type { PriceBand, TrendPeriod, TrendVoter } from "../types";

const periods: { value: TrendPeriod; label: string }[] = [
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
  { value: "WOMEN", label: "Kadınlar" },
  { value: "MEN", label: "Erkekler" },
];
const prices: { value: PriceBand; label: string }[] = [
  { value: "ALL", label: "Tüm fiyatlar" },
  { value: "UNDER_750", label: "750 TL altı" },
  { value: "FROM_750_TO_2000", label: "750–2.000 TL" },
  { value: "OVER_2000", label: "2.000 TL üstü" },
];

function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? "";
}

export function TrendsScreen() {
  const trends = useTrends();
  const [open, setOpen] = useState(false);
  // Çubukta dönem ve varsayılandan farklı filtreler tek satırda özetlenir.
  const summary = [
    labelOf(periods, trends.period),
    trends.category !== "ALL" && labelOf(categories, trends.category),
    trends.voter !== "ANY" && labelOf(voters, trends.voter),
    trends.price !== "ALL" && labelOf(prices, trends.price),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Screen>
      <BrandTitle title="Trendler" />
      <Text style={common.subtitle}>
        Seçilen kombinlerde en çok yer alan parçalar
      </Text>
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
              value={trends.period}
              onChange={trends.setPeriod}
            />
            <ChipRow
              label="Kategori"
              options={categories}
              value={trends.category}
              onChange={trends.setCategory}
            />
            <ChipRow
              label="Tercih yapanlar"
              options={voters}
              value={trends.voter}
              onChange={trends.setVoter}
            />
            <ChipRow
              label="Fiyat"
              options={prices}
              value={trends.price}
              onChange={trends.setPrice}
            />
            {trends.activeCount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={trends.reset}
                style={styles.reset}
              >
                <Text style={styles.resetText}>Filtreleri temizle</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {trends.rows.length ? (
        trends.rows.map(({ product, picks }, index) => (
          <Pressable
            key={product.id}
            accessibilityRole="link"
            accessibilityLabel={`${index + 1}. ${product.title}, ${picks} seçilen kombinde. Benzerlerini gör`}
            onPress={() => Linking.openURL(productSearchUrl(product))}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: index === 0 ? "#FBE7EB" : colors.surface,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.rank,
                { color: index === 0 ? colors.accent : colors.text },
              ]}
            >
              {index + 1}
            </Text>
            <View style={styles.thumb}>
              <PreviewImage uri={product.image} tone={product.tone} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={2} style={styles.title}>
                {product.title}
              </Text>
              <Text style={styles.meta}>
                {CATEGORY_LABEL[product.category]} ·{" "}
                {formatPrice(product.priceMinor)}
              </Text>
              <Text style={{ fontSize: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                  {picks.toLocaleString("tr-TR")}
                </Text>{" "}
                seçilen kombinde · {product.optionCount} farklı kombin
              </Text>
            </View>
            <Ionicons name="open-outline" size={17} color={colors.muted} />
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="Bu filtrede yeterli veri yok"
          message="Filtreleri genişleterek tekrar dene."
          icon="filter-outline"
        />
      )}
      <Text style={styles.note}>
        Demo verisi. Sayılar parçanın seçilen kombinlerde kaç kez yer aldığını
        gösterir; ürün oyu veya satış sayısı değildir. Fiyatlar örnektir,
        bağlantılar benzer ürün aramasına gider.
      </Text>
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
