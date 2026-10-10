import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fonts } from "@/theme";

// Sekme ekranlarının sol üstündeki kalın başlık ve kırmızı parıltı.
export function BrandTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row" }} accessibilityRole="header">
      <Text
        style={{
          fontFamily: fonts.extraBold,
          fontWeight: "700",
          fontSize: 40,
          letterSpacing: -1,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      <Ionicons name="sparkles" size={16} color={colors.accent} />
    </View>
  );
}
