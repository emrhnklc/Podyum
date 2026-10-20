import { ActivityIndicator, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";
import { brand, colors } from "@/theme";

export function ApiStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry?: () => unknown;
}) {
  return (
    <View style={{ gap: 10 }}>
      {loading && <ActivityIndicator color={brand.accent} />}
      {error && (
        <>
          <Text accessibilityRole="alert" style={{ color: colors.accent }}>
            {error}
          </Text>
          {retry && (
            <Button
              title="Tekrar dene"
              variant="outline"
              onPress={() => void retry()}
            />
          )}
        </>
      )}
    </View>
  );
}
