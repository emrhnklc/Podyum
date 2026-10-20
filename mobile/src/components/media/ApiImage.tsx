import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { PreviewImage } from "./PreviewImage";

// Özel medyayı Bearer ile alır; URL/token diske veya herkese açık bir cache'e yazılmaz.
// Data URI web/native Image'ın HTTP header farkını ortadan kaldırır.
export function ApiImage({
  path,
  onLoad,
  retryable = false,
}: {
  path: string | null;
  onLoad?: () => void;
  retryable?: boolean;
}) {
  const { client, session } = useAuth();
  const sessionId = session?.sessionId;
  const [retry, setRetry] = useState(0);
  const identity = `${sessionId}:${path}:${retry}`;
  const [failure, setFailure] = useState<string | null>(null);
  const [image, setImage] = useState<{ identity: string; uri: string } | null>(
    null,
  );
  useEffect(() => {
    if (
      !path ||
      !/^\/v1\/media\/[0-9a-f-]+\/content(?:\?variant=thumbnail)?$/i.test(
        path,
      ) ||
      !sessionId
    )
      return;
    const abort = new AbortController();
    let reader: FileReader | null = null;
    void client
      .response(path as `/${string}`, {
        headers: { Accept: "image/webp" },
        signal: abort.signal,
      })
      .then((response) => response.blob())
      .then((blob) => {
        if (abort.signal.aborted) return;
        reader = new FileReader();
        reader.onload = () => {
          if (!abort.signal.aborted && typeof reader?.result === "string")
            setImage({ identity, uri: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailure(identity);
      });
    return () => {
      abort.abort();
      if (reader?.readyState === 1) reader.abort();
    };
  }, [client, identity, path, sessionId]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <PreviewImage
        key={identity}
        uri={image?.identity === identity ? image.uri : undefined}
        onLoad={onLoad}
        onError={() => setFailure(identity)}
      />
      {failure === identity && !retryable && (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
          }}
        >
          <Text>Fotoğraf yüklenemedi.</Text>
        </View>
      )}
      {failure === identity && retryable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fotoğrafı yeniden yükle"
          onPress={() => setRetry((count) => count + 1)}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
          }}
        >
          <Text>Fotoğraf yüklenemedi. Yeniden dene.</Text>
        </Pressable>
      )}
    </View>
  );
}
