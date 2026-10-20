import { useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { confirmAction } from "@/lib/confirm";
import type { Relationship } from "../api/social";

export function RelationshipActions({
  userId,
  state,
  onChanged,
}: {
  userId: string;
  state: Relationship;
  onChanged: () => unknown;
}) {
  const { client } = useAuth();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(
    action: "request" | "cancel" | "accept" | "decline" | "remove",
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      if (
        action === "remove" &&
        !(await confirmAction(
          "Arkadaşlıktan çıkar",
          "Bu kişiyi arkadaşlarından çıkarmak istiyor musun?",
          "Çıkar",
        ))
      )
        return;
      const path =
        action === "request"
          ? "/friend-requests"
          : action === "remove"
            ? `/friends/${userId}`
            : `/friend-requests/${userId}${["accept", "decline"].includes(action) ? `/${action}` : ""}`;
      await client.request(path as `/${string}`, {
        method: ["cancel", "remove"].includes(action) ? "DELETE" : "POST",
        ...(action === "request"
          ? { body: JSON.stringify({ targetUserId: userId }) }
          : {}),
      });
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
      await onChanged();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (state === "SELF") return null;
  return (
    <View style={{ gap: 8 }}>
      {state === "NONE" && (
        <Button
          title="Arkadaş ekle"
          disabled={busy}
          onPress={() => void act("request")}
        />
      )}
      {state === "OUTGOING_REQUEST" && (
        <Button
          title="İsteği geri al"
          variant="outline"
          disabled={busy}
          onPress={() => void act("cancel")}
        />
      )}
      {state === "INCOMING_REQUEST" && (
        <>
          <Button
            title="Kabul et"
            disabled={busy}
            onPress={() => void act("accept")}
          />
          <Button
            title="Reddet"
            variant="outline"
            disabled={busy}
            onPress={() => void act("decline")}
          />
        </>
      )}
      {state === "FRIENDS" && (
        <Button
          title="Arkadaşlıktan çıkar"
          variant="outline"
          disabled={busy}
          onPress={() => void act("remove")}
        />
      )}
      {error && <Text accessibilityRole="alert">{error}</Text>}
    </View>
  );
}
