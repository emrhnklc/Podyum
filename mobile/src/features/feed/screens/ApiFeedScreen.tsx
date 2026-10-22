import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { PillChip } from "@/components/ui/PillChip";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { ApiPollCard } from "@/features/polls/components/ApiPollCard";
import { useApiFeed } from "../hooks/use-api-feed";
import { NotificationsButton } from "@/features/notifications/components/NotificationsButton";
import { brand, colors, fonts } from "@/theme";

export function ApiFeedScreen() {
  const [scope, setScope] = useState<"everyone" | "friends">("everyone");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const feed = useApiFeed(scope, category);
  const filtered = category !== "ALL";
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: brand.background }}
    >
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.logo} accessibilityRole="header">
            Podyum
          </Text>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel="Kişi ara"
            onPress={() => router.push("/people")}
            style={styles.search}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted }}>Kişi ara</Text>
          </Pressable>
          <NotificationsButton />
        </View>
        <View style={styles.tabBar}>
          <View style={styles.tabs}>
            {scopes.map((item) => {
              const active = scope === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setScope(item.value)}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              filtered
                ? `Kategori filtresi: ${CATEGORY_LABEL[category]}`
                : "Kategori filtresi"
            }
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((row) => !row)}
            style={styles.iconButton}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={filtered ? colors.accent : colors.text}
            />
          </Pressable>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={feed.busy}
              onRefresh={() => void feed.refresh()}
            />
          }
        >
          {filtersOpen && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              <PillChip
                label="Tümü"
                active={category === "ALL"}
                onPress={() => setCategory("ALL")}
              />
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <PillChip
                  key={value}
                  label={label}
                  active={category === value}
                  onPress={() => setCategory(value as PollCategory)}
                />
              ))}
            </ScrollView>
          )}
          {feed.busy && !feed.post && <ActivityIndicator color={brand.accent} />}
          {feed.error && (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Text accessibilityRole="alert" style={{ color: colors.accent }}>
                {feed.error}
              </Text>
              <Button title="Tekrar dene" onPress={() => void feed.retry()} />
            </View>
          )}
          {feed.post ? (
            <ApiPollCard
              key={feed.post.id}
              initial={feed.post}
              onSkip={feed.skip}
            />
          ) : !feed.busy && !feed.error ? (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <EmptyState
                title="Şimdilik bu kadar"
                message={
                  scope === "friends"
                    ? "Arkadaşlarının yeni oylamaları burada görünecek."
                    : "Yeni oylamalar geldiğinde burada göreceksin. Farklı bir kategori de seçebilirsin."
                }
              />
              <Button
                title="Yenile"
                variant="outline"
                onPress={() => void feed.refresh()}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const scopes = [
  { value: "everyone", label: "Herkes" },
  { value: "friends", label: "Arkadaşlar" },
] as const;

const styles = StyleSheet.create({
  page: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    paddingLeft: 16,
    paddingRight: 4,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 4,
  },
  logo: { fontFamily: fonts.extraBold, fontSize: 21, letterSpacing: -0.5 },
  tabs: { flexDirection: "row", gap: 18 },
  tab: { height: 44, justifyContent: "center", gap: 3 },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  tabTextActive: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  tabLine: { height: 2, borderRadius: 1 },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
