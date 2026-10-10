import { useState, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { ME } from "@/constants/demo";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { blush, colors, fonts } from "@/theme";
import {
  useProfileEdits,
  useProfileUser,
  type SocialLinks,
} from "../hooks/use-profile-edits";

const MAX_BIO = 150;
const MAX_TAGS = 6;
const HANDLE_PATTERN = /^[a-z0-9._]{3,30}$/;

const SOCIALS: {
  key: keyof SocialLinks;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  url: (handle: string) => string;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    color: "#D62976",
    url: (handle) => `https://instagram.com/${handle}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: "logo-tiktok",
    color: "#111111",
    url: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "logo-youtube",
    color: "#FF0000",
    url: (handle) => `https://www.youtube.com/@${handle}`,
  },
];

const stripAt = (value: string) => value.trim().replace(/^@+/, "");

export function EditProfileScreen() {
  const { user, handle: savedHandle, edits } = useProfileUser(ME);
  const { save } = useProfileEdits();
  const message = usePreviewMessage();
  const [handle, setHandle] = useState(savedHandle ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [tags, setTags] = useState<string[]>(user?.styles ?? []);
  const [newTag, setNewTag] = useState<string | null>(null);
  const [avatar, setAvatar] = useState(user?.avatar);
  const [cover, setCover] = useState(edits.cover);
  const [socials, setSocials] = useState<SocialLinks>(
    edits.socials ?? {
      instagram: savedHandle ?? "",
      tiktok: savedHandle ?? "",
      youtube: savedHandle ?? "",
    },
  );

  if (!user) return null;

  const handleError = HANDLE_PATTERN.test(handle)
    ? undefined
    : "3–30 karakter; yalnız küçük harf, rakam, nokta ve alt çizgi.";
  const nameError = displayName.trim() ? undefined : "Görünen ad boş olamaz.";
  const canSave = !handleError && !nameError;

  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/profil");

  // Galeriden tek fotoğraf seçer; HEIC fotoğraflar quality ile JPEG'e çevrilir.
  async function pick(aspect: [number, number], onPick: (uri: string) => void) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect,
        quality: 0.85,
      });
      if (!result.canceled) onPick(result.assets[0].uri);
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }

  function addTag() {
    const tag = (newTag ?? "").trim();
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS)
      setTags([...tags, tag]);
    setNewTag(null);
  }

  function submit() {
    if (!canSave) return;
    save({
      handle,
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
      styles: tags,
      avatar,
      cover,
      socials: {
        instagram: stripAt(socials.instagram),
        tiktok: stripAt(socials.tiktok),
        youtube: stripAt(socials.youtube),
      },
    });
    back();
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          onPress={back}
          hitSlop={8}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Profili Düzenle
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kaydet"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={submit}
          hitSlop={8}
          style={[styles.headerButton, { alignItems: "flex-end" }]}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 16,
              color: canSave ? blush.pink : colors.muted,
            }}
          >
            Kaydet
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={styles.coverWrap}>
          <View style={styles.cover}>
            <PreviewImage uri={cover} tone={blush.pinkSoft} icon="image-outline" />
            <CameraButton
              label="Kapak fotoğrafını değiştir"
              onPress={() => pick([3, 1], setCover)}
              style={{ right: 12, bottom: 12 }}
            />
          </View>
          <View style={styles.avatar}>
            {avatar ? (
              <PreviewImage uri={avatar} tone={blush.pinkSoft} />
            ) : (
              <Text style={styles.initials}>{user.initials}</Text>
            )}
          </View>
          <CameraButton
            label="Profil fotoğrafını değiştir"
            onPress={() => pick([1, 1], setAvatar)}
            style={styles.avatarCamera}
          />
        </View>

        <Field label="Kullanıcı Adı" error={handleError}>
          <Input
            value={handle}
            onChangeText={(value) => setHandle(value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            accessibilityLabel="Kullanıcı adı"
          />
        </Field>
        <Field label="Görünen Ad" error={nameError}>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
            accessibilityLabel="Görünen ad"
          />
        </Field>
        <Field label="Biyografi">
          <Input
            value={bio}
            onChangeText={setBio}
            maxLength={MAX_BIO}
            multiline
            accessibilityLabel="Biyografi"
            style={{ minHeight: 64, textAlignVertical: "top" }}
          />
          <Text style={styles.counter}>
            {bio.length}/{MAX_BIO}
          </Text>
        </Field>
        <Field label="Konum">
          <View style={styles.inline}>
            <Ionicons name="location-outline" size={20} color={colors.text} />
            <Input
              value={location}
              onChangeText={setLocation}
              placeholder="Şehir, ülke"
              maxLength={60}
              accessibilityLabel="Konum"
              style={{ flex: 1 }}
            />
          </View>
        </Field>

        <Field label="Stil Etiketleri">
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`${tag} etiketini kaldır`}
                onPress={() => setTags(tags.filter((item) => item !== tag))}
                style={styles.tag}
              >
                <Text style={styles.tagText}>{tag}</Text>
                <Ionicons name="close" size={14} color={blush.wine} />
              </Pressable>
            ))}
            {newTag !== null ? (
              <TextInput
                autoFocus
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={addTag}
                onBlur={addTag}
                maxLength={20}
                placeholder="Yeni etiket"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Yeni stil etiketi"
                style={[styles.tag, styles.tagInput]}
              />
            ) : (
              tags.length < MAX_TAGS && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Etiket ekle"
                  onPress={() => setNewTag("")}
                  style={[styles.tag, styles.tagAdd]}
                >
                  <Ionicons name="add" size={16} color={blush.pink} />
                  <Text style={[styles.tagText, { color: blush.pink }]}>
                    Etiket Ekle
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </Field>

        <View style={styles.socialCard}>
          <Text style={styles.socialTitle}>Sosyal Medya Bağlantıları</Text>
          <View style={styles.socialList}>
            {SOCIALS.map((social, index) => {
              const value = socials[social.key];
              const clean = stripAt(value);
              return (
                <View
                  key={social.key}
                  style={[styles.socialRow, index > 0 && styles.socialDivider]}
                >
                  <Ionicons name={social.icon} size={24} color={social.color} />
                  <Text style={{ fontSize: 15 }}>{social.label}</Text>
                  <TextInput
                    value={value ? `@${clean}` : ""}
                    onChangeText={(text) =>
                      setSocials({ ...socials, [social.key]: stripAt(text) })
                    }
                    placeholder="@kullanıcıadı"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={`${social.label} kullanıcı adı`}
                    style={styles.socialInput}
                  />
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`${social.label} profilini aç`}
                    accessibilityState={{ disabled: !clean }}
                    disabled={!clean}
                    onPress={() => Linking.openURL(social.url(clean))}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="open-outline"
                      size={20}
                      color={clean ? colors.text : colors.muted}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.note}>
          Değişiklikler şimdilik yalnızca bu cihazda, uygulama açıkken tutulur.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.field, error && { borderColor: blush.pink }]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={blush.pink}
      {...props}
      style={[styles.input, style]}
    />
  );
}

function CameraButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={[styles.camera, style]}
    >
      <Ionicons name="camera" size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: blush.background },
  header: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 52,
  },
  headerButton: { minWidth: 60, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.text },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingTop: 4, paddingBottom: 32, gap: 12 },
  coverWrap: { marginBottom: 44 },
  cover: {
    height: 150,
    borderRadius: 20,
    overflow: "hidden",
  },
  avatar: {
    position: "absolute",
    alignSelf: "center",
    bottom: -48,
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: blush.card,
    backgroundColor: blush.pinkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: fonts.extraBold, fontSize: 38, color: blush.wine },
  camera: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: blush.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCamera: { bottom: -44, left: "50%", marginLeft: 26 },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    gap: 4,
  },
  label: { fontSize: 13, color: colors.muted },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 4,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  counter: { alignSelf: "flex-end", fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: blush.wine },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: blush.chip,
  },
  tagText: { fontFamily: fonts.semibold, fontSize: 13, color: blush.wine },
  tagAdd: {
    backgroundColor: blush.card,
    borderWidth: 1,
    borderColor: blush.pinkSoft,
  },
  tagInput: {
    minWidth: 120,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: blush.wine,
  },
  socialCard: {
    borderRadius: 18,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    overflow: "hidden",
  },
  socialTitle: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
  },
  socialList: { backgroundColor: blush.card },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  socialDivider: { borderTopWidth: 1, borderTopColor: blush.line },
  socialInput: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingVertical: 8,
  },
  note: { fontSize: 12, color: colors.muted, textAlign: "center" },
});
