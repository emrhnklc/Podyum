import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { PillChip } from "@/components/ui/PillChip";
import { PreviewImage } from "@/components/media/PreviewImage";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  type PollCategory,
} from "@/constants/poll-categories";
import { blush, colors, common, fonts, serif } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";

const MAX_OPTIONS = 4;
const MAX_QUESTION = 100;
const LETTERS = ["A", "B", "C", "D"];
const TONES = ["#F6DCDC", "#ECDDF1", "#DDE6F1", "#F1EBDA"];
const BADGE_TONES = [
  "rgba(204,92,134,0.85)",
  "rgba(160,112,160,0.85)",
  "rgba(96,124,168,0.85)",
  "rgba(170,140,90,0.85)",
];
const DURATIONS = [
  { value: 1800, label: "30 dk" },
  { value: 7200, label: "2 saat" },
  { value: 86400, label: "24 saat" },
];
const GENDERS = [
  { value: "ALL", label: "Herkes", icon: "people" },
  { value: "WOMEN", label: "Kadınlar", icon: "female-outline" },
  { value: "MEN", label: "Erkekler", icon: "male-outline" },
] as const;
const AGES = [
  { value: "ALL", label: "Herkes", icon: "people" },
  { value: "18-24", label: "18–24", icon: "person-outline" },
  { value: "25-34", label: "25–34", icon: "person-outline" },
  { value: "35-44", label: "35–44", icon: "person-outline" },
  { value: "45+", label: "45+", icon: "person-outline" },
] as const;

type Photo = { uri: string; mimeType?: string; fileSize?: number };
type Option = { id: number; photo?: Photo };

export function CreatePollScreen() {
  const [options, setOptions] = useState<Option[]>([
    { id: 1 },
    { id: 2 },
  ]);
  const [nextId, setNextId] = useState(3);
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PollCategory>("OUTFIT");
  const [duration, setDuration] = useState(1800);
  const [gender, setGender] = useState<(typeof GENDERS)[number]["value"]>("ALL");
  const [age, setAge] = useState<(typeof AGES)[number]["value"]>("ALL");
  const [myStyle, setMyStyle] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [comments, setComments] = useState(true);
  const [blur, setBlur] = useState(true);
  const message = usePreviewMessage();
  const canPublish =
    options.length >= 2 &&
    options.every((option) => option.photo) &&
    question.trim().length > 0;

  function addOption() {
    setOptions((previous) => [...previous, { id: nextId }]);
    setNextId((id) => id + 1);
  }
  // Galeriden tek fotoğraf seçer. quality verildiği için iOS'taki HEIC
  // fotoğraflar JPEG'e çevrilir; backend HEIC kabul etmiyor.
  async function pick(id: number) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const photo = {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      };
      setOptions((previous) =>
        previous.map((option) =>
          option.id === id ? { ...option, photo } : option,
        ),
      );
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }
  function removeOption(id: number) {
    setOptions((previous) => previous.filter((option) => option.id !== id));
  }
  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vazgeç"
            onPress={cancel}
            hitSlop={8}
            style={[common.row, { gap: 8, zIndex: 1 }]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={{ fontSize: 17 }}>Vazgeç</Text>
          </Pressable>
          <Text style={styles.title} pointerEvents="none">
            Yeni oylama
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {options.map((option, index) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={
                option.photo
                  ? `${LETTERS[index]} fotoğrafını değiştir`
                  : `${LETTERS[index]} fotoğrafı ekle`
              }
              onPress={() => pick(option.id)}
              style={styles.tile}
            >
              <PreviewImage uri={option.photo?.uri} tone={TONES[index]} />
              {!option.photo && (
                <Text style={styles.tileHint}>Fotoğraf ekle</Text>
              )}
              <View
                style={[styles.badge, { backgroundColor: BADGE_TONES[index] }]}
              >
                <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
                  {LETTERS[index]}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${LETTERS[index]} seçeneğini kaldır`}
                onPress={() => removeOption(option.id)}
                hitSlop={6}
                style={styles.remove}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
              {option.photo && (
                <View style={styles.products}>
                  <Text style={{ fontSize: 13, fontFamily: fonts.semibold }}>
                    Değiştir
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
          {options.length < MAX_OPTIONS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Seçenek ekle"
              onPress={addOption}
              style={[styles.tile, styles.addTile]}
            >
              <View style={styles.plus}>
                <Ionicons name="add" size={28} color={blush.pink} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                Seçenek ekle
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                En fazla {MAX_OPTIONS}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        <Label>Sorun ne?</Label>
        <View style={styles.inputBox}>
          <TextInput
            accessibilityLabel="Oylama sorusu"
            value={question}
            onChangeText={setQuestion}
            maxLength={MAX_QUESTION}
            placeholder="Cuma akşamı ilk buluşma. Hangisi?"
            placeholderTextColor={colors.muted}
            selectionColor={blush.pink}
            multiline
            style={styles.input}
          />
          <Text style={styles.counter}>
            {question.length}/{MAX_QUESTION}
          </Text>
        </View>

        <Label>Kategori</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {(Object.keys(CATEGORY_LABEL) as PollCategory[]).map((value) => (
            <PillChip
              key={value}
              label={CATEGORY_LABEL[value]}
              icon={CATEGORY_ICON[value]}
              active={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </ScrollView>

        <Label>Oylama süresi</Label>
        <View style={styles.segment}>
          {DURATIONS.map((option) => {
            const active = duration === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setDuration(option.value)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={active ? blush.wine : colors.text}
                />
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    color: active ? blush.wine : colors.text,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.audience}>
          <View style={common.row}>
            <View style={styles.audienceIcon}>
              <Ionicons name="people" size={22} color={blush.wine} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>
                Kimler oylasın?
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Daha alakalı sonuçlar için kitle seçebilirsin.
              </Text>
            </View>
          </View>
          <ChoiceRow label="Cinsiyet">
            {GENDERS.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                active={gender === option.value}
                onPress={() => setGender(option.value)}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Yaş grubu">
            {AGES.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                active={age === option.value}
                onPress={() => setAge(option.value)}
              />
            ))}
          </ChoiceRow>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AudienceToggle
              label="Benim tarzımdakiler"
              icon="person-outline"
              active={myStyle}
              onPress={() => setMyStyle((value) => !value)}
            />
            <AudienceToggle
              label="Sadece arkadaşlarım"
              icon="people-outline"
              active={friendsOnly}
              onPress={() => setFriendsOnly((value) => !value)}
            />
          </View>
        </View>

        <View>
          <SwitchRow
            icon="chatbox-outline"
            title="Yorumlara izin ver"
            detail="Diğer kullanıcılar oylamana yorum yapabilir."
            value={comments}
            onChange={setComments}
          />
          <View style={styles.divider} />
          <SwitchRow
            icon="eye-off-outline"
            title="Yüzümü bulanıklaştır"
            detail="Fotoğraflarında yüzün otomatik bulanıklaştırılır."
            value={blur}
            onChange={setBlur}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yayına al"
          accessibilityState={{ disabled: !canPublish }}
          disabled={!canPublish}
          onPress={() =>
            message(
              "Fotoğrafların ve sorun hazır. Yayınlama, giriş ve sunucu bağlantısı eklendiğinde açılacak.",
            )
          }
          style={({ pressed }) => [
            styles.publish,
            { opacity: !canPublish ? 0.5 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 18,
              color: colors.onAccent,
            }}
          >
            Yayına al
          </Text>
          <Ionicons name="sparkles" size={20} color={colors.onAccent} />
        </Pressable>
        <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
          Seçtiğin fotoğraflar şimdilik yalnızca bu telefonda kalır. Giriş
          bağlandığında hesabınla birlikte sunucuya yüklenecek.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, marginBottom: -4 }}>
      {children}
    </Text>
  );
}

function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={[common.row, { gap: 8 }]}>
      <Text style={{ width: 78, fontSize: 14 }}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function AudienceToggle({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <Ionicons name={icon} size={18} color={active ? blush.wine : colors.text} />
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: active ? fonts.semibold : fonts.regular,
          color: active ? blush.wine : colors.text,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={styles.toggleDot}>
        <Ionicons
          name={active ? "checkmark" : "add"}
          size={15}
          color={colors.onAccent}
        />
      </View>
    </Pressable>
  );
}

function SwitchRow({
  icon,
  title,
  detail,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[common.row, { gap: 14, paddingVertical: 10 }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: blush.pink, false: blush.line }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: blush.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 28, gap: 16 },
  header: { minHeight: 44, justifyContent: "center" },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
  },
  tile: {
    width: 132,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tileHint: { fontSize: 12, color: colors.photoText, marginTop: 70 },
  addTile: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: blush.pinkSoft,
    gap: 4,
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: blush.chip,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  products: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inputBox: {
    borderRadius: 20,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  input: {
    minHeight: 48,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlignVertical: "top",
  },
  counter: { alignSelf: "flex-end", fontSize: 12, color: colors.muted },
  segment: {
    flexDirection: "row",
    padding: 4,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
  },
  segmentActive: { backgroundColor: blush.pinkSoft },
  audience: {
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
  },
  audienceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: blush.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 50,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 25,
    backgroundColor: blush.card,
    borderWidth: 1,
    borderColor: blush.line,
  },
  toggleActive: { backgroundColor: blush.pinkSoft, borderColor: blush.pink },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: blush.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: blush.line, marginLeft: 36 },
  publish: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: blush.pink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: blush.pink,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
