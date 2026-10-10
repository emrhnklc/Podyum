import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { PillChip } from "@/components/ui/PillChip";
import { PreviewImage } from "@/components/media/PreviewImage";
import { ME } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { compactCount } from "@/lib/format";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { colors, common, fonts } from "@/theme";
import {
  PEOPLE_FILTERS,
  featuredCreators,
  suggestedPeople,
  type DemoPerson,
  type PeopleFilter,
} from "../data/demo-people";

function matches(person: DemoPerson, filter: PeopleFilter | null, query: string) {
  const user = getUser(person.username);
  if (filter === "CLOSE" && !person.closeTaste) return false;
  if (filter === "NEW" && !person.isNew) return false;
  if (filter && filter !== "CLOSE" && filter !== "NEW" && !person.tags.includes(filter))
    return false;
  const needle = query.trim().toLocaleLowerCase("tr");
  if (!needle) return true;
  return [person.username, user?.displayName ?? "", ...person.tags].some((text) =>
    text.toLocaleLowerCase("tr").includes(needle),
  );
}

function openProfile(username: string) {
  if (username === ME) router.push("/profil");
  else router.push({ pathname: "/u/[username]", params: { username } });
}

export function PeopleScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter | null>("CLOSE");
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Yalnız önizleme; gerçek arkadaşlık isteği gönderilmez.
  const [requested, setRequested] = useState<string[]>([]);
  const message = usePreviewMessage();
  const featured = featuredCreators.filter((person) => matches(person, filter, query));
  const suggested = suggestedPeople.filter((person) => matches(person, filter, query));
  const toggleRequest = (username: string) =>
    setRequested((previous) =>
      previous.includes(username)
        ? previous.filter((item) => item !== username)
        : [...previous, username],
    );
  const seeAll = () => message("Tüm liste API bağlantısı adımında eklenecek.");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={common.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={styles.round}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Kişiler</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>
              Tarzını seveceğin profilleri keşfet
            </Text>
          </View>
        </View>

        <View style={common.row}>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={20} color={colors.text} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="İsim, stil veya kullanıcı ara"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.input}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aramayı temizle"
                onPress={() => setQuery("")}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtreleri aç"
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={styles.round}
          >
            <Ionicons name="options-outline" size={22} color={colors.text} />
            {filter && <View style={styles.dot} />}
          </Pressable>
        </View>

        {filtersOpen && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {PEOPLE_FILTERS.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                active={filter === option.value}
                onPress={() =>
                  setFilter(filter === option.value ? null : option.value)
                }
              />
            ))}
          </ScrollView>
        )}

        {featured.length > 0 && (
          <>
            <SectionHeader title="Öne çıkan yaratıcılar" onSeeAll={seeAll} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {featured.map((person, index) => (
                <FeaturedCard
                  key={person.username}
                  person={person}
                  tinted={index % 2 === 1}
                  requested={requested.includes(person.username)}
                  onToggle={() => toggleRequest(person.username)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {suggested.length > 0 && (
          <>
            <SectionHeader title="Sana uygun profiller" onSeeAll={seeAll} />
            <View style={{ gap: 10 }}>
              {suggested.map((person) => (
                <SuggestedRow
                  key={person.username}
                  person={person}
                  requested={requested.includes(person.username)}
                  onToggle={() => toggleRequest(person.username)}
                />
              ))}
            </View>
          </>
        )}

        {!featured.length && !suggested.length && (
          <EmptyState
            icon="people-outline"
            title="Kimse bulunamadı"
            message="Başka bir isim, stil veya filtre dene."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={[common.spread, { marginTop: 4 }]}>
      <Text style={styles.section}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onSeeAll}
        style={[common.row, { gap: 4 }]}
      >
        <Text style={{ fontSize: 14, color: colors.accent, fontFamily: fonts.medium }}>
          Tümünü gör
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.accent} />
      </Pressable>
    </View>
  );
}

function Photo({ person, style }: { person: DemoPerson; style: object }) {
  const user = getUser(person.username);
  return (
    <View style={[{ overflow: "hidden", backgroundColor: person.tone }, style]}>
      <PreviewImage uri={user?.avatar} tone={person.tone} icon="person-outline" />
      {!user?.avatar && (
        <View style={[StyleSheet.absoluteFill, styles.initials]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.text }}>
            {user?.initials ?? "?"}
          </Text>
        </View>
      )}
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={{ fontSize: 12, color: colors.text }}>{label}</Text>
    </View>
  );
}

function AddButton({
  username,
  requested,
  onToggle,
  compact = false,
}: {
  username: string;
  requested: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const mine = username === ME;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        mine ? "Profilini aç" : requested ? `${username} isteğini geri al` : `${username} arkadaş ekle`
      }
      onPress={mine ? () => router.push("/profil") : onToggle}
      style={({ pressed }) => [
        styles.add,
        compact && { paddingHorizontal: 14, minHeight: 44 },
        requested && { backgroundColor: colors.surface },
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons
        name={mine ? "person-outline" : requested ? "checkmark" : "person-add-outline"}
        size={18}
        color={colors.text}
      />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }}>
        {mine ? "Profilin" : requested ? "İstek gitti" : "Arkadaş ekle"}
      </Text>
    </Pressable>
  );
}

function FeaturedCard({
  person,
  tinted,
  requested,
  onToggle,
}: {
  person: DemoPerson;
  tinted: boolean;
  requested: boolean;
  onToggle: () => void;
}) {
  const user = getUser(person.username);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.username} profilini aç`}
      onPress={() => openProfile(person.username)}
      style={[styles.featured, tinted && { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}
    >
      <Photo person={person} style={styles.featuredPhoto} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[common.spread, { alignItems: "flex-start", gap: 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17 }} numberOfLines={1}>
              {person.username}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
              {user?.displayName}
            </Text>
          </View>
          <View style={styles.stars}>
            <Ionicons name="star" size={13} color={colors.accent} />
            <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
              {compactCount(user?.counts.stars ?? 0)}
            </Text>
          </View>
        </View>
        <View style={styles.tags}>
          {person.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <AddButton username={person.username} requested={requested} onToggle={onToggle} />
      </View>
    </Pressable>
  );
}

function SuggestedRow({
  person,
  requested,
  onToggle,
}: {
  person: DemoPerson;
  requested: boolean;
  onToggle: () => void;
}) {
  const user = getUser(person.username);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.username} profilini aç`}
      onPress={() => openProfile(person.username)}
      style={styles.row}
    >
      <Photo person={person} style={styles.avatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text numberOfLines={1}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{person.username}</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>  {user?.displayName}</Text>
        </Text>
        <View style={styles.tags}>
          {person.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </View>
        <View style={[common.row, { gap: 6 }]}>
          <Ionicons name="people-outline" size={15} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {person.mutualFriends} ortak arkadaş
          </Text>
        </View>
      </View>
      <AddButton
        username={person.username}
        requested={requested}
        onToggle={onToggle}
        compact
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  title: {
    fontFamily: fonts.extraBold,
    fontWeight: "700",
    fontSize: 36,
    letterSpacing: -1,
    color: colors.text,
  },
  section: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.text,
  },
  round: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 12,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  search: {
    flex: 1,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  featured: {
    width: 300,
    minHeight: 200,
    flexDirection: "row",
    gap: 12,
    padding: 10,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  featuredPhoto: { width: 116, borderRadius: 16 },
  initials: { alignItems: "center", justifyContent: "center" },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.chip,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.chip,
  },
  add: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 23,
    backgroundColor: colors.accentSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
});
