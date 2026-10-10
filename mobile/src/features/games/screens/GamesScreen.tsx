import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { BrandTitle } from "@/components/ui/BrandTitle";
import { ME } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { compactCount } from "@/lib/format";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { colors, common, fonts } from "@/theme";
import { leagueFor } from "../data/league";
import {
  liveGame,
  tour,
  weeklyFriends,
  weeklyTheme,
} from "../data/demo-defile";

const GOLD = "#F2B627";
const MEDALS = ["#F2B627", "#B9BCC6", "#D08A55"];
const LIVE_PHOTO = require("../../../../assets/images/defile/podyum-live.jpg");
const THEME_PHOTO = require("../../../../assets/images/defile/autumn-layers.jpg");

export function GamesScreen() {
  const message = usePreviewMessage();
  const soon = (what: string) =>
    message(`${what} oyun API'si bağlanınca açılacak.`);
  const myStars = getUser(ME)?.counts.stars ?? 0;
  const league = leagueFor(myStars);
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
            onPress={() => soon("Defile filtreleri")}
            style={styles.round}
          >
            <Ionicons name="options-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${league.name}, ${myStars} yıldız`}
          onPress={() => soon("Lig tablosu")}
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
                  color: colors.accent,
                }}
              >
                CANLI
              </Text>
            </View>
          </View>
          <Text style={styles.heroText}>{liveGame.description}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Cta
              label="Hızlı eşleş"
              icon="flash"
              filled
              onPress={() => soon("Hızlı eşleşme")}
            />
            <Cta
              label="Arkadaşlarla oda"
              icon="people-outline"
              onPress={() => soon("Arkadaş odası")}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Haftalık tema: ${weeklyTheme.title}`}
          onPress={() => soon("Tema detayı")}
          style={[styles.box, { gap: 12 }]}
        >
          <ThemeArt />
          <View style={[common.row, { gap: 8 }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <Text
              style={{ flex: 1, fontFamily: fonts.bold, color: colors.accent }}
            >
              Haftalık tema
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </View>
          <Text style={styles.themeTitle}>{weeklyTheme.title}</Text>
          <Text style={[styles.heroText, { marginRight: 110 }]}>
            {weeklyTheme.description}
          </Text>
          <View style={[common.row, { flexWrap: "wrap", gap: 10 }]}>
            <View style={styles.timer}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.bold,
                  color: colors.accent,
                }}
              >
                {weeklyTheme.timeLeft} kaldı
              </Text>
            </View>
            <View style={[common.row, { gap: 6 }]}>
              <View style={{ flexDirection: "row" }}>
                {weeklyTheme.sampleUsers.map((username, index) => (
                  <Avatar
                    key={username}
                    username={username}
                    size={28}
                    style={{ marginLeft: index ? -8 : 0 }}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {compactCount(weeklyTheme.participants)} katılımcı
              </Text>
            </View>
          </View>
          <Cta
            label="Katıl"
            icon="sparkles"
            filled
            onPress={() => soon("Haftalık temaya katılım")}
          />
        </Pressable>

        <View style={[styles.box, { gap: 12 }]}>
          <View style={common.spread}>
            <View style={[common.row, { gap: 8 }]}>
              <Ionicons name="people" size={20} color={colors.accent} />
              <Text>
                <Text style={{ fontFamily: fonts.bold, color: colors.accent }}>
                  Arkadaşlar
                </Text>
                <Text style={{ color: colors.muted }}> · bu hafta</Text>
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
              <Ionicons
                name="chevron-forward"
                size={15}
                color={colors.muted}
              />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {weeklyFriends.map((friend, index) => (
              <Pressable
                key={friend.username}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}. ${friend.username}, ${friend.stars} yıldız`}
                onPress={() =>
                  friend.username === ME
                    ? router.push("/profil")
                    : router.push({
                        pathname: "/u/[username]",
                        params: { username: friend.username },
                      })
                }
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
                    <Ionicons name="star" size={12} color={GOLD} />
                    <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                      {compactCount(friend.stars)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.box, common.row, { gap: 14 }]}>
          <View style={styles.tourIcon}>
            <Ionicons name="shirt" size={28} color={colors.accent} />
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
                onPress={() => soon("Podyum Turu")}
                style={styles.tourButton}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fonts.bold,
                    color: colors.accent,
                  }}
                >
                  Turu gör
                </Text>
                <Ionicons name="arrow-forward" size={15} color={colors.accent} />
              </Pressable>
            </View>
            <View style={styles.steps}>
              <View style={styles.stepLine} />
              {Array.from({ length: tour.total }, (_, index) => {
                const done = index < tour.step;
                return (
                  <View key={index} style={[styles.step, done && styles.stepDone]}>
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
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  filled?: boolean;
  onPress: () => void;
}) {
  const tint = filled ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
  const user = getUser(username);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accentSoft,
          borderWidth: 2,
          borderColor: colors.background,
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
          color: colors.accent,
        }}
      >
        {user?.initials ?? "?"}
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
      <Sticker name="star" color={colors.accent} size={30} top={-4} left={-8} />
      <Sticker
        name="sparkles"
        color={colors.accent}
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
  safe: { flex: 1, backgroundColor: colors.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    padding: 16,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
    backgroundColor: colors.chip,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  hero: { gap: 12, backgroundColor: colors.accentSoft },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontWeight: "700",
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
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
    backgroundColor: "#F3E3D3",
    borderWidth: 5,
    borderColor: colors.background,
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
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaOutline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  themeTitle: {
    fontFamily: fonts.extraBold,
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
    borderColor: colors.background,
    transform: [{ rotate: "-4deg" }],
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.chip,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  medal: {
    position: "absolute",
    left: -4,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  tourIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSoft,
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
    borderColor: colors.accentSoft,
    backgroundColor: colors.background,
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
    backgroundColor: colors.line,
  },
  step: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: colors.accent, borderColor: colors.accent },
});
