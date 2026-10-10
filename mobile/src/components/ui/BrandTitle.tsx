import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { brand, colors, serif } from "@/theme";

// Sekme ekranlarının sol üstündeki italik serif başlık ve parıltı.
export function BrandTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row" }} accessibilityRole="header">
      <Text
        style={{
          fontFamily: serif,
          fontStyle: "italic",
          fontWeight: "700",
          fontSize: 40,
          letterSpacing: -1,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      <Ionicons name="sparkles" size={16} color={brand.accent} />
    </View>
  );
}
