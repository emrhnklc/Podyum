import { View } from "react-native";
import { Text } from "./Text";
import { colors, fonts } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

export function EmptyState({
  title,
  message,
  icon = "albums-outline",
}: {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        padding: 28,
        borderRadius: 24,
        backgroundColor: colors.surface,
        alignItems: "center",
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={32} color={colors.accent} />
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 18, textAlign: "center" }}
      >
        {title}
      </Text>
      <Text
        style={{ color: colors.muted, textAlign: "center", lineHeight: 21 }}
      >
        {message}
      </Text>
    </View>
  );
}
