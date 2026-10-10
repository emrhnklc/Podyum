import { Platform, StyleSheet } from "react-native";

// Podyum kahve/krem paleti; tüm sekme ve ayrıntı ekranları bunu kullanır.
export const brand = {
  background: "#F3ECE6", // genel arka plan
  surface: "#F1E4D8", // kart arka planları
  card: "#FAF8F5", // açık yüzeyler
  line: "#E4D3C3",
  chip: "#EADACB",
  accent: "#B7764A", // ana butonlar
  accentSoft: "#DDBFA5", // seçili kategoriler
  accentDark: "#6B4128", // seçili öğe yazısı
  muted: "#9C8576",
};
// Giriş ekranının kahve/krem görünümü.
export const sand = {
  background: "#F3ECE6",
  card: "#FAF8F5",
  line: "#E4D3C3",
  brown: "#B7764A",
  brownDark: "#7A4A22",
  muted: "#6E6257",
};
export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, 'Times New Roman', serif",
});

export const colors = {
  background: "#F3ECE6",
  text: "#25212A",
  muted: "#6B625D",
  surface: "#F1E4D8",
  chip: "#EADACB",
  line: "#E4D3C3",
  accent: "#B7764A",
  onAccent: "#FFFFFF",
  blue: "#0B66D0",
  avatar: "#D9D4CC",
  photoText: "#5A5A55",
};
export const fonts = {
  regular: "HankenGrotesk_400Regular",
  medium: "HankenGrotesk_500Medium",
  semibold: "HankenGrotesk_600SemiBold",
  bold: "HankenGrotesk_700Bold",
  extraBold: "HankenGrotesk_800ExtraBold",
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };
export const common = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  card: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    gap: 14,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 27,
    letterSpacing: -0.5,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
});
