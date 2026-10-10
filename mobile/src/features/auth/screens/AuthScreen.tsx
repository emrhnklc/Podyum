import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { common } from "@/theme";

export function AuthScreen() {
  return (
    <Screen>
      <Text style={common.title}>{"Podyum'a hoş geldin"}</Text>
      <EmptyState
        icon="person-circle-outline"
        title="Şimdilik birlikte keşfedelim"
        message="E-posta, Google ve Apple giriş ekranları sonraki adımda bağlanacak. Önizlemeyi hesap açmadan gezebilirsin."
      />
      <Button title="Keşfet'e dön" onPress={() => router.replace("/")} />
    </Screen>
  );
}
