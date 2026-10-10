import { Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

// Sol üstte sade geri oku. Geçmiş yoksa `fallback` rotasına gider.
export function BackButton({ fallback = "/" }: { fallback?: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Geri"
      hitSlop={8}
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace(fallback)
      }
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        marginLeft: -12,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </Pressable>
  );
}
