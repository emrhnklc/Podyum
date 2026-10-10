import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { ApiImage } from "@/components/media/ApiImage";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { brand, colors, fonts, serif } from "@/theme";
import { getTurn, rateSubmission, type GameTurn } from "../api/games";

const REFRESH_MS = 2000;
const RING = 64;
const STROKE = 5;

// Podyum Turu: herkes aynı yarışmacıyı aynı anda görür. Yıldıza dokununca oy
// hemen gider; tur süresi bitince sıradaki yarışmacıya geçilir.
export function PodiumTurnView({
  gameId,
  themeTitle,
  onClose,
  onFinished,
}: {
  gameId: string;
  themeTitle: string;
  onClose: () => void;
  // Oylama bitince oda yeniden okunur ve sonuç ekranı açılır.
  onFinished: () => void;
}) {
  const { client } = useAuth();
  const [turn, setTurn] = useState<GameTurn | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deadline = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const row = await getTurn(client, gameId);
      const delta = Date.parse(row.serverNow) - Date.now();
      deadline.current = Date.parse(row.turnEndsAt) - delta;
      setOffset(delta);
      setTurn(row);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "VOTING_CLOSED")
        onFinished();
      else setError(errorMessage(failure));
    }
  }, [client, gameId, onFinished]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const refresh = setInterval(() => void load(), REFRESH_MS);
      const tick = setInterval(() => {
        const current = Date.now();
        setNow(current);
        if (deadline.current !== null && current >= deadline.current) {
          deadline.current = null;
          void load();
        }
      }, 250);
      return () => {
        clearInterval(refresh);
        clearInterval(tick);
      };
    }, [load]),
  );

  async function rate(stars: number) {
    const entry = turn?.current;
    if (!entry || entry.mine || entry.myStars || sending) return;
    setSending(stars);
    setError(null);
    try {
      await rateSubmission(client, gameId, entry.id, stars);
      setTurn((previous) =>
        previous?.current
          ? {
              ...previous,
              votedCount: previous.votedCount + 1,
              current: { ...previous.current, myStars: stars },
            }
          : previous,
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(null);
    }
  }

  const left = turn
    ? Math.max(0, (Date.parse(turn.turnEndsAt) - (now + offset)) / 1000)
    : 0;
  const entry = turn?.current ?? null;
  const shownStars = sending ?? entry?.myStars ?? 0;

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
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Text style={styles.caption}>
              PODYUM TURU{turn ? ` · ${turn.index + 1}/${turn.total}` : ""}
            </Text>
            <Text
              style={styles.title}
              accessibilityRole="header"
              numberOfLines={1}
            >
              Tema: {themeTitle}
            </Text>
          </View>
          <Ring seconds={left} total={turn?.turnSeconds ?? 1} />
        </View>

        {turn && (
          <View style={styles.segments}>
            {Array.from({ length: turn.total }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  index < turn.index && { backgroundColor: brand.accent },
                  index === turn.index && { backgroundColor: brand.accentDark },
                ]}
              />
            ))}
          </View>
        )}

        <View style={styles.photo}>
          {entry ? (
            <ApiImage path={entry.displayPath} />
          ) : (
            <View style={styles.center}>
              <Text style={{ color: colors.muted }}>
                {turn ? "Bu kombin sana gösterilmiyor." : "Yükleniyor…"}
              </Text>
            </View>
          )}
          {entry && (
            <View style={[styles.pill, { left: 12 }]}>
              <Text style={styles.pillTitle}>Yarışmacı #{entry.number}</Text>
            </View>
          )}
          {(entry?.mine || turn?.myTurnIn) && (
            <View
              style={[styles.pill, { right: 12, flexDirection: "row", gap: 6 }]}
            >
              <View style={styles.dot} />
              <Text style={{ fontSize: 13 }}>
                {entry?.mine
                  ? "Senin kombinin"
                  : `Senin kombinin ${turn?.myTurnIn} tur sonra`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.vote}>
          <Text style={styles.voteTitle}>
            {entry?.mine
              ? "Kendi kombinine oy veremezsin"
              : entry?.myStars
                ? `Oyun gitti · ${entry.myStars} yıldız`
                : "Kaç yıldız? Dokun, oyun anında gider"}
          </Text>
          <View style={styles.stars} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((value) => {
              const disabled =
                !entry || entry.mine || !!entry.myStars || sending !== null;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} yıldız`}
                  accessibilityState={{
                    checked: shownStars === value,
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => void rate(value)}
                  hitSlop={4}
                >
                  <Ionicons
                    name={value <= shownStars ? "star" : "star-outline"}
                    size={44}
                    color={value <= shownStars ? brand.accent : colors.muted}
                    style={{ opacity: entry?.mine ? 0.35 : 1 }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        {turn && (
          <View style={styles.footer}>
            <Ionicons name="people" size={22} color={brand.accent} />
            <Text style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold }}>
                {turn.votedCount}/{turn.voterCount}
              </Text>{" "}
              kişi oyladı
            </Text>
            <Text style={{ fontSize: 14 }}>
              {turn.nextNumber ? (
                <>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                    Sıradaki:{" "}
                  </Text>
                  Yarışmacı #{turn.nextNumber}
                </>
              ) : (
                "Son yarışmacı"
              )}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Turun kalan süresini gösteren daire.
function Ring({ seconds, total }: { seconds: number; total: number }) {
  const radius = (RING - STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const progress = Math.min(1, seconds / total);
  return (
    <View
      style={{ width: RING, height: RING }}
      accessibilityLabel={`Turun bitmesine ${Math.ceil(seconds)} saniye`}
    >
      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={brand.line}
          strokeWidth={STROKE}
          fill={brand.card}
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={brand.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - progress)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22 }}>
          {Math.ceil(seconds)}
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
    gap: 14,
    padding: 16,
    borderRadius: 32,
    backgroundColor: brand.card,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    fontSize: 12,
    letterSpacing: 3,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.text,
  },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: brand.line },
  photo: {
    height: 420,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: brand.background,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pill: {
    position: "absolute",
    top: 12,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(250,248,245,0.92)",
  },
  pillTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 16,
    color: colors.text,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: brand.accent,
  },
  vote: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: brand.background,
    alignItems: "center",
  },
  voteTitle: {
    fontFamily: serif,
    fontSize: 17,
    color: colors.text,
    textAlign: "center",
  },
  stars: { flexDirection: "row", gap: 14 },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
});
