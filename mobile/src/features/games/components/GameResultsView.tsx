import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { ApiImage } from "@/components/media/ApiImage";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts, serif } from "@/theme";
import {
  getResults,
  quickMatch,
  sendFriendRequest,
  type GameResultItem,
  type GameResults,
} from "../api/games";

const decimal = (value: number | null) =>
  value === null ? "–" : value.toFixed(1).replace(".", ",");

// Defile sonucu. Podyumda sıranın altında aldığı oy sayısı görünür. Herkese
// açık defilede lig kartı ve kazanılan puan, davetli odada yalnız kazanan.
export function GameResultsView({
  gameId,
  themeTitle,
  onClose,
}: {
  gameId: string;
  themeTitle: string;
  onClose: () => void;
}) {
  const { client, me } = useAuth();
  const [results, setResults] = useState<GameResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getResults(client, gameId)
      .then((row) => alive && setResults(row))
      .catch((failure) => alive && setError(errorMessage(failure)));
    return () => {
      alive = false;
    };
  }, [client, gameId]);

  const myId = me?.user.id;
  const items = results?.items ?? [];
  const podium = [items[1], items[0], items[2]];
  const rest = items.slice(3);
  const leader = items[0];
  const mine = items.find((item) => item.author.id === myId);

  async function findRoom() {
    try {
      const game = await quickMatch(client);
      if (!game)
        return setMessage("Şu an katılabileceğin açık bir defile yok.");
      router.replace({ pathname: "/games/[id]", params: { id: game.id } });
    } catch (failure) {
      setMessage(errorMessage(failure));
    }
  }
  async function addFriend(userId: string) {
    try {
      await sendFriendRequest(client, userId);
      setRequested((previous) => [...previous, userId]);
    } catch (failure) {
      setMessage(errorMessage(failure));
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={onClose}
            hitSlop={10}
            style={styles.close}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.caption}>SONUÇLAR</Text>
          <Text style={styles.title} accessibilityRole="header">
            Tema: {themeTitle}
          </Text>
        </View>

        {!results ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <ActivityIndicator color={brand.accent} />
            )}
          </View>
        ) : (
          <>
            <View style={styles.podium}>
              {podium.map((item, index) =>
                item ? (
                  <Step
                    key={item.id}
                    item={item}
                    me={item.author.id === myId}
                    first={index === 1}
                  />
                ) : (
                  <View key={`empty-${index}`} style={{ flex: 1 }} />
                ),
              )}
            </View>

            {results.official && results.league ? (
              <View style={styles.league}>
                <View style={styles.badge}>
                  <Ionicons name="trophy" size={24} color={brand.accent} />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={styles.leagueHead}>
                    <Text style={styles.leagueName} numberOfLines={1}>
                      {results.league.name} ·{" "}
                      {results.totalPoints?.toLocaleString("tr-TR")} puan
                    </Text>
                    {results.league.nextName && (
                      <Text
                        style={{
                          alignSelf: "flex-end",
                          fontSize: 13,
                          color: colors.muted,
                        }}
                      >
                        {results.league.nextName}&apos;e{" "}
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                          {results.league.remaining}
                        </Text>
                      </Text>
                    )}
                  </View>
                  {results.league.span && (
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.min(100, (results.league.current / results.league.span) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                  <View style={styles.leagueFoot}>
                    <Text
                      style={{ flex: 1, fontSize: 13, color: colors.muted }}
                    >
                      {leagueHint(results, mine, leader)}
                    </Text>
                    {mine && (
                      <Text style={styles.points}>
                        +{results.awardedPoints} puan
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              leader && (
                <View style={styles.league}>
                  <View style={styles.badge}>
                    <Ionicons name="trophy" size={24} color={brand.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.leagueName}>
                      Kazanan:{" "}
                      {leader.author.id === myId
                        ? "Sen"
                        : leader.author.username}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      Arkadaş odasında puan ve lig yok; sadece kazanan belli
                      olur.
                    </Text>
                  </View>
                </View>
              )
            )}

            {rest.length > 0 && (
              <View style={styles.list}>
                {rest.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.row, index > 0 && styles.rowLine]}
                  >
                    <Text style={styles.rank}>{item.rank}</Text>
                    <Avatar item={item} size={44} />
                    <Text
                      style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16 }}
                      numberOfLines={1}
                    >
                      {item.author.id === myId ? "Sen" : item.author.username}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {item.ratingCount} oy
                    </Text>
                    {item.author.id !== myId && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={requested.includes(item.author.id)}
                        onPress={() => void addFriend(item.author.id)}
                        style={styles.friend}
                      >
                        <Text
                          style={{ fontSize: 13, fontFamily: fonts.semibold }}
                        >
                          {requested.includes(item.author.id)
                            ? "İstek gitti"
                            : "Arkadaş ekle"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {message && <Text style={styles.error}>{message}</Text>}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/games/new")}
              style={({ pressed }) => [
                styles.primary,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryText}>Rövanş · yeni tema</Text>
              <Ionicons
                name="arrow-forward"
                size={22}
                color={colors.onAccent}
              />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void findRoom()}
                style={styles.secondary}
              >
                <Ionicons name="search" size={20} color={colors.text} />
                <Text style={{ fontFamily: fonts.bold }}>Başka oda bul</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/paylas")}
                style={styles.secondary}
              >
                <Ionicons name="shirt-outline" size={20} color={colors.text} />
                <Text style={{ fontFamily: fonts.bold }}>Kombinimi oylat</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// Herkese açık defilede lig kartının altındaki kısa yorum.
function leagueHint(
  results: GameResults,
  mine: GameResultItem | undefined,
  leader: GameResultItem | undefined,
) {
  if (!mine) return "Kombin yüklemediğin için bu defileden puan almadın.";
  if (results.myRank === 1) return "Podyumun zirvesindesin!";
  if (leader?.averageStars != null && mine.averageStars != null)
    return `Birinciye ${decimal(leader.averageStars - mine.averageStars)} yıldız kaldı. Bir tur daha?`;
  return "Bir tur daha?";
}

function Avatar({ item, size }: { item: GameResultItem; size: number }) {
  // "Deniz Kaya" → "DK"; tek kelimede ilk iki harf.
  const words = (item.author.displayName || item.author.username)
    .split(/[\s_]+/)
    .filter(Boolean);
  const initials = (
    words.length > 1 ? words.map((word) => word[0]) : [...(words[0] ?? "?")]
  )
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr");
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {item.author.avatarPath ? (
        <ApiImage path={item.author.avatarPath} />
      ) : (
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: size * 0.32,
            color: brand.accentDark,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

function Step({
  item,
  me,
  first,
}: {
  item: GameResultItem;
  me: boolean;
  first: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 6,
        marginTop: first ? 0 : 36,
      }}
    >
      {first && <Ionicons name="ribbon" size={24} color={brand.accent} />}
      <Avatar item={item} size={first ? 64 : 54} />
      <Text style={styles.stepName} numberOfLines={1}>
        {me ? "Sen" : item.author.username}
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        <Ionicons name="star" size={12} color={brand.accent} />{" "}
        {decimal(item.averageStars)}
      </Text>
      <View
        style={[
          styles.block,
          first ? styles.blockFirst : null,
          { height: first ? 150 : item.rank === 2 ? 120 : 100 },
        ]}
      >
        <Text style={[styles.blockRank, first && { color: colors.onAccent }]}>
          {item.rank}
        </Text>
        <Text style={[styles.blockVotes, first && { color: colors.onAccent }]}>
          {item.ratingCount} oy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 12, flexGrow: 1 },
  sheet: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    borderRadius: 32,
    backgroundColor: brand.card,
  },
  header: { alignItems: "center", gap: 4 },
  close: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand.background,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 32,
    letterSpacing: -0.8,
    color: colors.text,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
  },
  avatar: {
    overflow: "hidden",
    backgroundColor: brand.accentSoft,
    borderWidth: 3,
    borderColor: brand.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  block: {
    alignSelf: "stretch",
    borderRadius: 20,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  blockFirst: { backgroundColor: brand.accent, borderColor: brand.accent },
  blockRank: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 48,
    color: colors.text,
  },
  blockVotes: { fontSize: 15, fontFamily: fonts.semibold, color: colors.muted },
  league: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: brand.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  // Lig adı tam görünsün diye sonraki kademe alt satırda, sağda.
  leagueHead: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  leagueName: {
    flexShrink: 1,
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 18,
    color: colors.text,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.chip,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: brand.accent },
  leagueFoot: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  points: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 22,
    color: brand.accentDark,
  },
  list: {
    borderRadius: 22,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowLine: { borderTopWidth: 1, borderTopColor: brand.line },
  rank: { width: 20, fontSize: 16, color: colors.muted },
  friend: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.accentSoft,
  },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  primary: {
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: brand.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: { fontFamily: serif, fontSize: 22, color: colors.onAccent },
  secondary: {
    flex: 1,
    minHeight: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
});
