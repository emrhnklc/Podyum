import { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import {
  formatPrice,
  getProducts,
  productSearchUrl,
} from "@/features/polls/data/demo-products";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import type { DemoOption, DemoPost } from "@/features/polls/types";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { colors, fonts } from "@/theme";

const BADGE_TONE = { A: "rgba(208,10,38,0.85)", B: "rgba(17,17,17,0.8)" };

function allProducts(post: DemoPost) {
  return getProducts(post.options.flatMap((option) => option.products));
}

// Keşfet'in altında sabit duran çubuk: ilk parçaların küçük görselleri ve
// detay sayfasını açan düğme.
export function OutfitDetailsBar({
  post,
  onOpen,
}: {
  post: DemoPost;
  onOpen: () => void;
}) {
  const items = allProducts(post);
  if (!items.length) return null;
  const shown = items.slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Kombin detaylarını gör, ${items.length} ürün`}
      onPress={onOpen}
      style={styles.bar}
    >
      <View style={styles.handle} />
      <View style={styles.barRow}>
        <View style={styles.thumbs}>
          {shown.map((item) => (
            <View key={item.id} style={styles.barThumb}>
              <PreviewImage uri={item.image} tone={item.tone} />
            </View>
          ))}
          {items.length > shown.length && (
            <View style={[styles.barThumb, styles.more]}>
              <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                +{items.length - shown.length}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15 }} numberOfLines={1}>
            Kombin detaylarını gör
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
            {items.length} ürün · Benzerlerini keşfet
          </Text>
        </View>
        <View style={styles.up}>
          <Ionicons name="chevron-up" size={22} color={colors.text} />
        </View>
      </View>
    </Pressable>
  );
}

// Alttan açılan detay sayfası: A/B sekmesi, kombin fotoğrafı ve parçalar.
export function OutfitDetailsSheet({
  post,
  visible,
  onClose,
}: {
  post: DemoPost;
  visible: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState<DemoOption["label"]>("A");
  const { saved, toggleSave } = useDemoPolls();
  const message = usePreviewMessage();
  const insets = useSafeAreaInsets();
  const option =
    post.options.find((item) => item.label === label) ?? post.options[0];
  const items = getProducts(option.products);
  const isSaved = saved.includes(post.id);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kombin detaylarını kapat"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={[styles.handle, { marginBottom: 6 }]} />
        <View style={styles.header}>
          <Text style={styles.title}>Kombin detayları</Text>
          <View style={styles.count}>
            <Ionicons name="bag-handle-outline" size={14} color={colors.text} />
            <Text style={{ fontSize: 12, color: colors.text }}>
              {items.length} ürün
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.segment}>
          {post.options.map((item) => {
            const active = item.label === label;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setLabel(item.label)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <View style={styles.segmentThumb}>
                  <PreviewImage uri={item.image} tone={item.tone} />
                </View>
                <Text
                  style={{
                    fontFamily: active ? fonts.bold : fonts.medium,
                    color: active ? colors.text : colors.text,
                  }}
                >
                  {item.label} Kombini
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.body}>
          <View style={styles.photo}>
            <PreviewImage uri={option.image} tone={option.tone} />
            <View
              style={[styles.badge, { backgroundColor: BADGE_TONE[option.label] }]}
            >
              <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
                {option.label}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isSaved ? "Kaydedilenlerden çıkar" : "Bu kombini kaydet"
              }
              onPress={() => toggleSave(post.id)}
              style={styles.save}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={14}
                color={colors.text}
              />
              <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                {isSaved ? "Kaydedildi" : "Bu kombini kaydet"}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {items.length ? (
              items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.title}, ${formatPrice(item.priceMinor)}. Benzerlerini gör`}
                  onPress={() => Linking.openURL(productSearchUrl(item))}
                  style={({ pressed }) => [
                    styles.item,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <View style={styles.itemThumb}>
                    <PreviewImage uri={item.image} tone={item.tone} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={2} style={styles.itemName}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {formatPrice(item.priceMinor)}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={colors.text} />
                </Pressable>
              ))
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Bu kombinde etiketlenen parça yok.
              </Text>
            )}
            <Text style={styles.note}>
              Demo: bağlantılar benzer ürün aramasına gider; fiyatlar örnektir.
            </Text>
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paylaş"
            onPress={() => Share.share({ message: post.question })}
            style={[styles.action, styles.actionOutline]}
          >
            <Ionicons name="share-outline" size={20} color={colors.text} />
            <Text style={{ fontFamily: fonts.bold }}>Paylaş</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bu kombini dene"
            onPress={() =>
              message("Kombini deneme özelliği sıradaki adımlarda açılacak.")
            }
            style={[styles.action, styles.actionFilled]}
          >
            <Ionicons name="sparkles" size={20} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
              Bu kombini dene
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 8,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumbs: {
    flexDirection: "row",
    gap: 2,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  barThumb: { width: 28, height: 36, borderRadius: 7, overflow: "hidden" },
  more: {
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  up: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.35)" },
  sheet: {
    maxHeight: "82%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 20 },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.chip,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
  },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentThumb: { width: 28, height: 28, borderRadius: 14, overflow: "hidden" },
  body: { flexDirection: "row", gap: 10, height: 300 },
  photo: { width: "44%", borderRadius: 18, overflow: "hidden" },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  save: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemThumb: { width: 48, height: 48, borderRadius: 10, overflow: "hidden" },
  itemName: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  note: { fontSize: 11, lineHeight: 15, color: colors.muted },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    minHeight: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  actionOutline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionFilled: { flex: 1, backgroundColor: colors.accent },
});
