import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { ApiImage } from "@/components/media/ApiImage";
import { Button } from "@/components/ui/Button";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiQuery } from "@/hooks/use-api-query";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  type PollCategory,
} from "@/constants/poll-categories";
import { brand, colors, common, fonts, serif } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { ProductTagEditor } from "../components/ProductTagEditor";
import { productTitle, type ProductTagDraft } from "../product-tags";
import {
  newProgress,
  publishPoll,
  preparePollPhotos,
  type PickedPhoto,
  type PublishProgress,
} from "../api/publish-poll";

const MAX_OPTIONS = 4;
const MAX_QUESTION = 100;
const LETTERS = ["A", "B", "C", "D"];
const TONES = ["#EAD7C6", "#E4D6CB", "#DDE2E6", "#F1EBDA"];
const BADGE_TONES = [
  "rgba(183,118,74,0.9)",
  "rgba(107,65,40,0.85)",
  "rgba(140,120,100,0.85)",
  "rgba(170,140,90,0.85)",
];
const DURATIONS = [
  { value: 1800, label: "30 dk" },
  { value: 7200, label: "2 saat" },
  { value: 86400, label: "24 saat" },
];

type Option = { id: number; photo?: PickedPhoto; products?: ProductTagDraft[] };

export function CreatePollScreen() {
  const [options, setOptions] = useState<Option[]>([{ id: 1 }, { id: 2 }]);
  const [nextId, setNextId] = useState(3);
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PollCategory>("OUTFIT");
  const [duration, setDuration] = useState(1800);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [comments, setComments] = useState(true);
  const [blur, setBlur] = useState(false);
  const [noFaces, setNoFaces] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProducts, setEditingProducts] = useState<number | null>(null);
  const { client } = useAuth();
  const defaults = useApiQuery<{
    defaultPollVisibility: "PUBLIC" | "FRIENDS";
    defaultCommentsEnabled: boolean;
    defaultBlurFace: boolean;
  }>("/me/settings");
  const initialized = useRef(false);
  const [defaultsReady, setDefaultsReady] = useState(false);
  useEffect(() => {
    if (!defaults.data || initialized.current) return;
    initialized.current = true;
    setFriendsOnly(defaults.data.defaultPollVisibility === "FRIENDS");
    setComments(defaults.data.defaultCommentsEnabled);
    setBlur(defaults.data.defaultBlurFace);
    setDefaultsReady(true);
  }, [defaults.data]);
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const [loadedPreviews, setLoadedPreviews] = useState<string[]>([]);
  const publishing = useRef(false);
  const message = usePreviewMessage();
  // Yarıda kalan yayın; form değişirse sıfırlanır ki eski fotoğraf/taslak
  // yeni içerikle karışmasın.
  const progress = useRef<{ signature: string; value: PublishProgress } | null>(
    null,
  );
  const busy = busyStep !== null;
  const canPublish =
    !busy &&
    defaultsReady &&
    !defaults.loading &&
    !defaults.error &&
    options.length >= 2 &&
    options.every((option) => option.photo) &&
    question.trim().length > 0 &&
    (!blur || noFaces);

  async function publish(confirmed = false) {
    if (!canPublish || publishing.current) return;
    publishing.current = true;
    const input = {
      question,
      category,
      durationSeconds: duration,
      visibility: friendsOnly ? ("FRIENDS" as const) : ("PUBLIC" as const),
      commentsEnabled: comments,
      blur,
      confirmNoFaces: blur && noFaces,
      photos: options.map((option) => option.photo!),
      products: options.map((option) => option.products ?? []),
    };
    const signature = JSON.stringify(input);
    if (progress.current?.signature !== signature)
      progress.current = { signature, value: newProgress(input.photos.length) };
    setError(null);
    setBusyStep("Hazırlanıyor");
    try {
      if (!confirmed) {
        await preparePollPhotos(
          client,
          input,
          progress.current.value,
          setBusyStep,
        );
        setLoadedPreviews([]);
        setPreviewIds(progress.current.value.mediaIds as string[]);
        return;
      }
      progress.current.value.previewApproved = true;
      const id = await publishPoll(
        client,
        input,
        progress.current.value,
        setBusyStep,
      );
      progress.current = null;
      setOptions([{ id: 1 }, { id: 2 }]);
      setNextId(3);
      setQuestion("");
      setNoFaces(false);
      setPreviewIds(null);
      router.push({ pathname: "/polls/[id]", params: { id } });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusyStep(null);
      publishing.current = false;
    }
  }

  function addOption() {
    if (busy) return;
    setOptions((previous) => [...previous, { id: nextId }]);
    setNextId((id) => id + 1);
  }
  // Galeriden tek fotoğraf seçer. quality verildiği için iOS'taki HEIC
  // fotoğraflar JPEG'e çevrilir; backend HEIC kabul etmiyor.
  async function pick(id: number) {
    if (busy) return;
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
        fileName: asset.fileName,
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
    if (busy) return;
    setOptions((previous) => previous.filter((option) => option.id !== id));
  }
  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  if (!defaultsReady)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.page, { padding: 20, gap: 16 }]}>
          <Button title="Vazgeç" variant="outline" onPress={cancel} />
          <ApiStatus
            loading={defaults.loading}
            error={defaults.error}
            retry={defaults.refresh}
          />
        </View>
      </SafeAreaView>
    );

  if (previewIds)
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={[styles.content, { gap: 16 }]}
        >
          <Text style={styles.title}>Fotoğrafları kontrol et</Text>
          <Text>
            Fotoğraflarının son halini kontrol edip yayınlamayı onayla.
          </Text>
          <ApiStatus loading={busy} error={error} />
          {previewIds.map((id) => (
            <View
              key={id}
              style={{ height: 360, overflow: "hidden", borderRadius: 20 }}
            >
              <ApiImage
                path={`/v1/media/${id}/content`}
                retryable
                onLoad={() =>
                  setLoadedPreviews((old) =>
                    old.includes(id) ? old : [...old, id],
                  )
                }
              />
            </View>
          ))}
          <Button
            title="Fotoğrafları onayla ve yayınla"
            disabled={busy || loadedPreviews.length !== previewIds.length}
            onPress={() => void publish(true)}
          />
          <Button
            title="Düzenlemeye dön"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setPreviewIds(null);
              if (progress.current)
                progress.current.value.previewApproved = false;
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );

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
        <ApiStatus
          loading={defaults.loading}
          error={defaults.error}
          retry={defaults.refresh}
        />

        {editingProducts !== null &&
          options.some((option) => option.id === editingProducts) && (
            <ProductTagEditor
              key={editingProducts}
              label={`${LETTERS[options.findIndex((option) => option.id === editingProducts)]} Kombini`}
              initial={
                options.find((option) => option.id === editingProducts)
                  ?.products ?? []
              }
              category={category}
              onClose={() => setEditingProducts(null)}
              onSave={(products) => {
                setOptions((current) =>
                  current.map((option) =>
                    option.id === editingProducts
                      ? { ...option, products }
                      : option,
                  ),
                );
                setEditingProducts(null);
              }}
            />
          )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {options.map((option, index) => (
            // Kaldır düğmesi fotoğraf düğmesinin içinde değil yanında durur;
            // iç içe düğme web'de geçersiz HTML üretir.
            <View key={option.id} style={{ gap: 8, width: 132 }}>
              <View style={styles.tile}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    option.photo
                      ? `${LETTERS[index]} fotoğrafını değiştir`
                      : `${LETTERS[index]} fotoğrafı ekle`
                  }
                  onPress={() => pick(option.id)}
                  style={styles.tilePress}
                >
                  <PreviewImage uri={option.photo?.uri} tone={TONES[index]} />
                  {!option.photo && (
                    <Text style={styles.tileHint}>Fotoğraf ekle</Text>
                  )}
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: BADGE_TONES[index] },
                    ]}
                  >
                    <Text
                      style={{ fontFamily: fonts.bold, color: colors.onAccent }}
                    >
                      {LETTERS[index]}
                    </Text>
                  </View>
                  {option.photo && (
                    <View style={styles.products}>
                      <Text
                        style={{ fontSize: 13, fontFamily: fonts.semibold }}
                      >
                        Değiştir
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${LETTERS[index]} seçeneğini kaldır`}
                  onPress={() => removeOption(option.id)}
                  hitSlop={6}
                  style={styles.remove}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${LETTERS[index]} ürünlerini düzenle`}
                disabled={busy}
                onPress={() => setEditingProducts(option.id)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: brand.line,
                  backgroundColor: brand.surface,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontFamily: fonts.semibold,
                    fontSize: 13,
                  }}
                >
                  {option.products?.length
                    ? `${option.products.length} ürün · Düzenle`
                    : "+ Ürün etiketle"}
                </Text>
              </Pressable>
              {!!option.products?.length && (
                <Text
                  style={{ fontSize: 12, color: colors.muted }}
                  numberOfLines={2}
                >
                  {option.products.map(productTitle).join(", ")}
                </Text>
              )}
            </View>
          ))}
          {options.length < MAX_OPTIONS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Seçenek ekle"
              onPress={addOption}
              style={[styles.tile, styles.addTile]}
            >
              <View style={styles.plus}>
                <Ionicons name="add" size={28} color={brand.accent} />
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
            selectionColor={brand.accent}
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
                  color={active ? brand.accentDark : colors.text}
                />
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    color: active ? brand.accentDark : colors.text,
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
              <Ionicons name="people" size={22} color={brand.accentDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>
                Kimler oylasın?
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Oylamanı kimlerin görüp oy verebileceğini seç.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AudienceToggle
              label="Herkes"
              icon="globe-outline"
              active={!friendsOnly}
              onPress={() => setFriendsOnly(false)}
            />
            <AudienceToggle
              label="Sadece arkadaşlarım"
              icon="people-outline"
              active={friendsOnly}
              onPress={() => setFriendsOnly(true)}
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
            detail="Yüz bölgesi seçme ekranı henüz yok."
            value={blur}
            onChange={(value) => {
              setBlur(value);
              setNoFaces(false);
            }}
          />
          {blur && (
            <SwitchRow
              icon="checkmark-circle-outline"
              title="Fotoğraflarımda yüz görünmüyor"
              detail="Yüzün görünüyorsa bulanıklaştırmayı kapat ya da yüzsüz bir fotoğraf seç; bölge seçimi gelince yüzünü işaretleyebileceksin."
              value={noFaces}
              onChange={setNoFaces}
            />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yayına al"
          accessibilityState={{ disabled: !canPublish }}
          disabled={!canPublish}
          onPress={() => void publish()}
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
            {busyStep ?? "Yayına al"}
          </Text>
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Ionicons name="sparkles" size={20} color={colors.onAccent} />
          )}
        </Pressable>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Text
          style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}
        >
          Yayına al&apos;dan sonra işlenmiş fotoğrafları görüp son hallerini
          onaylarsın. Yayından sonra fotoğraf ve soru değiştirilemez.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text
      style={{ fontFamily: fonts.semibold, fontSize: 16, marginBottom: -4 }}
    >
      {children}
    </Text>
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
      <Ionicons
        name={icon}
        size={18}
        color={active ? brand.accentDark : colors.text}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: active ? fonts.semibold : fonts.regular,
          color: active ? brand.accentDark : colors.text,
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
        trackColor={{ true: brand.accent, false: brand.line }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
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
  tilePress: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tileHint: { fontSize: 12, color: colors.photoText, marginTop: 70 },
  addTile: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: brand.accentSoft,
    gap: 4,
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: brand.chip,
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
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
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
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
  },
  segmentActive: { backgroundColor: brand.accentSoft },
  audience: {
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
  },
  audienceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: brand.chip,
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
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  toggleActive: {
    backgroundColor: brand.accentSoft,
    borderColor: brand.accent,
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: brand.line, marginLeft: 36 },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  publish: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: brand.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: brand.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
