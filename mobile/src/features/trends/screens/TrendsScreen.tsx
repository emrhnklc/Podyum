import { View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewImage } from "@/components/media/PreviewImage";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { colors, common, fonts } from "@/theme";
import { useTrends } from "../hooks/use-trends";

export function TrendsScreen() {
  const trends = useTrends();
  return (
    <Screen>
      <Text style={common.title}>Trendler</Text>
      <Text style={common.subtitle}>
        Seçilen kombinlerde en çok yer alan ürünler
      </Text>
      <ChipRow
        label="Dönem"
        options={[
          { value: "WEEK", label: "Bu hafta" },
          { value: "MONTH", label: "Bu ay" },
        ]}
        value={trends.period}
        onChange={trends.setPeriod}
      />
      <ChipRow
        label="Kategori"
        options={[
          { value: "ALL" as const, label: "Tümü" },
          ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
            value: value as PollCategory,
            label,
          })),
        ]}
        value={trends.category}
        onChange={trends.setCategory}
      />
      <ChipRow
        label="Tercih yapanlar"
        options={[
          { value: "ANY", label: "Herkes" },
          { value: "WOMEN", label: "Kadınlar" },
          { value: "MEN", label: "Erkekler" },
        ]}
        value={trends.voter}
        onChange={trends.setVoter}
      />
      <ChipRow
        label="Fiyat"
        options={[
          { value: "ALL", label: "Tüm fiyatlar" },
          { value: "UNDER_750", label: "750 TL altı" },
          { value: "FROM_750_TO_2000", label: "750–2.000 TL" },
          { value: "OVER_2000", label: "2.000 TL üstü" },
        ]}
        value={trends.price}
        onChange={trends.setPrice}
      />
      {trends.rows.length ? (
        trends.rows.map(({ product, picks }, index) => (
          <View
            key={product.id}
            style={[
              common.row,
              {
                backgroundColor: index === 0 ? "#FBE7EB" : colors.surface,
                padding: 12,
                borderRadius: 18,
              },
            ]}
          >
            <Text
              style={{
                width: 18,
                fontFamily: fonts.extraBold,
                color: index === 0 ? colors.accent : colors.text,
              }}
            >
              {index + 1}
            </Text>
            <View
              style={{
                width: 64,
                height: 78,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <PreviewImage uri={product.image} tone={product.tone} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                {product.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {product.brand} ·{" "}
                {(product.priceMinor / 100).toLocaleString("tr-TR")} TL
              </Text>
              <Text style={{ fontSize: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                  {picks}
                </Text>{" "}
                seçilen kombinde
              </Text>
            </View>
            {trends.isGeneralList && (
              <Text style={{ fontSize: 12, color: colors.accent }}>
                {rankLabel(product.rankChange[trends.period])}
              </Text>
            )}
          </View>
        ))
      ) : (
        <EmptyState
          title="Bu filtrede yeterli veri yok"
          message="Filtreleri genişleterek tekrar dene."
          icon="filter-outline"
        />
      )}
      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
        Demo verisi. Ürünlerin seçilen kombinlerde yer almasını gösterir; ürün
        oyu veya satış sayısı değildir.
      </Text>
    </Screen>
  );
}
function rankLabel(value: number | "NEW") {
  if (value === "NEW") return "Yeni";
  return value === 0 ? "–" : `${value > 0 ? "↑" : "↓"}${Math.abs(value)}`;
}
