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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { ApiImage } from "@/components/media/ApiImage";
import { DemoImage } from "@/features/try-on/components/DemoImage";
import { demoProductImage } from "@/features/try-on/data/demo-results";
import { brand, colors, common, fonts } from "@/theme";
import { demoDemographics } from "../data/demo-demographics";
import type { ApiPoll, PollResults, ProductTag } from "../api/types";

const PRODUCT_PHOTO_BACKGROUND = "#E8E6E0";

// Kombin detayları: seçenekler arasında sekmeyle geçilir, solda kombin
// fotoğrafı, sağda etiketli parçalar. İstatistikler açılır bölümdedir;
// oy oranları sunucudan, cinsiyet/yaş dağılımı örnek veridir.
export function OutfitDetailsSheet({
  poll,
  results,
  optionId,
  busy,
  onSave,
  onClose,
}: {
  poll: ApiPoll;
  results: PollResults | null;
  optionId: string;
  busy: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(optionId);
  const [statsOpen, setStatsOpen] = useState(false);
  const option =
    poll.options.find((row) => row.id === selected) ?? poll.options[0];
  const productCount = poll.options.reduce(
    (sum, row) => sum + row.products.length,
    0,
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kombin detaylarını kapat"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
          >
            <View style={common.spread}>
              <Text style={styles.title}>Kombin detayları</Text>
              <View style={[common.row, { gap: 10 }]}>
                {productCount > 0 && (
                  <View style={styles.countBadge}>
                    <Ionicons name="bag-handle-outline" size={15} color={colors.accent} />
                    <Text style={styles.countText}>{productCount} ürün</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                  onPress={onClose}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={26} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.tabs}>
              {poll.options.map((row) => {
                const active = row.id === option.id;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${row.label} Kombini`}
                    onPress={() => setSelected(row.id)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <View style={styles.tabThumb}>
                      <ApiImage path={row.media.thumbnailPath ?? row.media.displayPath} />
                    </View>
                    <Text
                      style={[
                        styles.tabText,
                        active && { color: colors.accent },
                      ]}
                    >
                      {row.label} Kombini
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.body}>
              <View style={styles.photo}>
                <ApiImage path={option.media.displayPath} />
                <View style={styles.letter}>
                  <Text style={styles.letterText}>{option.label}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={poll.isSaved ? "Kaydedilenlerden çıkar" : "Bu kombini kaydet"}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={onSave}
                  style={styles.save}
                >
                  <Ionicons
                    name={poll.isSaved ? "bookmark" : "bookmark-outline"}
                    size={15}
                    color={colors.accent}
                  />
                  <Text numberOfLines={1} style={styles.saveText}>
                    {poll.isSaved ? "Kaydedildi" : "Bu kombini kaydet"}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                {option.products.length ? (
                  option.products.map((product) => (
                    <PieceCard key={product.id} product={product} />
                  ))
                ) : (
                  <Text style={styles.empty}>
                    Bu kombinde etiketlenen parça yok.
                  </Text>
                )}
              </View>
            </View>

            <View style={[common.row, { gap: 10 }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void Share.share({
                    message: `Podyum'da "${poll.question}" oylamasına göz at!`,
                  }).catch(() => undefined)
                }
                style={styles.share}
              >
                <Ionicons name="share-outline" size={19} color={colors.text} />
                <Text style={{ fontFamily: fonts.bold }}>Paylaş</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: statsOpen }}
                onPress={() => setStatsOpen((open) => !open)}
                style={styles.statsButton}
              >
                <Ionicons name="stats-chart" size={18} color={colors.onAccent} />
                <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
                  Kombin detayları
                </Text>
                <Ionicons
                  name={statsOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.onAccent}
                />
              </Pressable>
            </View>

            {statsOpen && <Stats poll={poll} results={results} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PieceCard({ product }: { product: ProductTag }) {
  const image = demoProductImage(product.externalUrl);
  const price =
    product.priceMinor === null
      ? "Fiyat belirtilmemiş"
      : new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: product.currency,
          maximumFractionDigits: 0,
        }).format(product.priceMinor / 100);
  return (
    <View style={styles.piece}>
      <View style={styles.pieceThumb}>
        {image ? (
          <DemoImage source={image} tone={PRODUCT_PHOTO_BACKGROUND} fit="contain" />
        ) : (
          <Ionicons name="shirt-outline" size={22} color={colors.photoText} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={styles.pieceName}>
          {product.title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{price}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${product.title} ürününe git`}
          hitSlop={6}
          onPress={() => {
            if (/^https?:\/\//i.test(product.externalUrl))
              void Linking.openURL(product.externalUrl).catch(() => undefined);
          }}
        >
          <Ionicons name="open-outline" size={18} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${product.title} ürününü üzerimde dene, Plus`}
          hitSlop={6}
          onPress={() =>
            router.push({
              pathname: "/try-on",
              params: {
                title: product.title,
                ...(product.brand ? { brand: product.brand } : {}),
                ...(product.priceMinor !== null ? { price } : {}),
                url: product.externalUrl,
              },
            })
          }
        >
          <Ionicons name="sparkles" size={18} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

function Stats({ poll, results }: { poll: ApiPoll; results: PollResults | null }) {
  if (!results)
    return (
      <View style={styles.stats}>
        <Text style={styles.statsTitle}>İstatistikler</Text>
        <Text style={styles.empty}>Oranlar oy verdikten sonra görünür.</Text>
      </View>
    );
  const demo = demoDemographics(poll, results.totalVotes);
  const [first, second] = results.options;
  return (
    <View style={styles.stats}>
      <View style={common.spread}>
        <Text style={styles.statsTitle}>İstatistikler</Text>
        <Text style={{ color: colors.muted }}>{results.totalVotes} oy</Text>
      </View>
      {results.options.length === 2 ? (
        <View style={[common.row, { gap: 8 }]}>
          <Text style={styles.split}>
            {first.label} %{first.percentage}
          </Text>
          <View style={styles.splitTrack}>
            <View style={[styles.splitFill, { flex: Math.max(first.percentage, 1) }]} />
            <View style={{ flex: Math.max(second.percentage, 1), backgroundColor: colors.text }} />
          </View>
          <Text style={[styles.split, { color: colors.text }]}>
            %{second.percentage} {second.label}
          </Text>
        </View>
      ) : (
        results.options.map((row) => (
          <Bar key={row.id} label={`${row.label} Kombini`} percent={row.percentage} />
        ))
      )}
      <Text style={styles.group}>Cinsiyet</Text>
      {demo.gender.map((row) => (
        <Bar key={row.label} label={row.label} percent={row.percent} />
      ))}
      <Text style={styles.group}>Yaş</Text>
      {demo.age.map((row) => (
        <Bar key={row.label} label={row.label} percent={row.percent} />
      ))}
      <Text style={{ fontSize: 11, color: colors.muted }}>
        Önizleme: cinsiyet ve yaş dağılımı örnek veridir.
      </Text>
    </View>
  );
}

function Bar({ label, percent }: { label: string; percent: number }) {
  return (
    <View style={[common.row, { gap: 10 }]}>
      <Text style={{ width: 104, fontSize: 13 }}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
      <Text style={{ width: 38, textAlign: "right", fontFamily: fonts.bold, fontSize: 13 }}>
        %{percent}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    maxHeight: "90%",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 12,
    backgroundColor: colors.line,
  },
  title: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.4 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: brand.accentSoft,
  },
  countText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  tabs: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    borderRadius: 22,
  },
  tabActive: { backgroundColor: brand.accentSoft },
  tabThumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: colors.chip,
  },
  tabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  body: { flexDirection: "row", gap: 10 },
  photo: {
    width: "46%",
    aspectRatio: 3 / 5,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  letter: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: { fontFamily: fonts.extraBold, color: colors.onAccent },
  save: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  saveText: { fontFamily: fonts.bold, fontSize: 12 },
  piece: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  pieceThumb: {
    width: 48,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  pieceName: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  empty: { fontSize: 13, color: colors.muted },
  share: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
  },
  stats: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  statsTitle: { fontFamily: fonts.bold, fontSize: 17 },
  split: { fontFamily: fonts.extraBold, color: colors.accent },
  splitTrack: {
    flex: 1,
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  splitFill: { backgroundColor: colors.accent },
  group: { fontFamily: fonts.bold, fontSize: 14, marginTop: 4 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.chip,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
});
