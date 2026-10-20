import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { useAuth } from "../hooks/use-auth";
import { loginErrors } from "../login";
import { common, colors } from "@/theme";

export function ResetPasswordScreen() {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [requested, setRequested] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit(confirm: boolean) {
    if (lock.current) return;
    setError(null);
    if (
      confirm &&
      (loginErrors("a@example.com", password).password ||
        password !== confirmation ||
        !/^[A-Za-z0-9_-]{43}$/.test(token.trim()))
    ) {
      setError(
        "Geçerli sıfırlama anahtarını ve eşleşen 8–128 karakterlik şifrelerini yaz.",
      );
      return;
    }
    if (!confirm && loginErrors(email, "Test123!").email) {
      setError("Geçerli bir e-posta adresi yaz.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (confirm) {
        await apiRequest("/auth/password-reset/confirm", {
          method: "POST",
          body: JSON.stringify({ token: token.trim(), password }),
        });
        await client.logout(false);
        setPassword("");
        setConfirmation("");
        setToken("");
        setDone(true);
      } else {
        await apiRequest("/auth/password-reset/request", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        setRequested(true);
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const inputStyle = { padding: 16, color: colors.text };
  return (
    <Screen>
      <BackButton />
      <Text style={common.title}>Şifreni sıfırla</Text>
      {done ? (
        <>
          <Text>
            Şifren değiştirildi. Tüm cihazlardaki eski oturumların kapatıldı.
          </Text>
          <Button
            title="Giriş yap"
            onPress={() => router.replace("/auth/login")}
          />
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Sıfırlama e-postası"
            placeholder="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={inputStyle}
          />
          <Button
            title={
              requested ? "Anahtarı yeniden iste" : "Sıfırlama anahtarı iste"
            }
            disabled={busy}
            onPress={() => void submit(false)}
          />
          {requested && (
            <Text>
              Bu e-posta ile bir hesap varsa sıfırlama talebi oluşturuldu.
            </Text>
          )}
          <Text style={common.subtitle}>
            Geliştirme sürümünde gerçek e-posta gönderimi kapalıdır. Sıfırlama
            anahtarı yalnız yerel posta kutusuna kaydedilir.
          </Text>
          <TextInput
            accessibilityLabel="Sıfırlama anahtarı"
            placeholder="Sıfırlama anahtarı"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={inputStyle}
          />
          <TextInput
            accessibilityLabel="Yeni şifre"
            placeholder="Yeni şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={inputStyle}
          />
          <TextInput
            accessibilityLabel="Yeni şifre tekrar"
            placeholder="Yeni şifre tekrar"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={inputStyle}
          />
          {error && <Text accessibilityRole="alert">{error}</Text>}
          <Button
            title="Şifremi değiştir"
            disabled={busy}
            onPress={() => void submit(true)}
          />
        </>
      )}
    </Screen>
  );
}
