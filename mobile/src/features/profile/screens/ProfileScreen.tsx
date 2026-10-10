import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewImage } from "@/components/media/PreviewImage";
import { brand, colors, common, fonts, serif } from "@/theme";
import { ME } from "@/constants/demo";
import { compactCount } from "@/lib/format";
import { useProfileUser } from "../hooks/use-profile-edits";
import {
  myHighlights,
  otherHighlights,
  type DemoHighlight,
} from "../data/demo-highlights";
import type { DemoUser } from "../types";
import { posts, postsOf } from "@/features/polls/data/demo-polls";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import { leagueFor } from "@/features/games/data/league";
import { usePreviewMessage } from "@/hooks/use-preview-message";

type IconName = keyof typeof Ionicons.glyphMap;
type Tab = "POSTS" | "POLLS" | "SAVED";

// Kendi profilin "Profilim", başkasınınki "Profil" düzeninde açılır.
export function ProfileScreen({ username = ME }: { username?: string }) {
  const [tab, setTab] = useState<Tab>("POSTS");
  const [following, setFollowing] = useState(false);
  const { saved } = useDemoPolls();
  const message = usePreviewMessage();
  const { user, handle } = useProfileUser(username);
  const mine = username === ME;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!user)
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <View style={[styles.content, { flex: 1 }]}>
          <EmptyState
            title="Profil bulunamadı"
            message="Bu kullanıcı demo listesinde yok."
          />
          <Button title="Keşfet'e dön" onPress={() => router.replace("/")} />
        </View>
      </SafeAreaView>
    );

  const own = postsOf(username);
  const rows =
    tab === "SAVED"
      ? posts.filter((post) => saved.includes(post.id))
      : tab === "POLLS"
        ? own.filter((post) => post.timeLeft !== "bitti")
        : own;
  const tabs: { value: Tab; label: string; icon: IconName }[] = [
    { value: "POSTS", label: "Gönderiler", icon: "grid-outline" },
    { value: "POLLS", label: "Oylamalar", icon: "stats-chart-outline" },
    ...(mine
      ? [{ value: "SAVED" as const, label: "Kaydedilenler", icon: "bookmark-outline" as const }]
      : []),
  ];
  const shareProfile = () =>
    Share.share({ message: `Podyum'da @${handle} profiline göz at!` });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          {mine ? (
            // Ayarlar sağdaki menüden açılır; başlık ortada kalsın diye boşluk.
            <View style={styles.iconButton} />
          ) : (
            <IconButton label="Geri" icon="chevron-back" onPress={back} />
          )}
          <Text style={styles.headerTitle} accessibilityRole="header">
            {mine ? "Profilim" : "Profil"}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {mine ? (
              <>
                <IconButton
                  label="Profili paylaş"
                  icon="share-outline"
                  onPress={shareProfile}
                />
                <IconButton
                  label="Menü"
                  icon="menu-outline"
                  onPress={() => router.push("/settings")}
                />
              </>
            ) : (
              <IconButton
                label="Daha fazla"
                icon="ellipsis-vertical"
                onPress={() =>
                  message(
                    "Şikâyet ve engelleme seçenekleri sıradaki adımlarda açılacak.",
                  )
                }
              />
            )}
          </View>
        </View>

        <View style={styles.identity}>
          <View>
            <Avatar user={user} />
            {mine && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profil fotoğrafını düzenle"
                onPress={() => router.push("/profile/edit")}
                style={styles.avatarEdit}
              >
                <Ionicons name="pencil" size={16} color={colors.text} />
              </Pressable>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={[common.row, { gap: 6 }]}>
              <Text style={styles.username} numberOfLines={1}>
                {handle}
              </Text>
              {user.verified && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={brand.accent}
                  accessibilityLabel="Onaylı hesap"
                />
              )}
            </View>
            <Text style={{ color: colors.muted }}>@{handle}</Text>
            {user.location && (
              <View style={[common.row, { gap: 4 }]}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  {user.location}
                </Text>
              </View>
            )}
            {!mine && <LeaguePill stars={user.counts.stars} />}
            <View style={styles.stats}>
              {[
                { label: "Gönderi", value: user.counts.polls },
                { label: "Takipçi", value: user.counts.followers },
                { label: "Takip", value: user.counts.following },
              ].map((count, index) => (
                <View
                  key={count.label}
                  accessible
                  accessibilityLabel={`${count.value} ${count.label}`}
                  style={[styles.stat, index > 0 && styles.statDivider]}
                >
                  <Text style={styles.statValue}>
                    {compactCount(count.value)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {count.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.bio}>{user.bio ?? user.styles.join(" · ")}</Text>

        {mine ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profili Düzenle"
              onPress={() => router.push("/profile/edit")}
              style={({ pressed }) => [
                styles.primary,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryText}>Profili Düzenle</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kişi ekle"
              onPress={() => router.push("/people")}
              style={styles.squareButton}
            >
              <Ionicons name="person-add-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={following ? "Takibi bırak" : "Takip et"}
              onPress={() => setFollowing((value) => !value)}
              style={({ pressed }) => [
                styles.primary,
                following && styles.primaryMuted,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={[styles.primaryText, following && { color: brand.accentDark }]}
              >
                {following ? "Takip ediliyor" : "Takip Et"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mesaj"
              onPress={() => message("Mesajlar sıradaki adımlarda açılacak.")}
              style={({ pressed }) => [
                styles.secondary,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="paper-plane-outline" size={20} color={brand.accentDark} />
              <Text style={{ fontFamily: fonts.bold, color: brand.accentDark }}>
                Mesaj
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingVertical: 2 }}
        >
          {(mine ? myHighlights : otherHighlights).map((item) => (
            <Highlight
              key={item.label}
              item={item}
              onPress={() =>
                message("Öne çıkanlar sıradaki adımlarda açılacak.")
              }
            />
          ))}
          {mine && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yeni öne çıkan ekle"
              onPress={() =>
                message("Öne çıkanlar sıradaki adımlarda açılacak.")
              }
              style={styles.highlight}
            >
              <View style={[styles.highlightRing, styles.highlightNew]}>
                <Ionicons name="add" size={28} color={colors.text} />
              </View>
              <Text style={styles.highlightLabel}>Yeni</Text>
            </Pressable>
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {tabs.map((option) => {
            const active = tab === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(option.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={active ? brand.accentDark : colors.muted}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: active ? fonts.bold : fonts.medium,
                    color: active ? brand.accentDark : colors.muted,
                  }}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.length ? (
          <View style={styles.grid}>
            {rows.map((post) => {
              const leading =
                post.options[0].percent >= post.options[1].percent
                  ? post.options[0]
                  : post.options[1];
              return (
                <Pressable
                  key={post.id}
                  accessibilityRole="button"
                  accessibilityLabel={post.question}
                  onPress={() =>
                    router.push({
                      pathname: "/polls/[id]",
                      params: { id: post.id },
                    })
                  }
                  style={styles.tile}
                >
                  <PreviewImage uri={leading.image} tone={leading.tone} />
                  <View style={styles.likes}>
                    <Ionicons name="heart" size={12} color={brand.accent} />
                    <Text style={{ fontSize: 11, fontFamily: fonts.semibold }}>
                      {compactCount(post.totalVotes)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={tab === "SAVED" ? "bookmark-outline" : "albums-outline"}
            title={
              tab === "SAVED"
                ? "Henüz kaydedilen yok"
                : tab === "POLLS"
                  ? "Açık oylama yok"
                  : "Henüz gönderi yok"
            }
            message={
              tab === "SAVED"
                ? "Keşfet'te kaydettiğin kombinler burada görünür."
                : tab === "POLLS"
                  ? "Şu an oylamaya açık paylaşım yok."
                  : mine
                    ? "İlk kombinini paylaştığında burada görünür."
                    : "Henüz bir kombin paylaşmadı."
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={26} color={colors.text} />
    </Pressable>
  );
}

function Avatar({ user }: { user: DemoUser }) {
  return (
    <View style={styles.avatar}>
      {user.avatar ? (
        <PreviewImage uri={user.avatar} tone={brand.accentSoft} icon="person-outline" />
      ) : (
        <Text style={styles.initials}>{user.initials}</Text>
      )}
    </View>
  );
}

function LeaguePill({ stars }: { stars: number }) {
  const league = leagueFor(stars);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={league.name}
      onPress={() => router.push("/defile")}
      style={styles.league}
    >
      <Ionicons name="trophy-outline" size={16} color={brand.accentDark} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: brand.accentDark }}>
        {league.name}
      </Text>
    </Pressable>
  );
}

function Highlight({
  item,
  onPress,
}: {
  item: DemoHighlight;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={onPress}
      style={styles.highlight}
    >
      <View style={styles.highlightRing}>
        <View style={[styles.highlightInner, { backgroundColor: item.tone }]}>
          <Ionicons name={item.icon} size={26} color={colors.text} />
        </View>
      </View>
      <Text style={styles.highlightLabel} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 24,
    color: colors.text,
    pointerEvents: "none",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: brand.card,
    backgroundColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: brand.accentDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  initials: { fontFamily: fonts.extraBold, fontSize: 36, color: brand.accentDark },
  avatarEdit: {
    position: "absolute",
    right: 0,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
  },
  league: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: brand.accentSoft,
  },
  stats: { flexDirection: "row", marginTop: 6 },
  stat: { flex: 1, gap: 1 },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: brand.line,
    paddingLeft: 10,
  },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  bio: { fontSize: 15, lineHeight: 21, color: colors.text },
  primary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryMuted: { backgroundColor: brand.accentSoft },
  primaryText: { fontFamily: fonts.bold, fontSize: 16, color: colors.onAccent },
  squareButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: brand.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.chip,
    borderWidth: 1,
    borderColor: brand.line,
  },
  highlight: { width: 66, alignItems: "center", gap: 6 },
  highlightRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    borderWidth: 1.5,
    borderColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightInner: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightNew: { backgroundColor: brand.card, borderColor: brand.line },
  highlightLabel: { fontSize: 12, color: colors.text },
  tabs: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: brand.line,
  },
  // Sekmeler sığarsa eşit yayılır, sığmazsa yana kaydırılır.
  tab: {
    flexGrow: 1,
    paddingHorizontal: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: brand.accentDark },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: {
    width: "32%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  likes: {
    margin: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: brand.card,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
