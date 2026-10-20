import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { PillChip } from "@/components/ui/PillChip";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { common, colors } from "@/theme";

const reasons = [
  { id: "SPAM", label: "Spam" },
  { id: "HARASSMENT", label: "Taciz" },
  { id: "INAPPROPRIATE", label: "Uygunsuz içerik" },
  { id: "IMPERSONATION", label: "Taklit hesap" },
  { id: "OTHER", label: "Diğer" },
];
export function ReportScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const { client } = useAuth();
  const [reason, setReason] = useState("SPAM");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const valid =
    ["USER", "POLL", "COMMENT"].includes(type) &&
    /^[0-9a-f-]{36}$/i.test(id ?? "");
  async function submit() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await client.request("/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: type,
          targetId: id,
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      setSent(true);
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
      <Text style={common.title}>Şikâyet et</Text>
      {sent ? (
        <Text>Şikâyetin alındı. İnceleme için iletildi.</Text>
      ) : (
        <>
          <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
            {reasons.map((item) => (
              <PillChip
                key={item.id}
                label={item.label}
                active={reason === item.id}
                onPress={() => {
                  if (!busy) setReason(item.id);
                }}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Şikâyet açıklaması"
            placeholder="Açıklama (isteğe bağlı)"
            multiline
            maxLength={500}
            value={note}
            onChangeText={setNote}
            editable={!busy}
            style={{ padding: 16, minHeight: 100, color: colors.text }}
          />
          {error && <Text accessibilityRole="alert">{error}</Text>}
          {!valid && <Text>Şikâyet edilecek içerik bulunamadı.</Text>}
          <Button
            title={busy ? "Gönderiliyor…" : "Şikâyeti gönder"}
            disabled={busy || !valid}
            onPress={() => void submit()}
          />
        </>
      )}
    </Screen>
  );
}
