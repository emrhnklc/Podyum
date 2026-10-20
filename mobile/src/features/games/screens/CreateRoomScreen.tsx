import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts, serif } from "@/theme";
import { createLobby, type LobbyInput } from "../api/games";

const PREVIEW = require("../../../../assets/images/defile/podyum-live.jpg");
const MIN_MEMBERS = 2;
const MAX_MEMBERS = 50;
const NUMBER_WIDTH = 56;
const DURATIONS = [10, 15, 30];
const SLOT_MINUTES = 15;
const THEMES = [
  "90'lar",
  "Y2K",
  "Sokak stili",
  "Minimal",
  "Gece daveti",
  "Sonbahar katmanları",
];

type Slot = { label: string; value: string | null };

// Önümüzdeki 24 saat için 15 dakikalık başlangıç seçenekleri; en yakını en az
// 5 dakika sonrasıdır (sunucu en erken 1 dakika sonrasını kabul eder).
function startSlots(): Slot[] {
  const now = new Date();
  const first = new Date(now.getTime() + 5 * 60000);
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  const slots: Slot[] = [];
  for (
    let time = first;
    time.getTime() < now.getTime() + 23.75 * 3600000;
    time = new Date(time.getTime() + SLOT_MINUTES * 60000)
  ) {
    const day = time.getDate() === now.getDate() ? "Bugün" : "Yarın";
    const clock = time.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    slots.push({ label: `${day} ${clock}`, value: time.toISOString() });
  }
  return slots;
}

export function CreateRoomScreen() {
  const params = useLocalSearchParams<{ theme?: string; private?: string }>();
  const { client } = useAuth();
  const [slots] = useState(() => [
    ...startSlots(),
    { label: "Ben başlatırım", value: null },
  ]);
  const [theme, setTheme] = useState(params.theme?.slice(0, 120) || "90'lar");
  const [themesOpen, setThemesOpen] = useState(false);
  const [members, setMembers] = useState(8);
  const [minutes, setMinutes] = useState(15);
  const [start, setStart] = useState<Slot>(slots[0]);
  const [isPublic, setIsPublic] = useState(params.private !== "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aynı form için tek oda: ağ hatasında tekrar aynı anahtarla gönderilir.
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const numbers = useRef<ScrollView>(null);

  const canCreate = theme.trim().length > 0 && !busy;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/defile");

  // Sayı şeridi kaydırılınca ortaya gelen sayı seçilir.
  function onNumbersScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / NUMBER_WIDTH);
    setMembers(
      Math.min(MAX_MEMBERS, Math.max(MIN_MEMBERS, MIN_MEMBERS + index)),
    );
  }
  function pickMembers(value: number) {
    setMembers(value);
    numbers.current?.scrollTo({
      x: (value - MIN_MEMBERS) * NUMBER_WIDTH,
      animated: true,
    });
  }

  async function create() {
    if (!canCreate) return;
    const input: LobbyInput = {
      themeTitle: theme.trim(),
      maxMembers: members,
      submissionSeconds: minutes * 60,
      votingSeconds: minutes * 60,
      startsAt: start.value,
      isPublic,
    };
    const signature = JSON.stringify(input);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: Crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      const room = await createLobby(client, input, attempt.current.key);
      attempt.current = null;
      router.replace({
        pathname: "/games/[id]",
        params: { id: room.id, invite: "1" },
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.safe}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={back}
            hitSlop={10}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.caption}>YARIŞMA OLUŞTUR</Text>
          <Text style={styles.title} accessibilityRole="header">
            Yeni oda kur
          </Text>
        </View>

        <View style={styles.preview}>
          <Image source={PREVIEW} style={styles.previewImage} />
          <View style={{ flex: 1, gap: 6, padding: 14 }}>
            <Text style={styles.previewCaption}>ODA ÖNİZLEMESİ</Text>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {theme.trim() || "Tema seç"}
            </Text>
            <View style={styles.meta}>
              <Meta icon="people-outline" label={`${members} kişilik oda`} />
              <Meta icon="time-outline" label={`${minutes} dk`} />
              <Meta
                icon={isPublic ? "globe-outline" : "qr-code-outline"}
                label={isPublic ? "Herkese açık" : "Davetle"}
              />
              <Meta
                icon="calendar-outline"
                label={start.value ? start.label : "Sen başlatırsın"}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Tema</Text>
          <View style={styles.themeRow}>
            <View style={styles.themeInput}>
              <TextInput
                value={theme}
                onChangeText={setTheme}
                maxLength={120}
                placeholder="Tema yaz"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Tema"
                style={styles.input}
              />
              {!!theme && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Temayı temizle"
                  onPress={() => setTheme("")}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: themesOpen }}
              onPress={() => setThemesOpen((open) => !open)}
              style={styles.themeButton}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.text}
              />
              <Text style={{ fontFamily: fonts.semibold }}>Tema seç</Text>
            </Pressable>
          </View>
          {themesOpen && (
            <View style={styles.wrap}>
              {THEMES.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={theme === item}
                  onPress={() => {
                    setTheme(item);
                    setThemesOpen(false);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Row
            icon="people-outline"
            label="Katılımcı sayısı"
            value={`${members} kişi`}
          />
          <ScrollView
            ref={numbers}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={NUMBER_WIDTH}
            decelerationRate="fast"
            onMomentumScrollEnd={onNumbersScroll}
            onScrollEndDrag={onNumbersScroll}
            contentOffset={{ x: (8 - MIN_MEMBERS) * NUMBER_WIDTH, y: 0 }}
            contentContainerStyle={{ paddingVertical: 4 }}
            accessibilityLabel="Katılımcı sayısı seçici"
          >
            {Array.from(
              { length: MAX_MEMBERS - MIN_MEMBERS + 1 },
              (_, index) => {
                const value = MIN_MEMBERS + index;
                const active = value === members;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${value} kişi`}
                    accessibilityState={{ selected: active }}
                    onPress={() => pickMembers(value)}
                    style={[styles.number, active && styles.numberActive]}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        active && styles.numberTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>

          <View style={styles.divider} />
          <Row icon="time-outline" label="Süre" />
          <View style={styles.segment}>
            {DURATIONS.map((value) => (
              <Segment
                key={value}
                label={`${value} dk`}
                active={minutes === value}
                onPress={() => setMinutes(value)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            Kombin yükleme ve oylama ayrı ayrı bu kadar sürer.
          </Text>

          <View style={styles.divider} />
          <Row
            icon="calendar-outline"
            label="Başlangıç saati"
            value={start.label}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {slots.map((slot) => (
              <Chip
                key={slot.label}
                label={slot.label}
                active={slot.label === start.label}
                onPress={() => setStart(slot)}
              />
            ))}
          </ScrollView>
          <Text style={styles.hint}>
            {start.value
              ? "Bu saatte en az 2 kişi varsa defile kendiliğinden başlar; yoksa iptal olur."
              : "Oda en az 2 kişi olunca sen başlatırsın."}
          </Text>

          <View style={styles.divider} />
          <Row icon="globe-outline" label="Görünürlük" />
          <View style={styles.segment}>
            <Segment
              label="Herkese açık"
              active={isPublic}
              onPress={() => setIsPublic(true)}
            />
            <Segment
              label="Davetle"
              active={!isPublic}
              onPress={() => setIsPublic(false)}
            />
          </View>
          <Text style={styles.hint}>
            {isPublic
              ? "Hızlı eşleş'te görünür; herkes davetsiz katılabilir. Ayrıca QR ile de davet edebilirsin."
              : "Odaya yalnız QR davetinle girilir; davet ettiğin kişinin arkadaşın olması gerekmez."}
          </Text>
        </View>

        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Odayı oluştur"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          onPress={() => void create()}
          style={({ pressed }) => [
            styles.primary,
            { opacity: !canCreate ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryText}>Odayı oluştur</Text>
          )}
          {!busy && (
            <Ionicons name="arrow-forward" size={22} color={colors.onAccent} />
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16 }}>
        {label}
      </Text>
      {value && (
        <Text
          style={{
            fontSize: 14,
            color: brand.accentDark,
            fontFamily: fonts.semibold,
          }}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentItem, active && styles.segmentActive]}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          color: active ? colors.onAccent : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text
        style={{
          fontSize: 13,
          fontFamily: fonts.semibold,
          color: active ? colors.onAccent : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  header: { alignItems: "center", gap: 4 },
  back: { position: "absolute", left: 0, top: 4, zIndex: 1 },
  caption: {
    fontSize: 12,
    letterSpacing: 3,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
  },
  preview: {
    flexDirection: "row",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
  },
  previewImage: { width: 112, height: "100%", minHeight: 130 },
  previewCaption: {
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  previewTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 30,
    color: colors.text,
  },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  label: { fontFamily: fonts.semibold, fontSize: 16 },
  themeRow: { flexDirection: "row", gap: 8 },
  themeInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: brand.accentSoft,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 10,
  },
  themeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 25,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  number: {
    width: NUMBER_WIDTH - 6,
    height: 48,
    marginRight: 6,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.background,
  },
  numberActive: { backgroundColor: brand.accentDark },
  numberText: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text },
  numberTextActive: { color: colors.onAccent, fontFamily: fonts.bold },
  divider: { height: 1, backgroundColor: brand.line },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 26,
    backgroundColor: brand.background,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: brand.accentDark },
  chip: {
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  chipActive: {
    backgroundColor: brand.accentDark,
    borderColor: brand.accentDark,
  },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  primary: {
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: brand.accentDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: { fontFamily: serif, fontSize: 22, color: colors.onAccent },
});
