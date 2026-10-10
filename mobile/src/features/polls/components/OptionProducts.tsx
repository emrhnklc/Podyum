import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { colors, fonts } from "@/theme";
import {
  formatPrice,
  getProducts,
  productSearchUrl,
} from "../data/demo-products";
import type { DemoPost } from "../types";

// Her seçenekteki parçalar: küçük görsel, ad, örnek fiyat ve benzer ürün
// aramasına giden bağlantı. Oy verilmiş olsun olmasın görünür.
export function OptionProducts({ post }: { post: DemoPost }) {
  const sections = post.options
    .map((option) => ({ option, items: getProducts(option.products) }))
    .filter((section) => section.items.length > 0);
  if (!sections.length) return null;
  return (
    <View style={{ gap: 18 }}>
      {sections.map(({ option, items }) => (
        <View key={option.label} style={{ gap: 8 }}>
          <View style={styles.heading}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{option.label}</Text>
            </View>
            <Text style={styles.title}>Kombindeki parçalar</Text>
            <Text style={styles.count}>{items.length} ürün</Text>
          </View>
          {items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="link"
              accessibilityLabel={`${item.title}, ${formatPrice(item.priceMinor)}. Benzerlerini gör`}
              onPress={() => Linking.openURL(productSearchUrl(item))}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View style={styles.thumb}>
                <PreviewImage uri={item.image} tone={item.tone} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={styles.name}>
                  {item.title}
                </Text>
                <Text style={styles.price}>{formatPrice(item.priceMinor)}</Text>
              </View>
              <View style={styles.link}>
                <Text style={styles.linkText}>Benzerlerini gör</Text>
                <Ionicons name="open-outline" size={15} color={colors.text} />
              </View>
            </Pressable>
          ))}
        </View>
      ))}
      <Text style={styles.note}>
        Demo: parçalar fotoğrafa bakılarak adlandırıldı. Bağlantılar belirli
        bir mağaza ürününe değil, benzer ürün aramasına gider; fiyatlar
        örnektir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.onAccent,
  },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16 },
  count: { fontSize: 12, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: "hidden" },
  name: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  price: { fontSize: 13, color: colors.muted },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontFamily: fonts.bold, fontSize: 12 },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
