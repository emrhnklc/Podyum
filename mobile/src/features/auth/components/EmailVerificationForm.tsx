import { useRef, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { brand, colors, common, fonts } from "@/theme";
import { errorMessage } from "@/lib/api/client";
import { confirmEmail, requestVerification } from "../registration";

export function EmailVerificationForm({
  email,
  initialToken = "",
  onContinue,
  continueLabel = "Girişe devam et",
}: {
  email: string;
  initialToken?: string;
  onContinue: () => void | Promise<void>;
  continueLabel?: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Text style={common.title}>E-postanı doğrula</Text>
      {!!email && <Text style={{ fontFamily: fonts.semibold }}>{email}</Text>}
      <Text style={common.subtitle}>
        Bu geliştirme sürümünde doğrulama iletisi e-posta yerine sunucunun yerel
        posta kutusuna kaydedilir. İletideki tek kullanımlık doğrulama
        anahtarını aşağıya yapıştır.
      </Text>
      {!confirmed && (
        <>
          <TextInput
            accessibilityLabel="Doğrulama anahtarı"
            placeholder="Doğrulama anahtarı"
            autoCapitalize="none"
            autoCorrect={false}
            value={token}
            onChangeText={setToken}
            editable={!busy}
            style={{
              padding: 16,
              backgroundColor: brand.surface,
              color: colors.text,
              borderRadius: 16,
            }}
          />
          <Button
            title="E-postayı doğrula"
            disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(token.trim())}
            onPress={() =>
              void run(async () => {
                await confirmEmail(token);
                setToken("");
                setConfirmed(true);
              })
            }
          />
          {!!email && (
            <Button
              title="Yeni doğrulama iste"
              variant="outline"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await requestVerification(email);
                  setToken("");
                  setNotice(
                    "Uygun bir hesap varsa yeni doğrulama iletisi yerel posta kutusuna kaydedildi. Önceki anahtar artık kullanılamaz.",
                  );
                })
              }
            />
          )}
        </>
      )}
      {confirmed && (
        <Text>
          E-posta doğrulandı. Hesabına giriş yaparak devam edebilirsin.
        </Text>
      )}
      {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.accent }}>
          {error}
        </Text>
      )}
      {busy && <ActivityIndicator color={brand.accent} />}
      <Button
        title={confirmed ? continueLabel : "Daha önce doğruladım, giriş yap"}
        variant={confirmed ? "primary" : "outline"}
        disabled={busy}
        onPress={() =>
          void run(async () => {
            await onContinue();
          })
        }
      />
    </View>
  );
}
