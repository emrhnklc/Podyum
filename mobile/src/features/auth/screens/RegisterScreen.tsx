import { useState, type ReactNode } from "react";
import {
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
import { PreviewImage } from "@/components/media/PreviewImage";
import { CATEGORY_ICON, type PollCategory } from "@/constants/poll-categories";
import { useProfileEdits } from "@/features/profile/hooks/use-profile-edits";
import {
  HANDLE_HINT,
  HANDLE_PATTERN,
  MAX_BIO,
} from "@/features/profile/validation";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { brand, colors, fonts, serif } from "@/theme";
import { markWelcomed } from "../welcome";

const WOMAN = require("../../../../assets/images/auth/woman.jpg");
const MAN = require("../../../../assets/images/auth/man.jpg");
const SPARKLE = require("../../../../assets/images/auth/sticker-sparkle-brown.png");
const HEART = require("../../../../assets/images/auth/sticker-heart-small.png");

type IconName = keyof typeof Ionicons.glyphMap;

const STEPS = 3;
const MIN_PASSWORD = 8;
const MIN_STYLES = 3;
const MAX_STYLES = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STYLES: { label: string; icon: IconName }[] = [
  { label: "Minimal", icon: "body-outline" },
  { label: "Vintage", icon: "radio-outline" },
  { label: "Sokak stili", icon: "footsteps-outline" },
  { label: "Klasik", icon: "briefcase-outline" },
  { label: "Soft girl", icon: "flower-outline" },
  { label: "Smart casual", icon: "shirt-outline" },
  { label: "Sneaker", icon: "walk-outline" },
  { label: "Retro", icon: "camera-outline" },
  { label: "Oversize", icon: "expand-outline" },
  { label: "Kahve tonları", icon: "cafe-outline" },
  { label: "Romantik", icon: "rose-outline" },
  { label: "Basic", icon: "ellipse-outline" },
];
const INTERESTS: { value: PollCategory; label: string }[] = [
  { value: "OUTFIT", label: "Kombin" },
  { value: "SHOES", label: "Ayakkabı" },
  { value: "BAG", label: "Çanta" },
  { value: "JEWELRY", label: "Takı" },
];

// Üç adımlı kayıt: hesap, profil, stil. Sunucu bağlantısı yok; tamamlanınca
// bilgiler önizleme profiline yazılır ve Keşfet açılır. Şifre hiçbir yerde
// saklanmaz.
export function RegisterScreen() {
  const { save } = useProfileEdits();
  const message = usePreviewMessage();
  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [avatar, setAvatar] = useState<string>();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [instagram, setInstagram] = useState("");

  const [styles_, setStyles] = useState<string[]>([]);
  const [interests, setInterests] = useState<PollCategory[]>([]);

  const accountErrors = {
    fullName: fullName.trim() ? undefined : "Adını ve soyadını yaz.",
    handle: HANDLE_PATTERN.test(handle) ? undefined : HANDLE_HINT,
    email: EMAIL_PATTERN.test(email.trim())
      ? undefined
      : "Geçerli bir e-posta adresi yaz.",
    password:
      password.length >= MIN_PASSWORD
        ? undefined
        : `En az ${MIN_PASSWORD} karakter kullan.`,
    password2:
      password2 && password2 === password ? undefined : "Şifreler aynı değil.",
  };
  const accountValid = Object.values(accountErrors).every((error) => !error);
  const profileValid = displayName.trim().length > 0;
  const error = (key: keyof typeof accountErrors) =>
    showErrors ? accountErrors[key] : undefined;

  function back() {
    setShowErrors(false);
    if (step > 1) setStep(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace("/auth");
  }

  function next() {
    if (step === 1 && !accountValid) return setShowErrors(true);
    if (step === 2 && !profileValid) return setShowErrors(true);
    setShowErrors(false);
    if (step === 1 && !displayName) setDisplayName(fullName.trim());
    setStep(step + 1);
  }

  function finish(withStyles: boolean) {
    save({
      handle,
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
      avatar,
      ...(withStyles ? { styles: styles_ } : {}),
      socials: {
        instagram: instagram.trim().replace(/^@+/, ""),
        tiktok: "",
        youtube: "",
      },
    });
    markWelcomed();
    router.replace("/");
  }

  async function pickAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled) setAvatar(result.assets[0].uri);
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }

  const toggleStyle = (label: string) =>
    setStyles((previous) =>
      previous.includes(label)
        ? previous.filter((item) => item !== label)
        : previous.length < MAX_STYLES
          ? [...previous, label]
          : previous,
    );
  const toggleInterest = (value: PollCategory) =>
    setInterests((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value],
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
                  : `Sana daha iyi öneriler gösterebilmemiz için en az ${MIN_STYLES} stil seç.`}
            </Text>
          </View>
          {step === 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                avatar ? "Fotoğrafı değiştir" : "Fotoğraf ekle"
              }
              onPress={pickAvatar}
              style={{ alignItems: "center", gap: 6 }}
            >
              <View style={styles.avatar}>
                {avatar ? (
                  <PreviewImage uri={avatar} tone={brand.chip} />
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
                {avatar ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
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

        <View style={styles.card}>
          {step === 1 && (
            <>
              <Field
                icon="person-outline"
                placeholder="Ad Soyad"
                value={fullName}
                onChangeText={setFullName}
                autoComplete="name"
                error={error("fullName")}
              />
              <Field
                icon="at-outline"
                placeholder="Kullanıcı adı"
                value={handle}
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
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={error("email")}
              />
              <PasswordField
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                error={error("password")}
              />
              <PasswordField
                placeholder="Şifre tekrar"
                value={password2}
                onChangeText={setPassword2}
                error={error("password2")}
              />
              {!showErrors && (
                <Text style={styles.hint}>
                  En az {MIN_PASSWORD} karakter kullan.
                </Text>
              )}
              <Primary label="Devam et" onPress={next} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zaten hesabın var mı? Giriş yap"
                onPress={() =>
                  message(
                    "E-posta ile giriş sunucu bağlantısı eklendiğinde açılacak.",
                  )
                }
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
                onChangeText={setDisplayName}
                maxLength={40}
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
                value={location}
                onChangeText={setLocation}
                maxLength={60}
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
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Primary label="Devam et" onPress={next} />
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
                {STYLES.map((item) => (
                  <Choice
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    selected={styles_.includes(item.label)}
                    disabled={
                      !styles_.includes(item.label) &&
                      styles_.length >= MAX_STYLES
                    }
                    onPress={() => toggleStyle(item.label)}
                  />
                ))}
              </View>
              <View style={styles.rule} />
              <Text style={styles.sectionTitle}>İlgini çeken kategoriler</Text>
              <View style={styles.grid}>
                {INTERESTS.map((item) => (
                  <Choice
                    key={item.value}
                    label={item.label}
                    icon={CATEGORY_ICON[item.value]}
                    selected={interests.includes(item.value)}
                    onPress={() => toggleInterest(item.value)}
                    width="48.5%"
                  />
                ))}
              </View>
              <Primary
                label="Kaydı tamamla"
                disabled={styles_.length < MIN_STYLES}
                onPress={() => finish(true)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Şimdilik geç"
                onPress={() => finish(false)}
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
    fontStyle: "italic",
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
