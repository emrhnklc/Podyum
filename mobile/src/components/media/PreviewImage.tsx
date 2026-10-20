import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

// Yerel demo fotoğrafları Git dışında, public/demo/ altında durur.
// EXPO_PUBLIC_DEMO_MEDIA_BASE_URL tanımlıysa /demo/... yolları o adrese
// göre çözülür (ör. public/ klasörünü de sunan Expo geliştirme sunucusu).
const demoMediaBase = process.env.EXPO_PUBLIC_DEMO_MEDIA_BASE_URL?.replace(
  /\/+$/,
  "",
);

function resolveDemoUri(uri?: string) {
  if (uri?.startsWith("/demo/") && demoMediaBase) return demoMediaBase + uri;
  return uri;
}

// Native'de yalnız tam http(s) URL veya yerel picker URI'si kullanılır.
// Adres tanımlı değilse eski /demo yolları ağ isteği üretmez; pastel alan korunur.
export function PreviewImage({
  uri: rawUri,
  tone = colors.avatar,
  icon = "shirt-outline",
  onLoad,
  onError,
}: {
  uri?: string;
  tone?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const uri = resolveDemoUri(rawUri);
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
          onLoad={onLoad}
          onError={() => {
            setFailedUri(uri);
            onError?.();
          }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Ionicons name={icon} size={40} color={colors.photoText} />
      )}
    </View>
  );
}
