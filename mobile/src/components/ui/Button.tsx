import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text";
import { colors, fonts } from "@/theme";
import type { ReactNode } from "react";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "dark";
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant !== "outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            variant === "primary"
              ? colors.accent
              : variant === "dark"
                ? colors.text
                : "transparent",
          borderColor: filled ? "transparent" : colors.line,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          color: filled ? colors.onAccent : colors.text,
          fontFamily: fonts.bold,
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
});
