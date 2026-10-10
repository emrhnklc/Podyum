import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fonts } from "@/theme";

export function PillChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const tint = active ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.active]}
    >
      {icon && <Ionicons name={icon} size={16} color={tint} />}
      <Text
        style={{
          fontSize: 13,
          fontFamily: active ? fonts.bold : fonts.medium,
          color: tint,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  active: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
});
