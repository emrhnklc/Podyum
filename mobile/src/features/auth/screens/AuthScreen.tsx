import type { ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import { colors, fonts } from "@/theme";
import { markWelcomed } from "../welcome";

const WOMAN = require("../../../../assets/images/auth/woman.jpg");
const MAN = require("../../../../assets/images/auth/man.jpg");
const GOOGLE_G = require("../../../../assets/images/auth/google-g.png");
const STICKERS = {
  heartBig: require("../../../../assets/images/auth/sticker-heart-big.png"),
  heartSmall: require("../../../../assets/images/auth/sticker-heart-small.png"),
  star: require("../../../../assets/images/auth/sticker-star.png"),
  sparkleCream: require("../../../../assets/images/auth/sticker-sparkle-cream.png"),
  sparkleBrown: require("../../../../assets/images/auth/sticker-sparkle-brown.png"),
  crown: require("../../../../assets/images/auth/sticker-crown.png"),
};

const GOLD = "#F2B627";

// Karşılama ve giriş ekranı. Apple/Google/e-posta girişi henüz bağlı değil;
// "Başla" hesap açmadan Keşfet'e geçirir.
export function AuthScreen() {
  const message = usePreviewMessage();
  const start = () => {
    markWelcomed();
    router.replace("/");
  };
  const soon = (what: string) =>
    message(`${what} sunucu bağlantısı eklendiğinde açılacak.`);
  return (
    <View style={styles.background}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.page}
          contentContainerStyle={styles.content}
        >
          <View style={styles.logoRow}>
            <View>
              <Text style={styles.logo} accessibilityRole="header">
                Podyum
              </Text>
              <Sticker
                source={STICKERS.sparkleBrown}
                style={{ top: -2, right: -22, width: 28, height: 28 }}
              />
            </View>
          </View>
          <View>
            <Text style={styles.title}>Tarzını paylaş, ilhamını keşfet</Text>
            <Text style={styles.subtitle}>
              Kombinlerini oylat, yeni stiller keşfet,{"\n"}modayı birlikte
              yaşa.
            </Text>
          </View>

          <View style={styles.collage}>
            <View style={[styles.frame, styles.frameLeft]}>
              <Image source={WOMAN} resizeMode="cover" style={styles.photo} />
              <View style={styles.likes}>
                <Ionicons name="heart" size={14} color={colors.accent} />
                <Text style={{ fontSize: 13, fontFamily: fonts.bold }}>
                  2,4K
                </Text>
              </View>
            </View>
            <View style={[styles.frame, styles.frameRight]}>
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
              style={{ top: -6, left: "8%", width: 30, height: 38 }}
            />
            <Sticker
              source={STICKERS.heartBig}
              style={{ top: "38%", left: -6, width: 46, height: 48 }}
            />
            <Sticker
              source={STICKERS.crown}
              style={{ top: "10%", right: 6, width: 46, height: 30 }}
            />
            <Sticker
              source={STICKERS.heartSmall}
              style={{ top: "30%", right: -4, width: 32, height: 34 }}
            />
            <Sticker
              source={STICKERS.star}
              style={{ bottom: "20%", left: "44%", width: 30, height: 30 }}
            />
            <Text style={styles.script}>
              More Style{"\n"}  Together ♡
            </Text>
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

          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={{ fontSize: 13, color: colors.muted }}>veya</Text>
            <View style={styles.rule} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zaten hesabın var mı? Giriş yap"
            onPress={() => soon("E-posta ile giriş")}
            style={styles.signIn}
          >
            <Text>Zaten hesabın var mı?</Text>
            <Text style={{ fontFamily: fonts.bold, color: colors.accent }}>
              Giriş yap
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.accent} />
          </Pressable>

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
        </ScrollView>
      </SafeAreaView>
    </View>
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
  background: { flex: 1, backgroundColor: colors.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 20, paddingBottom: 24, gap: 18 },
  logoRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  logo: {
    fontFamily: fonts.extraBold,
    fontWeight: "700",
    fontSize: 60,
    letterSpacing: -2,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 25,
    letterSpacing: -0.6,
    textAlign: "center",
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    color: colors.muted,
  },
  // Yükseklik genişliğe oranlı; çerçeveler her ekran boyunda aynı yerde kalır.
  collage: { aspectRatio: 1.15, marginHorizontal: -4 },
  frame: {
    position: "absolute",
    width: "54%",
    aspectRatio: 0.86,
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  frameLeft: { left: "3%", top: 10, transform: [{ rotate: "-4deg" }] },
  frameRight: { right: "3%", top: 50, transform: [{ rotate: "5deg" }] },
  photo: { width: "100%", height: "100%", borderRadius: 4 },
  tape: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    width: 70,
    height: 20,
    zIndex: 1,
    backgroundColor: "rgba(17,17,17,0.14)",
    transform: [{ rotate: "-3deg" }],
  },
  likes: {
    position: "absolute",
    left: 14,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.background,
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
    left: 10,
    top: "77%",
    fontFamily: fonts.extraBold,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
    transform: [{ rotate: "-8deg" }],
  },
  primary: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.text,
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
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 30,
  },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  signIn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  terms: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted,
  },
  link: {
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: "underline",
  },
});
