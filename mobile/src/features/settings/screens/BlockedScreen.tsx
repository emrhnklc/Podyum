import { useRef, useState } from "react";
import { View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { common } from "@/theme";

type Block = {
  blockedUserId: string;
  user: { username: string; displayName: string } | null;
};
export function BlockedScreen() {
  const { client } = useAuth();
  const list = useApiList<Block>("/me/blocks?limit=20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function unblock(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await client.request(`/blocks/${id}`, { method: "DELETE" });
      await list.refresh();
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
      <Text style={common.title}>Engellenen kişiler</Text>
      <ApiStatus
        loading={list.loading || busy}
        error={error ?? list.error}
        retry={list.refresh}
      />
      {list.items.map((item) => (
        <View key={item.blockedUserId} style={common.card}>
          <Text>{item.user?.displayName ?? "Silinmiş hesap"}</Text>
          {item.user && <Text>@{item.user.username}</Text>}
          <Button
            title="Engeli kaldır"
            disabled={busy}
            variant="outline"
            onPress={() => void unblock(item.blockedUserId)}
          />
        </View>
      ))}
      {!list.loading && !list.error && !list.items.length && (
        <EmptyState
          title="Engellenen kimse yok"
          message="Engellediğin kişileri burada yönetebilirsin."
        />
      )}
      {list.hasMore && (
        <Button
          title="Daha fazla"
          disabled={list.loading}
          onPress={() => void list.loadMore()}
        />
      )}
    </Screen>
  );
}
