import { StyleSheet } from "react-native";

export const colors = {
  background: "#FFFFFF",
  text: "#111111",
  muted: "#5F5F5A",
  surface: "#F4F3EF",
  chip: "#E9E9E6",
  line: "#DAD9D4",
  accent: "#D00A26",
  // Seçili çip, avatar ve görsel yer tutucularındaki pastel kırmızı.
  accentSoft: "#FBE3E6",
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
