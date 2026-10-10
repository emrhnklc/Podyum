import { useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { PillChip } from "@/components/ui/PillChip";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  type PollCategory,
} from "@/constants/poll-categories";
import { DEMO_FRIENDS } from "@/constants/demo";
import { feed } from "@/features/polls/data/demo-polls";
import { PollCard } from "@/features/polls/components/PollCard";
import { OutfitDetailsBar, OutfitDetailsSheet } from "../components/OutfitDetails";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import { blush, colors, common, fonts } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";

type IconName = ComponentProps<typeof Ionicons>["name"];

const categories: { value: "ALL" | PollCategory; label: string; icon: IconName }[] = [
  { value: "ALL", label: "Tümü", icon: "grid" },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
    value: value as PollCategory,
    label,
    icon: CATEGORY_ICON[value as PollCategory],
  })),
];

export function FeedScreen() {
  const [audience, setAudience] = useState<"ALL" | "FRIENDS">("ALL");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const { votes, saved, toggleSave } = useDemoPolls();
  const message = usePreviewMessage();
  const rows = feed
    .filter((post) => category === "ALL" || post.category === category)
    .filter((post) => audience === "ALL" || DEMO_FRIENDS.includes(post.user));
  const post = rows.length ? rows[index % rows.length] : undefined;
  const isSaved = !!post && saved.includes(post.id);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={common.spread}>
          <BrandTitle title="Podyum" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtreleri aç"
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={[styles.round, filtersOpen && { borderColor: blush.pink }]}
          >
            <Ionicons name="options-outline" size={24} color={colors.text} />
            {category !== "ALL" && <View style={styles.dot} />}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Ara, kişi keşfet"
          onPress={() => router.push("/people")}
          style={[styles.pill, styles.search]}
        >
          <Ionicons name="search-outline" size={20} color={colors.text} />
          <Text style={{ flex: 1, color: colors.muted }}>Ara, kişi keşfet</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>

        <View style={[styles.pill, styles.segment]}>
          {(
            [
              { value: "ALL", label: "Herkes" },
              { value: "FRIENDS", label: "Arkadaşlar" },
            ] as const
          ).map((option) => {
            const active = audience === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setAudience(option.value);
                  setIndex(0);
                }}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Ionicons
                  name={active ? "people" : "people-outline"}
                  size={20}
                  color={active ? blush.wine : colors.muted}
                />
                <Text
                  style={{
                    fontFamily: active ? fonts.bold : fonts.medium,
                    color: active ? blush.wine : colors.muted,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filtersOpen && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                active={category === option.value}
                onPress={() => {
                  setCategory(option.value);
                  setIndex(0);
                }}
              />
            ))}
          </ScrollView>
        )}

        {post ? (
          <PollCard
            post={post}
            footer={
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Action
                    label="Geç"
                    icon={<Ionicons name="arrow-forward" size={20} color={colors.text} />}
                    onPress={() => setIndex((value) => value + 1)}
                  />
                  <Action
                    label={isSaved ? "Kaydedildi" : "Kaydet"}
                    icon={
                      <Ionicons
                        name={isSaved ? "bookmark" : "bookmark-outline"}
                        size={19}
                        color={blush.wine}
                      />
                    }
                    onPress={() => toggleSave(post.id)}
                  />
                  <Action
                    label={`${post.commentCount}`}
                    accessibilityLabel={`${post.commentCount} yorum`}
                    icon={
                      <Ionicons
                        name="chatbox-outline"
                        size={19}
                        color={colors.text}
                      />
                    }
                    onPress={() =>
                      message("Yorum ekranı API bağlantısı adımında eklenecek.")
                    }
                  />
                </View>
                {votes[post.id] && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Action
                      label="Sonuç detayları"
                      onPress={() =>
                        router.push({
                          pathname: "/polls/[id]",
                          params: { id: post.id },
                        })
                      }
                    />
                    <Action
                      label="Sıradaki"
                      filled
                      onPress={() => setIndex((value) => value + 1)}
                    />
                  </View>
                )}
              </>
            }
          />
        ) : (
          <EmptyState
            title="Henüz oylama yok"
            message="Başka bir kategori seçerek keşfetmeye devam et."
          />
        )}
      </ScrollView>
      {post && (
        <>
          <OutfitDetailsBar post={post} onOpen={() => setDetailsOpen(true)} />
          <OutfitDetailsSheet
            key={post.id}
            post={post}
            visible={detailsOpen}
            onClose={() => setDetailsOpen(false)}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function Action({
  label,
  icon,
  onPress,
  filled = false,
  accessibilityLabel,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  filled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        filled && { backgroundColor: blush.pink, borderColor: blush.pink },
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fonts.bold,
          color: filled ? colors.onAccent : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: blush.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  // Alttaki sabit kombin çubuğu son içeriği örtmesin diye ekstra boşluk.
  content: { padding: 16, paddingBottom: 100, gap: 14 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 13,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: blush.pink,
  },
  pill: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
  segment: { flexDirection: "row", padding: 4 },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 24,
  },
  segmentActive: { backgroundColor: blush.pinkSoft },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: blush.line,
    backgroundColor: blush.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
});
