import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { brand, colors } from "@/theme";

export function PeopleSearchLink() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ara, kişi keşfet"
      onPress={() => router.push("/people")}
      style={styles.search}
    >
      <Ionicons name="search-outline" size={20} color={colors.text} />
      <Text style={{ flex: 1, color: colors.muted }}>Ara, kişi keşfet</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
});
