import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { PillChip } from "@/components/ui/PillChip";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { ApiPollCard } from "@/features/polls/components/ApiPollCard";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useApiFeed } from "../hooks/use-api-feed";
import { brand, colors, common } from "@/theme";

export function ApiFeedScreen() {
  const { me } = useAuth();
  const [scope, setScope] = useState<"everyone" | "friends">("everyone");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const feed = useApiFeed(scope, category);
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: brand.background }}>
    <ScrollView style={{ width: "100%", maxWidth: 520, alignSelf: "center" }} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 16 }} refreshControl={<RefreshControl refreshing={feed.busy} onRefresh={() => void feed.refresh()} />}>
      <View style={common.spread}><BrandTitle title="Podyum" /><Pressable accessibilityRole="button" accessibilityLabel="Filtreleri aç" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen((row) => !row)} style={{ padding: 12 }}><Ionicons name="options-outline" size={26} color={colors.text} /></Pressable></View>
      <Text style={{ color: colors.muted }}>Merhaba, {me?.user.displayName}</Text>
      <View style={common.row}>
        <PillChip label="Herkes" active={scope === "everyone"} onPress={() => setScope("everyone")} />
        <PillChip label="Arkadaşlar" active={scope === "friends"} onPress={() => setScope("friends")} />
      </View>
      {filtersOpen && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><PillChip label="Tümü" active={category === "ALL"} onPress={() => setCategory("ALL")} />{Object.entries(CATEGORY_LABEL).map(([value, label]) => <PillChip key={value} label={label} active={category === value} onPress={() => setCategory(value as PollCategory)} />)}</ScrollView>}
      {feed.busy && !feed.post && <ActivityIndicator color={brand.accent} />}
      {feed.error && <><Text accessibilityRole="alert" style={{ color: colors.accent }}>{feed.error}</Text><Button title="Tekrar dene" onPress={() => void feed.retry()} /></>}
      {feed.post ? <ApiPollCard key={feed.post.id} initial={feed.post} onSkip={feed.skip} /> : !feed.busy && !feed.error ? <><EmptyState title="Şimdilik bu kadar" message={scope === "friends" ? "Arkadaşlarının yeni oylamaları burada görünecek." : "Yeni oylamalar geldiğinde burada göreceksin. Farklı bir kategori de seçebilirsin."} /><Button title="Yenile" variant="outline" onPress={() => void feed.refresh()} /></> : null}
    </ScrollView>
  </SafeAreaView>;
}
