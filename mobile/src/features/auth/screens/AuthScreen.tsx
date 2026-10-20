import { useState, type ReactNode } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { AppLogo } from "@/components/ui/AppLogo";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { colors, fonts, sand, serif } from "@/theme";

const BACKGROUND = require("../../../../assets/images/auth/background.jpg");
const WOMAN = require("../../../../assets/images/auth/woman.jpg");
const MAN = require("../../../../assets/images/auth/man.jpg");
const GOOGLE_G = require("../../../../assets/images/auth/google-g.png");
const STICKERS = {
  star: require("../../../../assets/images/auth/sticker-star.png"),
  sparkleCream: require("../../../../assets/images/auth/sticker-sparkle-cream.png"),
  sparkleBrown: require("../../../../assets/images/auth/sticker-sparkle-brown.png"),
  crown: require("../../../../assets/images/auth/sticker-crown.png"),
};

const GOLD = "#F2B627";
// Çerçeve en/boy oranı ve alttaki "More Style Together" yazısına ayrılan pay.
const FRAME_RATIO = 0.86;
const SCRIPT_SPACE = 46;

// Karşılama ekranı kaydırmadan tek ekrana sığar. E-posta girişi bağlı;
// Kayıt/doğrulama bağlı; Apple/Google sonraki adımda. "Başla" önizlemeyi açar.
export function AuthScreen() {
  const message = usePreviewMessage();
  const [area, setArea] = useState({ width: 0, height: 0 });
  // Hesapsız giriş yok: Başla e-posta ve şifre isteyen giriş ekranını açar.
  const start = () => router.push("/auth/login");
  const soon = (what: string) =>
    message(`${what} sunucu bağlantısı eklendiğinde açılacak.`);

  // Kolaj kalan alana göre ölçeklenir: çerçeve hem genişliğe hem yüksekliğe sığar.
  const onCollageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };
  const frameWidth = Math.max(
    0,
    Math.min(area.width * 0.54, (area.height - SCRIPT_SPACE) * FRAME_RATIO),
  );
  const frameHeight = frameWidth / FRAME_RATIO;
  const leftX = (area.width - frameWidth * 1.9) / 2;
  const rightOffset = Math.max(
    0,
    Math.min(40, area.height - SCRIPT_SPACE - frameHeight),
  );
  // Genişlik sınırlıysa artan dikey boşluk kolajın üstüne ve altına bölünür.
  const used = frameHeight + Math.max(rightOffset, SCRIPT_SPACE);
  const topY = Math.max(0, (area.height - used) / 2);
  const rightTop = topY + rightOffset;

  return (
    <ImageBackground
      source={BACKGROUND}
      resizeMode="cover"
      style={styles.background}
    >
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={styles.page}
      >
        <View style={styles.logoRow}>
          <AppLogo size={56} />
          <View>
            <Text style={styles.logo} accessibilityRole="header">
              Podyum
            </Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          Tarzını paylaş, ilhamını keşfet
        </Text>

        <View style={styles.collage} onLayout={onCollageLayout}>
          {frameWidth > 0 && (
            <>
              <View
                style={[
                  styles.frame,
                  styles.frameLeft,
                  {
                    width: frameWidth,
                    height: frameHeight,
                    left: leftX,
                    top: topY,
                  },
                ]}
              >
                <Image source={WOMAN} resizeMode="cover" style={styles.photo} />
                <View style={styles.likes}>
                  <Ionicons name="heart" size={14} color={sand.brown} />
                  <Text style={{ fontSize: 13, fontFamily: fonts.bold }}>
                    2,4K
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.frame,
                  styles.frameRight,
                  {
                    width: frameWidth,
                    height: frameHeight,
                    left: leftX + frameWidth * 0.9,
                    top: rightTop,
                  },
                ]}
              >
                <View style={styles.tape} />
                <Image source={MAN} resizeMode="cover" style={styles.photo} />
                <View style={styles.rating}>
                  {[0, 1, 2, 3].map((index) => (
                    <Ionicons key={index} name="star" size={13} color={GOLD} />
                  ))}
                  <Ionicons name="star" size={13} color="#8C8C8C" />
                </View>
              </View>
              <Sticker
                source={STICKERS.sparkleCream}
                style={{
                  top: topY - 6,
                  left: leftX + 6,
                  width: 28,
                  height: 36,
                }}
              />
              <Sticker
                source={STICKERS.crown}
                style={{
                  top: rightTop - 18,
                  left: leftX + frameWidth * 1.9 - 50,
                  width: 46,
                  height: 30,
                }}
              />
              <Text
                style={[
                  styles.script,
                  { top: topY + frameHeight + 4, left: Math.max(4, leftX) },
                ]}
              >
                More Style{"\n"} Together
              </Text>
            </>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Başla"
            onPress={start}
            style={({ pressed }) => [
              styles.primary,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="sparkles" size={22} color={colors.onAccent} />
            <Text style={styles.primaryText}>Başla</Text>
            <Ionicons
              name="arrow-forward"
              size={22}
              color={colors.onAccent}
              style={styles.primaryArrow}
            />
          </Pressable>
          <Provider
            label="Apple ile devam et"
            icon={<Ionicons name="logo-apple" size={24} color={colors.text} />}
            onPress={() => soon("Apple ile giriş")}
          />
          <Provider
            label="Google ile devam et"
            icon={
              <Image
                source={GOOGLE_G}
                resizeMode="contain"
                style={{ width: 22, height: 22 }}
              />
            }
            onPress={() => soon("Google ile giriş")}
          />
        </View>

        <View style={styles.accountRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hesabın yok mu? Kayıt ol"
            onPress={() => router.push("/auth/register")}
            hitSlop={6}
            style={styles.accountLink}
          >
            <Text style={styles.accountText}>Hesabın yok mu?</Text>
            <Text style={styles.accountAction}>Kayıt ol</Text>
          </Pressable>
        </View>

        <Text style={styles.terms}>
          Devam ederek{" "}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => soon("Kullanım Koşulları")}
          >
            Kullanım Koşulları
          </Text>{" "}
          ve{" "}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => soon("Gizlilik Politikası")}
          >
            Gizlilik Politikası
          </Text>
          {"'nı kabul etmiş olursun."}
        </Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

function Sticker({
  source,
  style,
}: {
  source: ImageSourcePropType;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute" }, style]}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

function Provider({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: sand.background },
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  logoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    fontFamily: serif,
    fontStyle: "italic",
    fontWeight: "700",
    fontSize: 52,
    letterSpacing: -2,
    color: colors.text,
  },
  title: {
    marginTop: -6,
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 21,
    letterSpacing: -0.6,
    textAlign: "center",
    color: colors.text,
  },
  // Kalan dikey alanın tamamını kolaj kullanır; içerik bu alana göre ölçeklenir.
  collage: { flex: 1, minHeight: 160, marginTop: 6 },
  frame: {
    position: "absolute",
    padding: 6,
    borderRadius: 8,
    backgroundColor: sand.card,
    shadowColor: sand.brownDark,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  frameLeft: { transform: [{ rotate: "-4deg" }] },
  frameRight: { transform: [{ rotate: "5deg" }] },
  photo: { width: "100%", height: "100%", borderRadius: 4 },
  tape: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    width: 70,
    height: 20,
    zIndex: 1,
    backgroundColor: "rgba(214,182,140,0.75)",
    transform: [{ rotate: "-3deg" }],
  },
  likes: {
    position: "absolute",
    left: 14,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: sand.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  rating: {
    position: "absolute",
    right: 12,
    bottom: 16,
    flexDirection: "row",
    gap: 1,
    backgroundColor: "#1F1A16",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  script: {
    position: "absolute",
    fontFamily: serif,
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 20,
    color: sand.brownDark,
    transform: [{ rotate: "-8deg" }],
  },
  primary: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: sand.brown,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: sand.brownDark,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryText: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.onAccent,
  },
  primaryArrow: { position: "absolute", right: 22 },
  provider: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: sand.card,
    borderWidth: 1,
    borderColor: sand.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  accountLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
  },
  accountText: { fontSize: 14, color: colors.text },
  accountAction: { fontSize: 14, fontFamily: fonts.bold, color: sand.brown },
  terms: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: sand.muted,
  },
  link: {
    fontSize: 11,
    color: sand.muted,
    textDecorationLine: "underline",
  },
});
