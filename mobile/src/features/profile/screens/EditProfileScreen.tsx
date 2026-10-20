import { useRef, useState, type ReactNode } from "react";
import {
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
import { Button } from "@/components/ui/Button";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { ApiImage } from "@/components/media/ApiImage";
import { PillChip } from "@/components/ui/PillChip";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  REGISTRATION_RULES,
  type StyleTag,
} from "@/features/auth/registration";
import { readPhoto } from "@/features/polls/api/publish-poll";
import { prepareAvatar, acceptAvatar, type AvatarAsset } from "../api/avatar";
import { initialsOf, type MyProfile } from "../api/profile";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts } from "@/theme";

export function EditProfileScreen() {
  const profile = useApiQuery<MyProfile>("/me");
  const tags = useApiQuery<StyleTag[]>("/style-tags");
  return profile.data && tags.data ? (
    <ProfileForm
      key={profile.data.profile.id}
      initial={profile.data}
      tags={tags.data}
    />
  ) : (
    <SafeAreaView style={styles.safe}>
      <Button title="Geri" variant="outline" onPress={() => router.back()} />
      <ApiStatus
        loading={profile.loading || tags.loading}
        error={profile.error ?? tags.error}
        retry={() => {
          void profile.refresh();
          void tags.refresh();
        }}
      />
    </SafeAreaView>
  );
}

function ProfileForm({
  initial,
  tags,
}: {
  initial: MyProfile;
  tags: StyleTag[];
}) {
  const { client } = useAuth();
  const [handle, setHandle] = useState(initial.profile.username);
  const [displayName, setDisplayName] = useState(initial.profile.displayName);
  const [bio, setBio] = useState(initial.profile.bio ?? "");
  const [selected, setSelected] = useState(
    initial.profile.styles.map((tag) => tag.id),
  );
  const [avatarPath, setAvatarPath] = useState(initial.profile.avatarPath);
  const [pending, setPending] = useState<AvatarAsset | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const handleError = REGISTRATION_RULES.username.test(handle)
    ? undefined
    : REGISTRATION_RULES.usernameHint;
  const nameError =
    displayName.trim().length > 0 && displayName.trim().length <= 80
      ? undefined
      : "Görünen ad 1–80 karakter olmalı.";
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/profil");
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function pick() {
    void run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const photo = await readPhoto(result.assets[0]);
      setPreviewLoaded(null);
      setPending(
        await prepareAvatar(client, photo.file, photo.byteSize, photo.mimeType),
      );
    });
  }
  const save = () =>
    void run(async () => {
      if (handleError || nameError || pending) return;
      await client.request("/me", {
        method: "PATCH",
        body: JSON.stringify({
          username: handle,
          displayName: displayName.trim(),
          bio: bio.trim(),
          styleIds: selected,
        }),
      });
      await client.reloadMe();
      back();
    });
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          onPress={back}
          disabled={busy}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Profili Düzenle
        </Text>
        <Button
          title="Kaydet"
          disabled={busy || !!pending || !!handleError || !!nameError}
          onPress={save}
        />
      </View>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.coverWrap}>
          <View style={[styles.cover, { backgroundColor: brand.accentSoft }]} />
          <View style={styles.avatar}>
            {avatarPath ? (
              <ApiImage path={avatarPath} />
            ) : (
              <Text style={styles.initials}>{initialsOf(displayName)}</Text>
            )}
          </View>
          <CameraButton
            label="Profil fotoğrafını değiştir"
            onPress={pick}
            style={styles.avatarCamera}
          />
        </View>
        <ApiStatus loading={busy} error={error} retry={() => setError(null)} />
        {pending && (
          <View style={{ gap: 10 }}>
            <View style={{ height: 220, borderRadius: 20, overflow: "hidden" }}>
              <ApiImage
                path={pending.displayPath}
                retryable
                onLoad={() => setPreviewLoaded(pending.id)}
              />
            </View>
            <Text>
              Profil fotoğrafını kontrol et. Bu fotoğrafa bulanıklaştırma
              uygulanmadı.
            </Text>
            <Button
              title="Fotoğrafı onayla"
              disabled={busy || previewLoaded !== pending.id}
              onPress={() =>
                void run(async () => {
                  const saved = await acceptAvatar(client, pending);
                  setAvatarPath(saved.avatarPath);
                  setPending(null);
                })
              }
            />
            <Button
              title="Bu fotoğrafı kullanma"
              variant="outline"
              disabled={busy}
              onPress={() => setPending(null)}
            />
          </View>
        )}
        {!!avatarPath && (
          <Button
            title="Profil fotoğrafını kaldır"
            variant="outline"
            disabled={busy || !!pending}
            onPress={() =>
              void run(async () => {
                await client.request("/me/avatar", { method: "DELETE" });
                setAvatarPath(null);
              })
            }
          />
        )}
        <Field label="Kullanıcı Adı" error={handleError}>
          <Input
            accessibilityLabel="Kullanıcı adı"
            value={handle}
            onChangeText={(value) => setHandle(value.toLowerCase())}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
        </Field>
        <Field label="Görünen Ad" error={nameError}>
          <Input
            accessibilityLabel="Görünen ad"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={80}
            editable={!busy}
          />
        </Field>
        <Field label="Biyografi">
          <Input
            accessibilityLabel="Biyografi"
            value={bio}
            onChangeText={setBio}
            maxLength={300}
            multiline
            editable={!busy}
            style={{ minHeight: 64 }}
          />
          <Text style={styles.counter}>{bio.length}/300</Text>
        </Field>
        <Field label="Stil Etiketleri">
          <View style={styles.tags}>
            {tags.map((tag) => (
              <PillChip
                key={tag.id}
                label={tag.label}
                active={selected.includes(tag.id)}
                onPress={() => {
                  if (!busy)
                    setSelected((old) =>
                      old.includes(tag.id)
                        ? old.filter((id) => id !== tag.id)
                        : old.length < 5
                          ? [...old, tag.id]
                          : old,
                    );
                }}
              />
            ))}
          </View>
          <Text style={styles.note}>En fazla 5 stil seçebilirsin.</Text>
        </Field>
        <Text style={styles.note}>
          Konum, kapak fotoğrafı ve sosyal bağlantılar henüz kullanıma açık
          değil.
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
    <View style={[styles.field, error && { borderColor: brand.accent }]}>
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
      selectionColor={brand.accent}
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
  safe: { flex: 1, backgroundColor: brand.background },
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
    borderColor: brand.card,
    backgroundColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.extraBold,
    fontSize: 38,
    color: brand.accentDark,
  },
  camera: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: brand.card,
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
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
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
  error: { fontSize: 12, color: brand.accentDark },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: brand.chip,
  },
  tagText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: brand.accentDark,
  },
  tagAdd: {
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.accentSoft,
  },
  tagInput: {
    minWidth: 120,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: brand.accentDark,
  },
  socialCard: {
    borderRadius: 18,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
    overflow: "hidden",
  },
  socialTitle: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
  },
  socialList: { backgroundColor: brand.card },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  socialDivider: { borderTopWidth: 1, borderTopColor: brand.line },
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
