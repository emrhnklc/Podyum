import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { ApiError, errorMessage } from "@/lib/api/client";
import { brand, colors, common, fonts } from "@/theme";
import { useAuth } from "../hooks/use-auth";
import { markWelcomed } from "../welcome";

export function LoginScreen() {
  const { client } = useAuth();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const locked = useRef(false);
  async function submit() {
    if (locked.current || !email.trim() || !password) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setNeedsVerification(false);
    try {
      await client.login(email, password);
      setPassword("");
      markWelcomed();
      router.replace(
        params.onboarding === "1" || client.state.me?.profileSetupRequired
          ? "/auth/register"
          : "/",
      );
    } catch (error) {
      setError(errorMessage(error));
      setNeedsVerification(
        error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <BackButton />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ gap: 18 }}
      >
        <Text style={common.title}>Tekrar hoş geldin</Text>
        <Text style={common.subtitle}>
          Hesabına giriş yap, kombinleri keşfet.
        </Text>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold }}>E-posta</Text>
          <TextInput
            accessibilityLabel="E-posta"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: brand.surface,
              color: colors.text,
            }}
          />
          <Text style={{ fontFamily: fonts.semibold }}>Şifre</Text>
          <TextInput
            accessibilityLabel="Şifre"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            onSubmitEditing={() => void submit()}
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: brand.surface,
              color: colors.text,
            }}
          />
        </View>
        {error && (
          <Text accessibilityRole="alert" style={{ color: colors.accent }}>
            {error}
          </Text>
        )}
        {busy && <ActivityIndicator color={brand.accent} />}
        <Button
          title={busy ? "Giriş yapılıyor…" : "Giriş yap"}
          disabled={busy || !email.trim() || !password}
          onPress={() => void submit()}
        />
        {needsVerification && (
          <Button
            title="E-postamı doğrula"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setPassword("");
              router.push({
                pathname: "/auth/verify-email",
                params: { email: email.trim(), onboarding: "1" },
              });
            }}
          />
        )}
        <Button
          title="Hesabın yok mu? Kayıt ol"
          variant="outline"
          disabled={busy}
          onPress={() => {
            setPassword("");
            router.push("/auth/register");
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
