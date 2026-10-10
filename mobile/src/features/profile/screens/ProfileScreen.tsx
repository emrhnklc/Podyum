import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewImage } from "@/components/media/PreviewImage";
import { blush, colors, common, fonts, serif } from "@/theme";
import { ME } from "@/constants/demo";
import { compactCount } from "@/lib/format";
import { getUser } from "../data/demo-users";
import { posts, postsOf } from "@/features/polls/data/demo-polls";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import { leagueFor } from "@/features/games/data/league";
import { usePreviewMessage } from "@/hooks/use-preview-message";

type IconName = keyof typeof Ionicons.glyphMap;
type Tab = "POSTS" | "SAVED" | "CONTESTS";

const STYLE_ICON: Record<string, IconName> = {
  Minimal: "body-outline",
  Vintage: "leaf-outline",
  "Sokak stili": "footsteps-outline",
  Oversize: "shirt-outline",
  Sneaker: "footsteps-outline",
  Klasik: "ribbon-outline",
  Retro: "radio-outline",
  Renkli: "color-palette-outline",
};
// Önizleme rozetleri; gerçek başarımlar oyun API'si bağlanınca gelecek.
const BADGES: { label: string; icon: IconName; color: string }[] = [
  { label: "Podyum birincisi ×3", icon: "trophy", color: blush.wine },
  { label: "Stil gurusu", icon: "ribbon", color: "#E0A526" },
  { label: "30 gün seri", icon: "flame", color: blush.pink },
];

export function ProfileScreen({ username = ME }: { username?: string }) {
  const [tab, setTab] = useState<Tab>("POSTS");
  const [requested, setRequested] = useState(false);
  const { saved } = useDemoPolls();
  const message = usePreviewMessage();
  const user = getUser(username);
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

  const league = leagueFor(user.counts.stars);
  const rows =
    tab === "SAVED" && mine
      ? posts.filter((post) => saved.includes(post.id))
      : tab === "POSTS"
        ? postsOf(username)
        : [];
  const tabs: { value: Tab; label: string; icon: IconName }[] = [
    { value: "POSTS", label: "Paylaşımlar", icon: "grid" },
    ...(mine
      ? [{ value: "SAVED" as const, label: "Kaydedilenler", icon: "bookmark-outline" as const }]
      : []),
    { value: "CONTESTS", label: "Yarışmalar", icon: "trophy-outline" },
  ];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={common.spread}>
          {mine ? (
            <View style={{ flexDirection: "row" }}>
              <Text style={styles.logo}>Podyum</Text>
              <Ionicons name="sparkles" size={16} color={blush.pink} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={back}
              style={styles.round}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mine ? "Hesap girişi" : "Daha fazla"}
            onPress={() =>
              mine
                ? router.push("/auth")
                : message(
                    "Şikâyet ve engelleme seçenekleri sıradaki adımlarda açılacak.",
                  )
            }
            style={styles.round}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={[common.row, { gap: 16, alignItems: "flex-start" }]}>
          <View>
            <View style={styles.avatar}>
              <PreviewImage uri={user.avatar} tone={blush.pinkSoft} icon="person-outline" />
              {!user.avatar && (
                <Text style={styles.initials}>{user.initials}</Text>
              )}
            </View>
            {mine && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profil fotoğrafı ekle"
                onPress={() =>
                  message("Fotoğraf seçimi bir sonraki adımda açılacak.")
                }
                style={styles.avatarPlus}
              >
                <Ionicons name="add" size={20} color={colors.onAccent} />
              </Pressable>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={{ color: colors.muted }}>{user.username}</Text>
            {user.bio && (
              <Text style={{ fontSize: 15 }}>
                {user.bio} <Text style={{ color: blush.pink }}>♡</Text>
              </Text>
            )}
          </View>
        </View>
        <View style={[common.row, { flexWrap: "wrap", gap: 8 }]}>
          {user.styles.map((style) => (
            <View key={style} style={styles.style}>
              <Ionicons
                name={STYLE_ICON[style] ?? "pricetag-outline"}
                size={15}
                color={colors.text}
              />
              <Text style={{ fontSize: 13 }}>{style}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.box, styles.stats]}>
          {[
            { label: "Paylaşım", value: user.counts.polls },
            { label: "Arkadaş", value: user.counts.friends },
            { label: "Yıldız", value: user.counts.stars },
          ].map((count, index) => (
            <Pressable
              key={count.label}
              accessibilityRole="button"
              accessibilityLabel={`${count.value} ${count.label}`}
              disabled={count.label !== "Arkadaş" || !mine}
              onPress={() => router.push("/friends")}
              style={[styles.stat, index > 0 && styles.statDivider]}
            >
              <Text style={styles.statValue}>{compactCount(count.value)}</Text>
              <View style={[common.row, { gap: 4 }]}>
                {count.label === "Yıldız" && (
                  <Ionicons name="star" size={13} color={blush.pink} />
                )}
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {count.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {mine ? (
            <>
              <Action
                label="Profili düzenle"
                icon="pencil-outline"
                filled
                onPress={() =>
                  message("Profil düzenleme ekranı sıradaki adımlarda açılacak.")
                }
              />
              <Action
                label="Arkadaş ekle"
                icon="person-add-outline"
                onPress={() => router.push("/people")}
              />
            </>
          ) : (
            <>
              <Action
                label={requested ? "İstek gitti" : "Arkadaş ekle"}
                icon={requested ? "checkmark" : "person-add-outline"}
                filled
                onPress={() => setRequested((value) => !value)}
              />
              <Action
                label="Mesaj"
                icon="chatbubble-outline"
                onPress={() => message("Mesajlar sıradaki adımlarda açılacak.")}
              />
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={league.name}
          onPress={() => router.push("/defile")}
          style={[styles.box, common.row, { gap: 14 }]}
        >
          <View style={styles.leagueBadge}>
            <Ionicons name="trophy" size={28} color="#FFF6DA" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={common.spread}>
              <Text style={styles.leagueName}>{league.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </View>
            {league.next && (
              <View style={[common.row, { gap: 4 }]}>
                <Text style={{ color: colors.muted }}>
                  {league.next} Lig&apos;e {league.remaining}
                </Text>
                <Ionicons name="star" size={14} color={blush.pink} />
              </View>
            )}
            <View style={[common.row, { gap: 10 }]}>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${league.progress * 100}%` }]}
                />
              </View>
              {league.next && (
                <Text style={{ fontSize: 13 }}>
                  {league.current.toLocaleString("tr-TR")} /{" "}
                  {league.span.toLocaleString("tr-TR")}
                </Text>
              )}
            </View>
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {BADGES.map((badge) => (
            <Pressable
              key={badge.label}
              accessibilityRole="button"
              accessibilityLabel={badge.label}
              onPress={() =>
                message("Rozet detayları oyun API'si bağlanınca açılacak.")
              }
              style={[styles.box, styles.badge]}
            >
              <View style={styles.badgeIcon}>
                <Ionicons name={badge.icon} size={22} color={badge.color} />
              </View>
              <Text
                style={{ flex: 1, fontSize: 12, fontFamily: fonts.semibold }}
                numberOfLines={3}
              >
                {badge.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.box, styles.tabs]}>
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
                  color={active ? blush.wine : colors.text}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: active ? fonts.bold : fonts.medium,
                    color: active ? blush.wine : colors.text,
                  }}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
                    <Ionicons name="heart" size={14} color={blush.pink} />
                    <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                      {compactCount(post.totalVotes)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={tab === "CONTESTS" ? "trophy-outline" : "albums-outline"}
            title={
              tab === "SAVED"
                ? "Henüz kaydedilen yok"
                : tab === "CONTESTS"
                  ? "Henüz yarışma yok"
                  : "Henüz paylaşım yok"
            }
            message={
              tab === "SAVED"
                ? "Keşfet'te kaydettiğin kombinler burada görünür."
                : tab === "CONTESTS"
                  ? "Defile'da katıldığın yarışmalar burada görünür."
                  : "İlk kombinini paylaştığında burada görünür."
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  icon,
  filled = false,
  onPress,
}: {
  label: string;
  icon: IconName;
  filled?: boolean;
  onPress: () => void;
}) {
  const tint = filled ? blush.wine : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        filled && styles.actionFilled,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={19} color={tint} />
      <Text style={{ fontFamily: fonts.bold, color: tint }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: blush.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  logo: {
    fontFamily: serif,
    fontStyle: "italic",
    fontWeight: "700",
    fontSize: 40,
    letterSpacing: -1,
    color: colors.text,
  },
  round: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: blush.card,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.extraBold,
    fontSize: 36,
    color: blush.wine,
  },
  avatarPlus: {
    position: "absolute",
    right: -2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: blush.pink,
    borderWidth: 3,
    borderColor: blush.background,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.text,
  },
  style: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
  },
  box: {
    borderRadius: 24,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    padding: 14,
  },
  stats: { flexDirection: "row", paddingHorizontal: 0 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: blush.line },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: blush.wine },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: blush.card,
    borderWidth: 1,
    borderColor: blush.line,
  },
  actionFilled: { backgroundColor: blush.pinkSoft, borderColor: blush.pinkSoft },
  leagueBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E7B23A",
    borderWidth: 3,
    borderColor: "#F6D57A",
    alignItems: "center",
    justifyContent: "center",
  },
  leagueName: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 22,
    color: colors.text,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: blush.chip,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: blush.pink },
  badge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: blush.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", padding: 4, borderRadius: 26 },
  tab: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 22,
    paddingHorizontal: 6,
  },
  tabActive: { backgroundColor: blush.pinkSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.5%",
    aspectRatio: 1.25,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  likes: {
    margin: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: blush.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
});
