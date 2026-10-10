import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

// Native'de yalnız tam http(s) URL veya yerel picker URI'si kullanılır.
// Eski /demo yolları dosya yokken ağ isteği üretmez; pastel alan korunur.
export function PreviewImage({
  uri,
  tone = colors.avatar,
  icon = "shirt-outline",
}: {
  uri?: string;
  tone?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const usable =
    uri &&
    /^(https?:|file:|content:|blob:|data:image\/)/i.test(uri) &&
    failedUri !== uri;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tone,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {usable ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Ionicons name={icon} size={40} color={colors.photoText} />
      )}
    </View>
  );
}
