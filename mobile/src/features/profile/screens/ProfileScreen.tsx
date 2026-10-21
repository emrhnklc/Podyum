import { useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { ApiImage } from "@/components/media/ApiImage";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useApiList, useApiQuery } from "@/hooks/use-api-query";
import { RelationshipActions } from "@/features/people/components/RelationshipActions";
import { FollowButton } from "@/features/people/components/FollowButton";
import type {
  RelationshipDetail,
  SocialPage,
} from "@/features/people/api/social";
import type { ApiPoll } from "@/features/polls/api/types";
import { initialsOf, type MyProfile, type PublicProfile } from "../api/profile";
import { compactCount } from "@/lib/format";
import { confirmAction } from "@/lib/confirm";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, common, fonts, serif } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;
type Tab = "POSTS" | "POLLS" | "SAVED";
type ProfilePoll = Pick<
  ApiPoll,
  "id" | "question" | "effectiveStatus" | "likeCount"
> & {
  thumbnailPath?: string | null;
  options?: ApiPoll["options"];
};

export function ProfileScreen({
  username,
  userId,
}: {
  username?: string;
  userId?: string;
}) {
  const { client, me } = useAuth();
  const mine =
    !username || username === me?.user.username || userId === me?.user.id;
  const [tab, setTab] = useState<Tab>("POSTS");
  const [menu, setMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const lookup = useApiQuery<SocialPage>(
    !mine && !userId && username && /^[a-z0-9_]{3,30}$/.test(username)
      ? `/users/search?q=${username}&limit=50`
      : null,
  );
  const targetId = mine
    ? me?.user.id
    : (userId ??
      lookup.data?.items.find((item) => item.user.username === username)?.user
        .id);
  const profileQuery = useApiQuery<MyProfile | PublicProfile>(
    targetId ? (mine ? "/me" : `/users/${targetId}`) : null,
  );
  const user = profileQuery.data
    ? "profile" in profileQuery.data
      ? profileQuery.data.profile
      : profileQuery.data
    : undefined;
  const relationship = useApiQuery<RelationshipDetail>(
    targetId && !mine ? `/users/${targetId}/relationship` : null,
  );
  const list = useApiList<ProfilePoll>(
    targetId
      ? tab === "SAVED" && mine
        ? "/me/saved-polls?limit=20"
        : mine
          ? `/me/polls?limit=20${tab === "POLLS" ? "&status=OPEN" : ""}`
          : `/users/${targetId}/polls?limit=20`
      : null,
  );
  const rows =
    tab === "POLLS"
      ? list.items.filter((post) => post.effectiveStatus === "OPEN")
      : list.items;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  async function block() {
    if (lock.current || !targetId) return;
    lock.current = true;
    try {
      if (
        !(await confirmAction(
          "Kullanıcıyı engelle",
          "Arkadaşlık ve bekleyen istekler kaldırılır; birbirinizin içeriklerini göremezsiniz.",
          "Engelle",
        ))
      )
        return;
      setBusy(true);
      setActionError(null);
      await client.request(`/blocks/${targetId}`, { method: "PUT" });
      router.replace("/people");
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const tabs = [
    {
      value: "POSTS" as const,
      label: "Gönderiler",
      icon: "grid-outline" as const,
    },
    {
      value: "POLLS" as const,
      label: "Oylamalar",
      icon: "stats-chart-outline" as const,
    },
    ...(mine
      ? [
          {
            value: "SAVED" as const,
            label: "Kaydedilenler",
            icon: "bookmark-outline" as const,
          },
        ]
      : []),
  ];
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            label={mine ? "Bildirimler" : "Geri"}
            icon={mine ? "notifications-outline" : "chevron-back"}
            onPress={mine ? () => router.push("/bildirimler") : back}
          />
          <Text style={styles.headerTitle} accessibilityRole="header">
            {mine ? "Profilim" : "Profil"}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <IconButton
              label="Profili paylaş"
              icon="share-outline"
              onPress={() =>
                void Share.share({
                  message: `Podyum'da @${user?.username ?? username} profiline göz at!`,
                }).catch((error) => setActionError(errorMessage(error)))
              }
            />
            <IconButton
              label={mine ? "Menü" : "Daha fazla"}
              icon={mine ? "menu-outline" : "ellipsis-vertical"}
              onPress={
                mine
                  ? () => router.push("/settings")
                  : () => setMenu((value) => !value)
              }
            />
          </View>
        </View>
        <ApiStatus
          loading={lookup.loading || profileQuery.loading}
          error={lookup.error ?? profileQuery.error}
          retry={() => {
            void lookup.refresh();
            void profileQuery.refresh();
          }}
        />
        {user && (
          <>
            <View style={styles.identity}>
              <View>
                <View style={styles.avatar}>
                  {user.avatarPath ? (
                    <ApiImage path={user.avatarPath} />
                  ) : (
                    <Text style={styles.initials}>
                      {initialsOf(user.displayName)}
                    </Text>
                  )}
                </View>
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
                <Text style={styles.username}>{user.displayName}</Text>
                <Text style={{ color: colors.muted }}>@{user.username}</Text>
                <View style={styles.stats}>
                  {[
                    { label: "Gönderi", value: user.counts.polls },
                    {
                      label: "Takipçi",
                      value: user.counts.followers,
                      kind: "followers" as const,
                    },
                    {
                      label: "Takip",
                      value: user.counts.following,
                      kind: "following" as const,
                    },
                  ].map((count, index) => (
                    <Pressable
                      key={count.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${count.value} ${count.label}`}
                      disabled={!count.kind}
                      onPress={() =>
                        count.kind &&
                        router.push({
                          pathname: "/follows",
                          params: { userId: user.id, kind: count.kind },
                        })
                      }
                      style={[styles.stat, index > 0 && styles.statDivider]}
                    >
                      <Text style={styles.statValue}>
                        {compactCount(count.value)}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.muted }}>
                        {count.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}
            {!!user.styles.length && (
              <Text style={common.subtitle}>
                {user.styles.map((style) => style.label).join(" · ")}
              </Text>
            )}
            {mine ? (
              <View style={{ gap: 10 }}>
                <Button
                  title="Profili Düzenle"
                  onPress={() => router.push("/profile/edit")}
                />
                <View style={common.row}>
                  <Button
                    title={`Arkadaşlar · ${compactCount(user.counts.friends)}`}
                    variant="outline"
                    onPress={() => router.push("/friends")}
                  />
                  <Button
                    title="Defilelerim"
                    variant="outline"
                    onPress={() => router.push("/games/history")}
                  />
                </View>
              </View>
            ) : (
              <>
                <ApiStatus
                  loading={relationship.loading}
                  error={relationship.error}
                  retry={relationship.refresh}
                />
                {relationship.data && (
                  <FollowButton
                    userId={user.id}
                    isFollowing={relationship.data.isFollowing}
                    followsYou={relationship.data.followsYou}
                    onChanged={() => {
                      void profileQuery.refresh();
                      return relationship.refresh();
                    }}
                  />
                )}
                {relationship.data && (
                  <RelationshipActions
                    userId={user.id}
                    state={relationship.data.state}
                    onChanged={() => {
                      void profileQuery.refresh();
                      return relationship.refresh();
                    }}
                  />
                )}
                {menu && (
                  <View style={{ gap: 8 }}>
                    <Button
                      title="Kullanıcıyı engelle"
                      disabled={busy}
                      variant="outline"
                      onPress={() => void block()}
                    />
                    <Button
                      title="Kullanıcıyı şikâyet et"
                      variant="outline"
                      onPress={() =>
                        router.push({
                          pathname: "/reports/new",
                          params: { type: "USER", id: user.id },
                        })
                      }
                    />
                  </View>
                )}
              </>
            )}
            {actionError && (
              <Text accessibilityRole="alert">{actionError}</Text>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabs}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {tabs.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === option.value }}
                  onPress={() => setTab(option.value)}
                  style={[styles.tab, tab === option.value && styles.tabActive]}
                >
                  <Ionicons name={option.icon} size={18} color={colors.text} />
                  <Text>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ApiStatus
              loading={list.loading}
              error={list.error}
              retry={list.refresh}
            />
            <View style={styles.grid}>
              {rows.map((post) => (
                <Pressable
                  key={post.id}
                  accessibilityRole="button"
                  accessibilityLabel={post.question || "Taslak"}
                  onPress={() =>
                    router.push({
                      pathname: "/polls/[id]",
                      params: { id: post.id },
                    })
                  }
                  style={styles.tile}
                >
                  <ApiImage
                    path={
                      post.thumbnailPath ??
                      post.options?.[0]?.media.thumbnailPath ??
                      post.options?.[0]?.media.displayPath ??
                      null
                    }
                  />
                  <View style={styles.likes}>
                    {post.effectiveStatus === "DRAFT" ? (
                      <Text style={{ fontSize: 11 }}>Taslak</Text>
                    ) : post.likeCount !== undefined ? (
                      <>
                        <Ionicons name="heart" size={12} color={brand.accent} />
                        <Text style={{ fontSize: 11, fontFamily: fonts.bold }}>
                          {compactCount(post.likeCount)}
                        </Text>
                      </>
                    ) : (
                      <Text numberOfLines={1} style={{ fontSize: 11 }}>
                        {post.question}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
            {!list.loading && !list.error && !rows.length && (
              <EmptyState
                title={
                  tab === "SAVED" ? "Henüz kaydedilen yok" : "Henüz gönderi yok"
                }
                message={
                  tab === "SAVED"
                    ? "Keşfet'te kaydettiğin kombinler burada görünür."
                    : "Paylaşılan kombinler burada görünecek."
                }
              />
            )}
            {list.hasMore && (
              <Button
                title="Daha fazla kombin"
                disabled={list.loading}
                onPress={() => void list.loadMore()}
              />
            )}
          </>
        )}
        {!user &&
          !lookup.loading &&
          !profileQuery.loading &&
          !lookup.error &&
          !profileQuery.error && (
            <EmptyState
              title="Profil bulunamadı"
              message="Bu profil artık erişilebilir olmayabilir."
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
      style={styles.iconButton}
    >
      <Ionicons name={icon} size={26} color={colors.text} />
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
  initials: {
    fontFamily: fonts.extraBold,
    fontSize: 36,
    color: brand.accentDark,
  },
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
