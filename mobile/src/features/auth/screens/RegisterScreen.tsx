import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Image,
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
import { ApiImage } from "@/components/media/ApiImage";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "../hooks/use-auth";
import { EmailVerificationForm } from "../components/EmailVerificationForm";
import {
  REGISTRATION_RULES,
  registrationErrors,
  registerAccount,
  type RegistrationProfile,
  type StyleTag,
} from "../registration";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  acceptAvatar,
  prepareAvatar,
  type AvatarAsset,
} from "@/features/profile/api/avatar";
import { brand, colors, fonts, serif } from "@/theme";
import { markWelcomed } from "../welcome";

const WOMAN = require("../../../../assets/images/auth/woman.jpg");
const MAN = require("../../../../assets/images/auth/man.jpg");
const SPARKLE = require("../../../../assets/images/auth/sticker-sparkle-brown.png");
const HEART = require("../../../../assets/images/auth/sticker-heart-small.png");

type IconName = keyof typeof Ionicons.glyphMap;

const STEPS = 3;
const MIN_PASSWORD = REGISTRATION_RULES.passwordMin;
const MAX_STYLES = 5;
const MAX_BIO = REGISTRATION_RULES.bioMax;
const STYLE_ICONS: Record<string, IconName> = {
  minimal: "body-outline",
  vintage: "radio-outline",
  street: "footsteps-outline",
};

// Oturum değişince form yeniden kurulur: başka hesaba taslak bilgi taşınmaz.
export function RegisterScreen() {
  const { ready, me, session } = useAuth();
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;
  return (
    <RegistrationForm key={session?.sessionId ?? "new"} authenticated={!!me} />
  );
}

function RegistrationForm({ authenticated }: { authenticated: boolean }) {
  const { client } = useAuth();
  const [step, setStep] = useState(authenticated ? 2 : 1);
  const [showErrors, setShowErrors] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [reload, setReload] = useState(0);
  const [tags, setTags] = useState<StyleTag[]>([]);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarAsset | null>(null);
  const [loadedAvatarId, setLoadedAvatarId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [styles_, setStyles] = useState<string[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    const abort = new AbortController();
    void Promise.all([
      client.request<RegistrationProfile>("/me", { signal: abort.signal }),
      client.request<StyleTag[]>("/style-tags", { signal: abort.signal }),
    ])
      .then(([{ profile }, styles]) => {
        if (abort.signal.aborted) return;
        setDisplayName(profile.displayName);
        setBio(profile.bio ?? "");
        setAvatarPath(profile.avatarPath);
        setStyles(profile.styles.map((tag) => tag.id));
        setTags(styles);
        setLoading(false);
        setLoadError(null);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setLoadError(errorMessage(error));
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [authenticated, client, reload]);

  const accountErrors = registrationErrors(
    { displayName: fullName, username: handle, email, password },
    password2,
  );
  const accountValid = Object.values(accountErrors).every((error) => !error);
  const profileValid =
    displayName.trim().length > 0 &&
    displayName.trim().length <= REGISTRATION_RULES.nameMax;
  const error = (key: keyof typeof accountErrors) =>
    showErrors ? accountErrors[key] : undefined;

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setApiError(null);
    try {
      await action();
    } catch (error) {
      if (alive.current) setApiError(errorMessage(error));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function back() {
    if (busy) return;
    setShowErrors(false);
    setApiError(null);
    if (step === 3) setStep(2);
    else if (router.canGoBack()) router.back();
    else router.replace(authenticated ? "/" : "/auth");
  }
  function next() {
    if (step === 1 && !accountValid) return setShowErrors(true);
    if (step === 2 && !profileValid) return setShowErrors(true);
    if (step === 2 && pendingAvatar) return;
    setShowErrors(false);
    void run(async () => {
      if (step === 1) {
        await registerAccount({
          displayName: fullName,
          username: handle,
          email,
          password,
        });
        if (!alive.current) return;
        setPassword2("");
        // E-posta onayı şimdilik kapalı: hesap açılınca doğrudan giriş yapılır,
        // oturum değişince form profil adımıyla yeniden kurulur. Backend'de onay
        // yeniden açılırsa onay formu yedek olarak gösterilir.
        try {
          await client.login(email, password);
        } catch (error) {
          if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
            if (alive.current) setVerifying(true);
            return;
          }
          if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS")
            throw new ApiError(
              error.status,
              error.code,
              "Bu e-posta ile kayıtlı bir hesap olabilir. Giriş yapmayı dene.",
            );
          throw error;
        }
      } else {
        await client.request("/me", {
          method: "PATCH",
          body: JSON.stringify({
            displayName: displayName.trim(),
            bio: bio.trim(),
          }),
        });
        if (alive.current) setStep(3);
      }
    });
  }
  function finish(withStyles: boolean) {
    void run(async () => {
      if (withStyles)
        await client.request("/me", {
          method: "PATCH",
          body: JSON.stringify({ styleIds: styles_ }),
        });
      await client.reloadMe();
      if (alive.current) {
        markWelcomed();
        router.replace("/");
      }
    });
  }
  async function pickAvatar() {
    if (busy) return;
    await run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !alive.current) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024)
        throw new ApiError(
          0,
          "IMAGE_TOO_LARGE",
          "Fotoğraf en fazla 10 MB olabilir.",
        );
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      if (!alive.current) return;
      const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(
        blob.type,
      )
        ? blob.type
        : asset.mimeType || blob.type;
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType))
        throw new ApiError(
          0,
          "UNSUPPORTED_IMAGE",
          "JPEG, PNG veya WebP fotoğraf seç.",
        );
      if (!blob.size || blob.size > 10 * 1024 * 1024)
        throw new ApiError(
          0,
          "IMAGE_TOO_LARGE",
          "Fotoğraf en fazla 10 MB olabilir.",
        );
      const processed = await prepareAvatar(
        client,
        Platform.OS === "web"
          ? blob
          : {
              uri: asset.uri,
              name: asset.fileName ?? "avatar.jpg",
              type: mimeType,
            },
        blob.size,
        mimeType,
      );
      if (alive.current) {
        setLoadedAvatarId(null);
        setPendingAvatar(processed);
      }
    });
  }
  const toggleStyle = (id: string) =>
    setStyles((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : previous.length < MAX_STYLES
          ? [...previous, id]
          : previous,
    );

  if (verifying)
    return (
      <Screen>
        <BackButton />
        <EmailVerificationForm
          email={email.trim()}
          continueLabel="Profilini tamamla"
          onContinue={async () => {
            await client.login(email, password);
            setPassword("");
          }}
        />
        <Button
          title="Farklı bilgilerle giriş yap"
          variant="outline"
          onPress={() => {
            setPassword("");
            router.replace({
              pathname: "/auth/login",
              params: { onboarding: "1" },
            });
          }}
        />
      </Screen>
    );
  if (loading)
    return (
      <Screen>
        <ActivityIndicator color={brand.accent} />
        <Text>Profilin hazırlanıyor…</Text>
      </Screen>
    );
  if (loadError)
    return (
      <Screen>
        <BackButton />
        <Text accessibilityRole="alert">{loadError}</Text>
        <Button
          title="Tekrar dene"
          onPress={() => {
            setLoading(true);
            setReload((n) => n + 1);
          }}
        />
      </Screen>
    );

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.safe}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={back}
            disabled={busy}
            style={styles.round}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <Text style={styles.logo}>Podyum</Text>
            <Image source={SPARKLE} style={styles.logoSparkle} />
          </View>
          <View
            style={styles.stepPill}
            accessible
            accessibilityLabel={`Adım ${step} / ${STEPS}`}
          >
            <View style={styles.stepDot}>
              <Text style={styles.stepDotText}>{step}</Text>
            </View>
            <Text style={styles.stepTotal}>/ {STEPS}</Text>
          </View>
        </View>
        <View style={styles.progress}>
          {Array.from({ length: STEPS }, (_, index) => (
            <View
              key={index}
              style={[styles.bar, index < step && styles.barDone]}
            />
          ))}
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.title} accessibilityRole="header">
              {step === 1
                ? "Hesabını\noluştur."
                : step === 2
                  ? "Profilini\noluştur."
                  : "Stilini seç."}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? "Podyum'a katılmak için temel bilgilerini gir."
                : step === 2
                  ? "Kendini kısaca tanıt, profilini tamamla."
                  : `Tarzını anlatan en fazla ${MAX_STYLES} stil seçebilir veya bu adımı geçebilirsin.`}
            </Text>
          </View>
          {step === 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                avatarPath || pendingAvatar
                  ? "Fotoğrafı değiştir"
                  : "Fotoğraf ekle"
              }
              onPress={() => void pickAvatar()}
              disabled={busy || !!pendingAvatar}
              style={{ alignItems: "center", gap: 6 }}
            >
              <View style={styles.avatar}>
                {avatarPath || pendingAvatar ? (
                  <ApiImage path={pendingAvatar?.displayPath ?? avatarPath} />
                ) : (
                  <View style={styles.avatarDashed}>
                    <Ionicons
                      name="camera-outline"
                      size={34}
                      color={brand.accentDark}
                    />
                    <View style={styles.avatarPlus}>
                      <Ionicons name="add" size={14} color={colors.onAccent} />
                    </View>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 13 }}>
                {avatarPath || pendingAvatar
                  ? "Fotoğrafı değiştir"
                  : "Fotoğraf ekle"}
              </Text>
            </Pressable>
          ) : (
            <View
              style={styles.photos}
              importantForAccessibility="no-hide-descendants"
            >
              <Image source={SPARKLE} style={styles.heroSparkle} />
              <View style={[styles.photo, styles.photoBack]}>
                <Image source={MAN} style={styles.photoImage} />
              </View>
              <View style={[styles.photo, styles.photoFront]}>
                <Image source={WOMAN} style={styles.photoImage} />
              </View>
              <Image source={HEART} style={styles.heroHeart} />
            </View>
          )}
        </View>

        {apiError && (
          <Text accessibilityRole="alert" style={{ color: colors.accent }}>
            {apiError}
          </Text>
        )}
        {busy && <ActivityIndicator color={brand.accent} />}
        {!!pendingAvatar && (
          <View style={{ gap: 10 }}>
            <View style={{ height: 220, borderRadius: 20, overflow: "hidden" }}>
              <ApiImage
                key={pendingAvatar.id}
                path={pendingAvatar.displayPath}
                onLoad={() => setLoadedAvatarId(pendingAvatar.id)}
              />
            </View>
            <Text>
              Profil fotoğrafını kontrol et. Bu fotoğrafa bulanıklaştırma
              uygulanmadı.
            </Text>
            <Button
              title={
                loadedAvatarId === pendingAvatar.id
                  ? "Fotoğrafı onayla"
                  : "Önizleme yükleniyor…"
              }
              disabled={busy || loadedAvatarId !== pendingAvatar.id}
              onPress={() =>
                void run(async () => {
                  const saved = await acceptAvatar(client, pendingAvatar);
                  if (alive.current) {
                    setAvatarPath(saved.avatarPath);
                    setPendingAvatar(null);
                  }
                })
              }
            />
            <Button
              title="Bu fotoğrafı kullanma"
              variant="outline"
              disabled={busy}
              onPress={() => setPendingAvatar(null)}
            />
          </View>
        )}
        <View style={styles.card} pointerEvents={busy ? "none" : "auto"}>
          {step === 1 && (
            <>
              <Field
                icon="person-outline"
                placeholder="Ad Soyad"
                value={fullName}
                editable={!busy}
                onChangeText={setFullName}
                autoComplete="name"
                maxLength={80}
                error={error("fullName")}
              />
              <Field
                icon="at-outline"
                placeholder="Kullanıcı adı"
                value={handle}
                editable={!busy}
                onChangeText={(value) => setHandle(value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                error={error("handle")}
              />
              <Field
                icon="mail-outline"
                placeholder="E-posta adresi"
                value={email}
                editable={!busy}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                error={error("email")}
              />
              <PasswordField
                placeholder="Şifre"
                value={password}
                editable={!busy}
                onChangeText={setPassword}
                error={error("password")}
                maxLength={128}
              />
              <PasswordField
                placeholder="Şifre tekrar"
                value={password2}
                editable={!busy}
                onChangeText={setPassword2}
                error={error("password2")}
                maxLength={128}
              />
              {!showErrors && (
                <Text style={styles.hint}>
                  En az {MIN_PASSWORD}, en fazla 128 karakter kullan.
                </Text>
              )}
              <Primary
                label={busy ? "Kaydediliyor…" : "Devam et"}
                disabled={busy}
                onPress={next}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zaten hesabın var mı? Giriş yap"
                onPress={() => router.push("/auth/login")}
                style={styles.signIn}
              >
                <Text>Zaten hesabın var mı?</Text>
                <Text style={{ fontFamily: fonts.bold, color: brand.accent }}>
                  Giriş yap
                </Text>
              </Pressable>
              <View style={styles.rule} />
              <Text style={styles.footnote}>
                Devam ederek Kullanım Koşulları&apos;nı ve Gizlilik
                Politikası&apos;nı kabul etmiş olursun.
              </Text>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                icon="person-outline"
                placeholder="Görünen ad"
                value={displayName}
                editable={!busy}
                onChangeText={setDisplayName}
                maxLength={80}
                error={
                  showErrors && !profileValid
                    ? "Görünen ad boş olamaz."
                    : undefined
                }
              />
              <Field
                icon="document-text-outline"
                placeholder="Biyografi"
                value={bio}
                editable={!busy}
                onChangeText={setBio}
                maxLength={MAX_BIO}
                multiline
                inputStyle={{ minHeight: 88, textAlignVertical: "top" }}
                footer={
                  <Text style={styles.counter}>
                    {bio.length} / {MAX_BIO}
                  </Text>
                }
              />
              <Field
                icon="location-outline"
                placeholder="Konum"
                editable={false}
                footer={
                  <Text style={styles.hint}>
                    Konum paylaşımı henüz açılmadı; kayıt sırasında alınmaz.
                  </Text>
                }
              />
              <View style={styles.optional}>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  İsteğe bağlı
                </Text>
                <View style={styles.rule} />
              </View>
              <Field
                icon="logo-instagram"
                placeholder="Instagram kullanıcı adın"
                editable={false}
                footer={
                  <Text style={styles.hint}>
                    Sosyal hesap bağlantıları sonraki adımda.
                  </Text>
                }
              />
              <Primary
                label={busy ? "Kaydediliyor…" : "Devam et"}
                disabled={busy || !!pendingAvatar}
                onPress={next}
              />
              <View style={styles.rule} />
              <Text style={styles.footnote}>
                Bu bilgileri daha sonra düzenleyebilirsin.
              </Text>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Stil kategorileri</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  <Text style={{ fontFamily: fonts.bold, color: brand.accent }}>
                    {styles_.length}/{MAX_STYLES}
                  </Text>{" "}
                  seçildi
                </Text>
              </View>
              <View style={styles.grid}>
                {tags.map((item) => (
                  <Choice
                    key={item.id}
                    label={item.label}
                    icon={STYLE_ICONS[item.id] ?? "shirt-outline"}
                    selected={styles_.includes(item.id)}
                    disabled={
                      !styles_.includes(item.id) && styles_.length >= MAX_STYLES
                    }
                    onPress={() => toggleStyle(item.id)}
                  />
                ))}
              </View>
              {!tags.length && (
                <Text style={styles.hint}>
                  Henüz stil etiketi bulunmuyor. Bu adımı geçebilirsin.
                </Text>
              )}
              <View style={styles.rule} />
              <Text style={styles.hint}>
                İlgi kategorisi tercihleri sonraki adımda açılacak.
              </Text>
              <Primary
                label={busy ? "Kaydediliyor…" : "Kaydı tamamla"}
                disabled={busy || !styles_.length}
                onPress={() => finish(true)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Şimdilik geç"
                onPress={() => finish(false)}
                disabled={busy}
                style={styles.skip}
              >
                <Text
                  style={{ fontFamily: fonts.semibold, color: colors.muted }}
                >
                  Şimdilik geç
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  error,
  footer,
  inputStyle,
  ...props
}: TextInputProps & {
  icon: IconName;
  error?: string;
  footer?: ReactNode;
  inputStyle?: TextInputProps["style"];
}) {
  return (
    <View style={{ gap: 4 }}>
      <View
        style={[
          styles.field,
          props.multiline && { alignItems: "flex-start", paddingTop: 14 },
          error && { borderColor: brand.accent },
        ]}
      >
        <Ionicons name={icon} size={22} color={brand.accentDark} />
        <View style={{ flex: 1 }}>
          <TextInput
            placeholderTextColor={colors.muted}
            selectionColor={brand.accent}
            accessibilityLabel={props.placeholder}
            {...props}
            style={[styles.input, inputStyle]}
          />
          {footer}
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function PasswordField(
  props: Omit<TextInputProps, "secureTextEntry"> & { error?: string },
) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View
        style={[styles.field, props.error && { borderColor: brand.accent }]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={22}
          color={brand.accentDark}
        />
        <TextInput
          placeholderTextColor={colors.muted}
          selectionColor={brand.accent}
          accessibilityLabel={props.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          {...props}
          secureTextEntry={!visible}
          style={[styles.input, { flex: 1 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          onPress={() => setVisible((value) => !value)}
          hitSlop={8}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={22}
            color={brand.accentDark}
          />
        </Pressable>
      </View>
      {props.error && <Text style={styles.error}>{props.error}</Text>}
    </View>
  );
}

function Primary({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
      <Ionicons
        name="arrow-forward"
        size={22}
        color={colors.onAccent}
        style={styles.primaryArrow}
      />
    </Pressable>
  );
}

function Choice({
  label,
  icon,
  selected,
  disabled = false,
  onPress,
  width,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  // Verilmezse yazının uzunluğuna göre boyutlanır.
  width?: `${number}%`;
}) {
  const tint = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        width ? { width } : null,
        selected && styles.choiceSelected,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Ionicons name={icon} size={17} color={tint} />
      <Text style={{ flex: 1, fontSize: 13, color: tint }} numberOfLines={1}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={16} color={tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 24, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 32,
    letterSpacing: -1,
    color: colors.text,
  },
  logoSparkle: { width: 20, height: 20, marginLeft: 2, resizeMode: "contain" },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: brand.chip,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontFamily: fonts.bold, color: colors.onAccent },
  stepTotal: { fontFamily: fonts.bold, color: brand.accent },
  progress: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: brand.line },
  barDone: { backgroundColor: brand.accent },
  hero: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 150 },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.text,
  },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted },
  photos: { width: 130, height: 140 },
  photo: {
    position: "absolute",
    width: 82,
    height: 108,
    padding: 4,
    borderRadius: 14,
    backgroundColor: brand.card,
    shadowColor: brand.accentDark,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  photoBack: { right: 0, top: 0, transform: [{ rotate: "6deg" }] },
  photoFront: { left: 6, top: 18, transform: [{ rotate: "-5deg" }] },
  photoImage: { width: "100%", height: "100%", borderRadius: 10 },
  heroSparkle: {
    position: "absolute",
    left: -14,
    top: 4,
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  heroHeart: {
    position: "absolute",
    right: -6,
    bottom: -4,
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  avatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: "hidden",
    borderWidth: 5,
    borderColor: brand.card,
    backgroundColor: brand.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarDashed: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlus: {
    position: "absolute",
    right: 18,
    bottom: 20,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 26,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
  },
  error: { fontSize: 12, color: brand.accentDark, marginLeft: 4 },
  hint: { fontSize: 13, color: colors.muted, marginTop: -4 },
  primary: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 18, color: colors.onAccent },
  primaryArrow: { position: "absolute", right: 22 },
  signIn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
  },
  rule: { flex: 1, height: 1, backgroundColor: brand.line },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted,
  },
  optional: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 20,
    color: colors.text,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 10,
    borderRadius: 23,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  choiceSelected: { backgroundColor: brand.accent, borderColor: brand.accent },
  skip: { alignItems: "center", justifyContent: "center", minHeight: 40 },
});
