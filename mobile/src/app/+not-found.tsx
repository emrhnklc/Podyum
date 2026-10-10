import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        title="Sayfa bulunamadı"
        message="Keşfet'e dönerek devam edebilirsin."
      />
      <Button title="Keşfet'e dön" onPress={() => router.replace("/")} />
    </Screen>
  );
}
