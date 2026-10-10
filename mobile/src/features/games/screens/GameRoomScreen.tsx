import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { ApiImage } from "@/components/media/ApiImage";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts, serif } from "@/theme";
import { GameResultsView } from "../components/GameResultsView";
import { InviteCard } from "../components/InviteCard";
import { PodiumTurnView } from "../components/PodiumTurnView";
import {
  getGame,
  startNow,
  submitGamePhoto,
  type GamePhase,
  type GameState,
} from "../api/games";

const REFRESH_MS = 10_000;
const MAX_DOTS = 8;
const PHASE_LABEL: Record<GamePhase, string> = {
  SCHEDULED: "BAŞLAMADI",
  WAITING: "BEKLEME",
  SUBMISSION: "HAZIRLIK",
  VOTING: "OYLAMA",
  COMPLETED: "SONUÇ",
  CANCELLED: "İPTAL",
};

// Defile odasına girince ilk görülen ekran: tema, sunucu saatine göre geri
// sayım, kombin yükleme ve odadakilerin teslim durumu.
export function GameRoomScreen({
  id,
  justCreated = false,
}: {
  id: string;
  // Oda yeni kurulduysa davet QR'ı kendiliğinden hazırlanır.
  justCreated?: boolean;
}) {
  const { client } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Telefon saati yerine sunucu saati: serverNow ile yerel saat farkı.
  const [offset, setOffset] = useState(0);
  // Saniyelik zamanlayıcı süre bitişini görebilsin diye son bitiş anı.
  const deadline = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const state = await getGame(client, id);
      const delta = Date.parse(state.serverNow) - Date.now();
      deadline.current = state.phaseEndsAt
        ? Date.parse(state.phaseEndsAt) - delta
        : null;
      setOffset(delta);
      setGame(state);
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }, [client, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const refresh = setInterval(() => void load(), REFRESH_MS);
      // Süre dolunca aşama sunucuda ilerler; yeni durumu hemen oku.
      const tick = setInterval(() => {
        const current = Date.now();
        setNow(current);
        if (deadline.current !== null && current >= deadline.current) {
          deadline.current = null;
          void load();
        }
      }, 1000);
      return () => {
        clearInterval(refresh);
        clearInterval(tick);
      };
    }, [load]),
  );

  const endsAt = game?.phaseEndsAt ? Date.parse(game.phaseEndsAt) : null;
  const remaining = endsAt
    ? Math.max(0, Math.round((endsAt - (now + offset)) / 1000))
    : null;

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/defile");

  async function upload(source: "camera" | "library") {
    if (!game?.canSubmit || uploading) return;
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Kamera izni verilmedi. Galeriden seçebilirsin.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.85,
        });
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading(true);
      setError(null);
      await submitGamePhoto(client, id, {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        fileName: asset.fileName,
      });
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setUploading(false);
    }
  }

  if (!game)
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={{ alignItems: "center", gap: 12, padding: 24 }}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={{ fontFamily: fonts.bold, color: brand.accent }}>
                Tekrar dene
              </Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator color={brand.accent} />
        )}
      </SafeAreaView>
    );

  const submitting = game.phase === "SUBMISSION";
  const notStarted = game.phase === "SCHEDULED" || game.phase === "WAITING";
  const submitted = !!game.mySubmission;
  const roomLabel = game.maxMembers
    ? `${game.maxMembers} KİŞİLİK ODA`
    : "GÜNLÜK DEFİLE";
  const total = submitting ? game.submissionSeconds : null;
  // Saat seçilmemiş bekleyen odada geri sayım yok; oda sahibi başlatır.
  const manualStart = game.phase === "WAITING" && !game.startsAt;
  const hostPrivate = game.isHost && game.kind === "PRIVATE";
  const canStart =
    hostPrivate && game.phase === "WAITING" && game.memberCount >= 2;

  async function start() {
    if (!game || !canStart || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await startNow(client, game);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setUploading(false);
    }
  }

  if (game.phase === "COMPLETED")
    return (
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={styles.safe}
      >
        <GameResultsView
          gameId={game.id}
          themeTitle={game.themeTitle}
          onClose={close}
        />
      </SafeAreaView>
    );

  // Oylama: herkesin aynı yarışmacıyı aynı anda gördüğü Podyum Turu.
  if (game.phase === "VOTING")
    return (
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={styles.safe}
      >
        <PodiumTurnView
          gameId={game.id}
          themeTitle={game.themeTitle}
          onClose={close}
          onFinished={load}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.safe}
    >
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
              onPress={close}
              hitSlop={10}
              style={styles.close}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
            <Text style={styles.caption}>
              {PHASE_LABEL[game.phase]} · {roomLabel}
            </Text>
            <View style={styles.titleRow}>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={brand.accentSoft}
              />
              <Text style={styles.title} accessibilityRole="header">
                Tema: {game.themeTitle}
              </Text>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={brand.accentSoft}
              />
            </View>
          </View>

          {manualStart && (
            <View style={styles.timer}>
              <Ionicons
                name="hourglass-outline"
                size={24}
                color={brand.accentDark}
              />
              <Text style={{ flex: 1, fontSize: 15 }}>
                {game.isHost
                  ? "En az 2 kişi olunca defileyi sen başlatırsın."
                  : "Oda sahibi başlatınca defile başlar."}
              </Text>
            </View>
          )}

          {remaining !== null && !manualStart && (
            <View style={styles.timer}>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={{ fontSize: 16 }}>
                  {submitting
                    ? "Podyuma kalan süre"
                    : notStarted
                      ? "Başlamasına kalan süre"
                      : "Bu aşamanın bitmesine"}
                </Text>
                {total && (
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.min(100, (remaining / total) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              <Text
                style={styles.clock}
                accessibilityLabel={`${Math.floor(remaining / 60)} dakika ${remaining % 60} saniye`}
              >
                {clock(remaining)}
              </Text>
            </View>
          )}

          {submitting || notStarted ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                submitted ? "Fotoğrafını değiştir" : "Kombinini yükle"
              }
              accessibilityState={{ disabled: !game.canSubmit || uploading }}
              disabled={!game.canSubmit || uploading}
              onPress={() => void upload("camera")}
              style={styles.drop}
            >
              {submitted && game.mySubmission ? (
                <>
                  <ApiImage
                    path={`/v1/media/${game.mySubmission.mediaId}/content`}
                  />
                  <View style={styles.badge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={brand.accent}
                    />
                    <Text style={{ fontSize: 13, fontFamily: fonts.semibold }}>
                      Kombinin podyumda · değiştirmek için dokun
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.cameraCircle}>
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color={colors.text}
                    />
                  </View>
                  <Text style={styles.dropTitle}>
                    {notStarted ? "Kombinini hazırla" : "Kombinini yükle"}
                  </Text>
                  <Text style={styles.dropHint}>
                    {notStarted
                      ? "Defile başlayınca fotoğrafını yükleyebilirsin"
                      : "Fotoğraf çek veya galeriden seç"}
                  </Text>
                </>
              )}
              {uploading && (
                <View style={styles.uploading}>
                  <ActivityIndicator color={brand.accent} />
                  <Text style={{ fontFamily: fonts.semibold }}>
                    Yükleniyor…
                  </Text>
                </View>
              )}
            </Pressable>
          ) : (
            <View style={[styles.drop, { borderStyle: "solid" }]}>
              <Ionicons
                name="close-circle-outline"
                size={40}
                color={brand.accent}
              />
              <Text style={styles.dropTitle}>Defile iptal edildi</Text>
              <Text style={styles.dropHint}>
                {cancelText(game.cancelReason)}
              </Text>
            </View>
          )}

          <Members game={game} />

          {hostPrivate && (game.phase === "WAITING" || submitting) && (
            <InviteCard
              game={game}
              autoCreate={justCreated && game.phase === "WAITING"}
            />
          )}

          {hostPrivate && game.phase === "WAITING" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Şimdi başlat"
              accessibilityState={{ disabled: !canStart || uploading }}
              disabled={!canStart || uploading}
              onPress={() => void start()}
              style={({ pressed }) => [
                styles.startButton,
                { opacity: !canStart || uploading ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="play" size={18} color={brand.accentDark} />
              <Text style={{ fontFamily: fonts.bold, color: brand.accentDark }}>
                {canStart
                  ? "Şimdi başlat"
                  : "Başlatmak için en az 2 kişi gerekli"}
              </Text>
            </Pressable>
          )}

          <View style={styles.info}>
            <View style={styles.infoIcon}>
              <Ionicons name="star" size={22} color={brand.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>
                {submitted
                  ? "Süre bitene kadar değiştirebilirsin"
                  : "Süre bitince Podyum Turu başlar"}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Kombinler sırayla herkese aynı anda gösterilir, her birine 1–5
                yıldız verilir. En az iki kombin yüklenmezse defile iptal olur.
              </Text>
            </View>
          </View>

          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}

          {(submitting || notStarted) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                submitted ? "Fotoğrafı değiştir" : "Fotoğraf yükle"
              }
              accessibilityState={{ disabled: !game.canSubmit || uploading }}
              disabled={!game.canSubmit || uploading}
              onPress={() => void upload("library")}
              style={({ pressed }) => [
                styles.primary,
                {
                  opacity:
                    !game.canSubmit || uploading ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.primaryText}>
                {submitted ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
              </Text>
              <Ionicons
                name="share-outline"
                size={24}
                color={colors.onAccent}
              />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Backend teslim edenleri tek tek değil sayı olarak verir: tikler kaç kişinin
// yüklediğini, "Sen" kendi durumunu, boş daireler kalan yerleri gösterir.
function Members({ game }: { game: GameState }) {
  const mine = !!game.mySubmission;
  const othersDone = Math.max(0, game.submissionCount - (mine ? 1 : 0));
  const othersWaiting = Math.max(0, game.memberCount - 1 - othersDone);
  const free = game.maxMembers
    ? Math.max(0, game.maxMembers - game.memberCount)
    : 0;
  const dots: ("done" | "me" | "waiting" | "free")[] = [
    ...Array<"done">(othersDone).fill("done"),
    "me",
    ...Array<"waiting">(othersWaiting).fill("waiting"),
    ...Array<"free">(free).fill("free"),
  ];
  const shown = dots.length > MAX_DOTS ? dots.slice(0, MAX_DOTS - 1) : dots;
  const hidden = dots.length - shown.length;
  return (
    <View style={styles.members}>
      <View style={styles.membersHead}>
        <Text style={{ fontSize: 16 }}>Odadakiler</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          <Text style={{ fontFamily: fonts.bold, color: brand.accent }}>
            {game.submissionCount}/{game.memberCount}
          </Text>{" "}
          kombini yükledi
        </Text>
      </View>
      <View style={styles.dots}>
        {shown.map((dot, index) =>
          dot === "me" ? (
            <View
              key={index}
              style={[styles.dot, mine ? styles.dotDone : styles.dotMe]}
              accessibilityLabel={
                mine ? "Sen, yükledin" : "Sen, henüz yüklemedin"
              }
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.semibold,
                  color: mine ? colors.onAccent : colors.text,
                }}
              >
                Sen
              </Text>
            </View>
          ) : (
            <View
              key={index}
              style={[
                styles.dot,
                dot === "done" && styles.dotDone,
                dot === "waiting" && styles.dotWaiting,
                dot === "free" && styles.dotFree,
              ]}
            >
              {dot === "done" && (
                <Ionicons name="checkmark" size={20} color={colors.onAccent} />
              )}
            </View>
          ),
        )}
        {hidden > 0 && (
          <View style={[styles.dot, styles.dotFree]}>
            <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
              +{hidden}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
}

function cancelText(reason: string | null) {
  if (reason === "NOT_ENOUGH_SUBMISSIONS")
    return "En az iki kombin yüklenmediği için defile iptal oldu.";
  if (reason === "NOT_ENOUGH_PLAYERS")
    return "Başlangıç saatinde odada en az iki kişi yoktu.";
  if (reason === "HOST_LEFT") return "Oda sahibi defile başlamadan ayrıldı.";
  if (reason === "LOBBY_EXPIRED") return "Oda 24 saat içinde başlatılmadı.";
  return "Bu defile iptal edildi.";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
  center: { alignItems: "center", justifyContent: "center" },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 12, flexGrow: 1 },
  sheet: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    borderRadius: 32,
    backgroundColor: brand.card,
    shadowColor: brand.accentDark,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  header: { alignItems: "center", gap: 6, paddingTop: 4 },
  close: { position: "absolute", left: 0, top: 0, zIndex: 1 },
  caption: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 32,
    letterSpacing: -0.8,
    color: colors.text,
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: brand.chip,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 5, backgroundColor: brand.accent },
  clock: {
    fontFamily: fonts.extraBold,
    fontSize: 40,
    color: brand.accentDark,
    fontVariant: ["tabular-nums"],
  },
  drop: {
    minHeight: 300,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: brand.accentSoft,
    backgroundColor: brand.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
    overflow: "hidden",
  },
  cameraCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: brand.chip,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  dropTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 24,
    color: colors.text,
    textAlign: "center",
  },
  dropHint: { fontSize: 14, color: colors.muted, textAlign: "center" },
  badge: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: brand.card,
  },
  uploading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(250,248,245,0.85)",
  },
  members: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  membersHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: brand.accent },
  dotMe: {
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: brand.card,
  },
  dotWaiting: {
    backgroundColor: brand.chip,
    borderWidth: 1,
    borderColor: brand.accentSoft,
  },
  dotFree: { backgroundColor: brand.chip },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  startButton: {
    minHeight: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: brand.accentDark,
  },
  primary: {
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: brand.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: brand.accentDark,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryText: { fontFamily: serif, fontSize: 22, color: colors.onAccent },
});
