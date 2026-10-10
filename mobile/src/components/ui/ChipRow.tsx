import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, common, fonts } from "@/theme";

export function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={common.label}>{label}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: option.value === value }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, option.value === value && styles.active]}
          >
            <Text
              style={{
                color: option.value === value ? colors.onAccent : colors.text,
                fontFamily: fonts.semibold,
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { borderColor: colors.accent, backgroundColor: colors.accent },
});
