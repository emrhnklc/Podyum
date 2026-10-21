import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { AppLogo } from "./AppLogo";
import { brand, colors, serif } from "@/theme";

// Sekme ekranlarının sol üstündeki kalın başlık ve kırmızı parıltı.
export function BrandTitle({ title }: { title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: title === "Podyum" ? "center" : undefined,
        gap: title === "Podyum" ? 8 : 0,
      }}
      accessibilityRole="header"
    >
      {title === "Podyum" && <AppLogo size={34} />}
      <Text
        style={{
          fontFamily: serif,
          fontWeight: "700",
          fontSize: 40,
          letterSpacing: -1,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {title !== "Podyum" && (
        <Ionicons name="sparkles" size={16} color={brand.accent} />
      )}
    </View>
  );
}
