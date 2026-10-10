import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { DEMO_FRIENDS } from "@/constants/demo";
import { feed } from "@/features/polls/data/demo-polls";
import { colors, fonts } from "@/theme";
import { FeedPoll } from "../components/FeedPoll";

type Audience = "ALL" | "FRIENDS";

const audiences: { value: Audience; label: string }[] = [
  { value: "ALL", label: "Herkes" },
  { value: "FRIENDS", label: "Arkadaşlar" },
];

const categories = [
  { value: "ALL" as const, label: "Tümü" },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
    value: value as PollCategory,
    label,
  })),
];

// İçerik odaklı Keşfet: ince bir üst satır, altında ekranı dolduran oylama.
// Kategori filtresi yalnızca istenince açılır.
export function FeedScreen() {
  const [audience, setAudience] = useState<Audience>("ALL");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const rows = feed
    .filter((post) => category === "ALL" || post.category === category)
    .filter((post) => audience === "ALL" || DEMO_FRIENDS.includes(post.user));
  const post = rows.length ? rows[index % rows.length] : undefined;
  const filtered = category !== "ALL";
  return (
    <Screen scroll={false} padding={0}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>Podyum</Text>
        <View style={styles.tabs}>
          {audiences.map((item) => {
            const active = audience === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setAudience(item.value);
                  setIndex(0);
                }}
                style={styles.tab}
              >
                <Text style={active ? styles.tabTextActive : styles.tabText}>
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.tabLine,
                    { backgroundColor: active ? colors.text : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              filtered
                ? `Kategori filtresi: ${CATEGORY_LABEL[category]}`
                : "Kategori filtresi"
            }
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={styles.iconButton}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={filtered ? colors.accent : colors.text}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Günlük podyumu aç"
            onPress={() => router.push("/games")}
            style={styles.iconButton}
          >
            <Ionicons name="trophy-outline" size={21} color={colors.text} />
          </Pressable>
        </View>
      </View>
      {filtersOpen && (
        <View style={{ paddingHorizontal: 16 }}>
          <ChipRow
            options={categories}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setIndex(0);
            }}
          />
        </View>
      )}
      {post ? (
        <FeedPoll
          key={post.id}
          post={post}
          onNext={() => setIndex((value) => value + 1)}
        />
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState
            title="Henüz oylama yok"
            message="Başka bir kategori ya da Herkes sekmesiyle keşfetmeye devam et."
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    paddingLeft: 16,
    paddingRight: 6,
  },
  logo: { fontFamily: fonts.extraBold, fontSize: 21, letterSpacing: -0.5 },
  tabs: { flexDirection: "row", gap: 14 },
  tab: { height: 44, justifyContent: "center", gap: 3 },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  tabTextActive: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  tabLine: { height: 2, borderRadius: 1 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
