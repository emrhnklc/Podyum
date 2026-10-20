import { Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useApiQuery } from "@/hooks/use-api-query";
import { colors } from "@/theme";

export function NotificationsButton() {
  const count = useApiQuery<{ unreadCount: number }>(
    "/me/notifications/unread-count",
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bildirimler${count.data?.unreadCount ? `, ${count.data.unreadCount} okunmamış` : ""}`}
      onPress={() => router.push("/bildirimler")}
      style={{
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {!!count.data?.unreadCount && <Text>{count.data.unreadCount}</Text>}
    </Pressable>
  );
}
