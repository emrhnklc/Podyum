import { useRef, useState } from "react";
import { useApiQuery, useApiList } from "@/hooks/use-api-query";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { openUser, type SocialItem } from "@/features/people/api/social";
import type { MyLeague } from "./GameHistoryScreen";
import type { GameSummary } from "../api/games";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { quickMatch as findMatch } from "../api/games";
import { brand, colors, common, fonts, serif } from "@/theme";
import { liveGame, weeklyTheme } from "../data/demo-defile";
import { MODES, type GameMode } from "../data/demo-modes";

const GOLD = "#F2B627";
const MEDALS = ["#F2B627", "#B9BCC6", "#D08A55"];
const LIVE_PHOTO = require("../../../../assets/images/defile/podyum-live.jpg");
const THEME_PHOTO = require("../../../../assets/images/defile/autumn-layers.jpg");

export function GamesScreen() {
  const message = usePreviewMessage();
  const { client } = useAuth();
  const leagueQuery = useApiQuery<MyLeague>("/me/league");
  const friends = useApiList<SocialItem>("/me/friends?limit=3");
  const history = useApiList<GameSummary & { membershipStatus: string }>(
    "/me/games?limit=20",
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = history.items.find(
    (game) =>
      game.membershipStatus === "ACTIVE" &&
      !["COMPLETED", "CANCELLED"].includes(game.phase),
  );
  const tour = {
    step: active
      ? ["WAITING", "SCHEDULED", "SUBMISSION", "VOTING"].indexOf(active.phase) +
        1
      : 0,
    total: 4,
    theme: active?.themeTitle ?? "Henüz katılım yok",
  };
  const openTheme = () =>
    router.push({
      pathname: "/games/browse",
      params: { theme: weeklyTheme.title },
    });
  // Hızlı eşleş: günün defilesine ya da herkese açık bir odaya katılıp odayı açar.
  async function quickMatch() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const game = await findMatch(client);
      if (!game) return router.push("/games/browse");
      router.push({ pathname: "/games/[id]", params: { id: game.id } });
    } catch (failure) {
      message(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const myStars = leagueQuery.data?.totalPoints ?? 0;
  const info = leagueQuery.data?.league;
  const league = {
    name: info?.name ?? "Ligim",
    progress: info
      ? info.span
        ? Math.min(1, info.current / info.span)
        : 1
      : 0,
  };
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={common.spread}>
          <BrandTitle title="Defile" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Defile filtreleri"
            onPress={() => router.push("/games/browse")}
            style={styles.round}
          >
            <Ionicons name="options-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${league.name}, ${myStars} yıldız`}
          onPress={() => router.push("/games/league")}
          style={[styles.box, styles.league]}
        >
          <Ionicons name="trophy" size={24} color={GOLD} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
            {league.name}
          </Text>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${league.progress * 100}%` }]}
            />
          </View>
          <Ionicons name="star" size={20} color={GOLD} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
            {myStars.toLocaleString("tr-TR")}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>

        <ApiStatus
          loading={leagueQuery.loading}
          error={leagueQuery.error}
          retry={leagueQuery.refresh}
        />
        <View style={[styles.box, styles.hero]}>
          <HeroArt />
          <View style={[common.row, { gap: 8 }]}>
            <Text style={styles.heroTitle}>{liveGame.title}</Text>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: fonts.bold,
                  color: brand.accentDark,
                }}
              >
                CANLI
              </Text>
            </View>
          </View>
          <Text style={styles.heroText}>{liveGame.description}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Cta
              label={busy ? "Bağlanıyor…" : "Hızlı eşleş"}
              disabled={busy}
              icon="flash"
              filled
              onPress={() => void quickMatch()}
            />
            <Cta
              label="Arkadaşlarla oda"
              icon="people-outline"
              onPress={() =>
                router.push({
                  pathname: "/games/new",
                  params: { private: "1" },
                })
              }
            />
          </View>
        </View>

        <View style={[styles.box, { gap: 12 }]}>
          <ThemeArt />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Haftalık tema: ${weeklyTheme.title}`}
            onPress={openTheme}
            style={[common.row, { gap: 8 }]}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={brand.accentDark}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: fonts.bold,
                color: brand.accentDark,
              }}
            >
              Haftalık tema
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.themeTitle}>{weeklyTheme.title}</Text>
          <Text style={[styles.heroText, { marginRight: 110 }]}>
            {weeklyTheme.description}
          </Text>
          <View style={[common.row, { flexWrap: "wrap", gap: 10 }]}>
            <View style={styles.timer}>
              <Ionicons
                name="time-outline"
                size={16}
                color={brand.accentDark}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.bold,
                  color: brand.accentDark,
                }}
              >
                Tema odaları
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Açık odaları gör veya bu temayla oda kur
            </Text>
          </View>
          <Cta label="Katıl" icon="sparkles" filled onPress={openTheme} />
        </View>

        <View style={[styles.box, { gap: 10 }]}>
          <View style={[common.row, { gap: 8 }]}>
            <Ionicons name="flask-outline" size={20} color={brand.accentDark} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, color: brand.accentDark }}>
              Yeni modlar
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Konsept</Text>
          </View>
          {(Object.keys(MODES) as GameMode[]).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`${MODES[mode].title}, konsept`}
              onPress={() =>
                router.push({ pathname: "/games/modes/[mode]", params: { mode } })
              }
              style={styles.modeRow}
            >
              <View style={styles.modeIcon}>
                <Ionicons name={MODES[mode].icon} size={22} color={brand.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold }}>{MODES[mode].title}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {MODES[mode].tagline}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.box, { gap: 12 }]}>
          <View style={common.spread}>
            <View style={[common.row, { gap: 8 }]}>
              <Ionicons name="people" size={20} color={brand.accentDark} />
              <Text>
                <Text
                  style={{ fontFamily: fonts.bold, color: brand.accentDark }}
                >
                  Arkadaşlar
                </Text>
                <Text style={{ color: colors.muted }}> · bağlantıların</Text>
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/friends")}
              style={[common.row, { gap: 2 }]}
            >
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Tümünü gör
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.muted} />
            </Pressable>
          </View>
          <ApiStatus
            loading={friends.loading}
            error={friends.error}
            retry={friends.refresh}
          />
          {!friends.loading && !friends.error && !friends.items.length && (
            <Text>Arkadaş eklediğinde burada görünür.</Text>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {friends.items.slice(0, 3).map(({ user: friend }, index) => (
              <Pressable
                key={friend.username}
                accessibilityRole="button"
                accessibilityLabel={`${friend.username} profilini aç`}
                onPress={() => openUser(friend)}
                style={styles.rank}
              >
                <View>
                  <Avatar username={friend.username} size={40} />
                  <View
                    style={[styles.medal, { backgroundColor: MEDALS[index] }]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: fonts.bold,
                        color: colors.onAccent,
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12 }} numberOfLines={1}>
                    {friend.username}
                  </Text>
                  <View style={[common.row, { gap: 3 }]}>
                    <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                      Profili aç
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.box, common.row, { gap: 14 }]}>
          <View style={styles.tourIcon}>
            <Ionicons name="shirt" size={28} color={brand.accentDark} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={common.spread}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                  Podyum Turu · {tour.step}/{tour.total}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  Tema: {tour.theme}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  active
                    ? router.push({
                        pathname: "/games/[id]",
                        params: { id: active.id },
                      })
                    : router.push("/games/history")
                }
                style={styles.tourButton}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fonts.bold,
                    color: brand.accentDark,
                  }}
                >
                  {active ? "Turu gör" : "Defilelerim"}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={brand.accentDark}
                />
              </Pressable>
            </View>
            <View style={styles.steps}>
              <View style={styles.stepLine} />
              {Array.from({ length: tour.total }, (_, index) => {
                const done = index < tour.step;
                return (
                  <View
                    key={index}
                    style={[styles.step, done && styles.stepDone]}
                  >
                    {done && (
                      <Ionicons
                        name="checkmark"
                        size={11}
                        color={colors.onAccent}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Cta({
  label,
  icon,
  filled = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  filled?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint = filled ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        filled ? styles.ctaFilled : styles.ctaOutline,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 15, color: tint }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Avatar({
  username,
  size,
  style,
}: {
  username: string;
  size: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: brand.accentSoft,
          borderWidth: 2,
          borderColor: brand.card,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.32,
          fontFamily: fonts.bold,
          color: brand.accentDark,
        }}
      >
        {username.slice(0, 2).toLocaleUpperCase("tr")}
      </Text>
    </View>
  );
}

// Canlı oyun görseli: eğik polaroid, yıldız puanı ve çıkartmalar.
function HeroArt() {
  return (
    <View pointerEvents="none" style={styles.heroArt}>
      <View style={styles.polaroid}>
        <Image source={LIVE_PHOTO} resizeMode="cover" style={styles.photo} />
        <View style={styles.rating}>
          {[0, 1, 2, 3].map((index) => (
            <Ionicons key={index} name="star" size={11} color={GOLD} />
          ))}
          <Ionicons name="star" size={11} color="#9A9A9A" />
        </View>
      </View>
      <Sticker name="star" color={brand.accent} size={30} top={-4} left={-8} />
      <Sticker
        name="sparkles"
        color={brand.accent}
        size={16}
        top={-10}
        right={6}
      />
    </View>
  );
}

function ThemeArt() {
  return (
    <View pointerEvents="none" style={styles.themeArt}>
      <Image source={THEME_PHOTO} resizeMode="cover" style={styles.photo} />
    </View>
  );
}

function Sticker({
  name,
  color,
  size,
  ...position
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  top?: number;
  left?: number;
  right?: number;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={{ position: "absolute", ...position }}
    />
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: brand.card,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: { flex: 1, backgroundColor: brand.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    padding: 16,
    borderRadius: 26,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
    overflow: "hidden",
  },
  league: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.chip,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: brand.accent },
  hero: { gap: 12, backgroundColor: brand.accentSoft },
  heroTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: brand.accent,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginRight: 120,
  },
  heroArt: {
    position: "absolute",
    top: 14,
    right: 12,
    width: 120,
    height: 160,
  },
  polaroid: {
    position: "absolute",
    top: 8,
    right: 0,
    width: 112,
    height: 144,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: brand.surface,
    borderWidth: 5,
    borderColor: brand.card,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "6deg" }],
  },
  photo: { width: "100%", height: "100%" },
  rating: {
    position: "absolute",
    bottom: 8,
    flexDirection: "row",
    gap: 1,
    backgroundColor: "#222",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cta: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  ctaFilled: {
    backgroundColor: brand.accent,
    shadowColor: brand.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaOutline: {
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  themeTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 28,
    letterSpacing: -0.8,
    color: colors.text,
    marginRight: 90,
  },
  themeArt: {
    position: "absolute",
    top: 40,
    right: 12,
    width: 112,
    height: 112,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: brand.card,
    transform: [{ rotate: "-4deg" }],
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: brand.chip,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  rank: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  medal: {
    position: "absolute",
    left: -4,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: brand.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tourIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tourButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brand.accentSoft,
    backgroundColor: brand.card,
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepLine: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: brand.line,
  },
  step: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: brand.card,
    borderWidth: 1.5,
    borderColor: brand.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: brand.accent, borderColor: brand.accent },
});
