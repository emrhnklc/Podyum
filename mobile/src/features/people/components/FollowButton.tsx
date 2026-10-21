import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts } from "@/theme";
import type { FollowReceipt } from "../api/social";

// Takip et / takibi bırak. Sunucu yanıtı tek doğrudur; hata olursa üst
// bileşen güncel durumu yeniden okur.
export function FollowButton({
  userId,
  isFollowing,
  followsYou = false,
  compact = false,
  onChanged,
}: {
  userId: string;
  isFollowing: boolean;
  followsYou?: boolean;
  compact?: boolean;
  onChanged: (receipt: FollowReceipt | null) => unknown;
}) {
  const { client } = useAuth();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const receipt = await client.request<FollowReceipt>(
        `/users/${userId}/follow`,
        { method: isFollowing ? "DELETE" : "PUT" },
      );
      await onChanged(receipt);
    } catch (failure) {
      setError(errorMessage(failure));
      await onChanged(null);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const title = isFollowing
    ? "Takiptesin"
    : followsYou
      ? "Sen de takip et"
      : "Takip Et";
  return (
    <View style={{ gap: 6, flex: compact ? undefined : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFollowing ? "Takibi bırak" : title}
        accessibilityState={{ disabled: busy, selected: isFollowing }}
        disabled={busy}
        onPress={() => void toggle()}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compact,
          isFollowing ? styles.following : styles.follow,
          { opacity: busy ? 0.5 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text
          style={[
            styles.text,
            compact && { fontSize: 13 },
            { color: isFollowing ? colors.text : colors.onAccent },
          ]}
        >
          {title}
        </Text>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.accent }}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  compact: { minHeight: 36, borderRadius: 18, paddingHorizontal: 14 },
  follow: { backgroundColor: brand.accent },
  following: {
    backgroundColor: brand.chip,
    borderWidth: 1,
    borderColor: brand.line,
  },
  text: { fontFamily: fonts.bold, fontSize: 16 },
});
