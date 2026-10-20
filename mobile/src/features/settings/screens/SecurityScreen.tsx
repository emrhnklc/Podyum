import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { confirmAction } from "@/lib/confirm";
import { errorMessage } from "@/lib/api/client";
import { common, colors } from "@/theme";

export function SecurityScreen() {
  const { client, me } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function act(remove: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (remove) {
        if (
          confirmation !== me?.user.username ||
          !(await confirmAction(
            "Hesabını kalıcı olarak sil",
            "Profilin, fotoğrafların ve kişisel bilgilerin silinir. Geçmiş oy ve oyun sonuçların anonim kalır. Bu işlem geri alınamaz.",
            "Hesabımı sil",
          ))
        )
          return;
        await client.request("/me/account", {
          method: "DELETE",
          body: JSON.stringify({ confirmDeletion: true }),
        });
      } else {
        if (
          !(await confirmAction(
            "Tüm cihazlardan çıkış",
            "Bu cihazdaki oturumun da kapatılır.",
            "Çıkış yap",
          ))
        )
          return;
        await client.request("/auth/logout-all", { method: "POST" });
      }
      await client.logout(false);
      router.replace("/auth");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <BackButton />
      <Text style={common.title}>Hesap ve Güvenlik</Text>
      <Button
        title="Şifremi sıfırla"
        variant="outline"
        onPress={() => router.push("/auth/reset-password")}
        disabled={busy}
      />
      <Button
        title="Tüm cihazlardan çıkış yap"
        variant="outline"
        disabled={busy}
        onPress={() => void act(false)}
      />
      <Text style={common.title}>Hesabı sil</Text>
      <Text>
        Silme geri alınamaz. Devam etmek için kullanıcı adını yaz: @
        {me?.user.username}
      </Text>
      <TextInput
        accessibilityLabel="Silme onayı kullanıcı adı"
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        style={{ padding: 16, color: colors.text }}
      />
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <Button
        title="Hesabımı kalıcı olarak sil"
        disabled={busy || !me || confirmation !== me.user.username}
        onPress={() => void act(true)}
      />
    </Screen>
  );
}
