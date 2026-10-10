import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { common } from "@/theme";

export function NotificationsScreen() {
  return (
    <Screen>
      <Text style={common.title}>Bildirimler</Text>
      <EmptyState
        icon="notifications-outline"
        title="Henüz bildirim yok"
        message="Oylama sonuçları, arkadaşlık istekleri ve yorumlar burada görünecek."
      />
    </Screen>
  );
}
