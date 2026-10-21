import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { openUser } from "@/features/people/api/social";
import { errorMessage } from "@/lib/api/client";
import { brand, common, fonts } from "@/theme";

type Notification = {
  id: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  count: number;
  actor: { id: string; username: string; displayName: string } | null;
  target: { type: "USER" | "POLL" | "GAME"; id: string; title: string | null };
};
const labels: Record<string, string> = {
  "friend.request.received": "arkadaşlık isteği gönderdi",
  "friend.request.accepted": "arkadaşlık isteğini kabul etti",
  "user.follow.received": "seni takip etmeye başladı",
  "poll.comment.received": "paylaşımına yorum yaptı",
  "poll.result.own": "Oylaman sonuçlandı",
  "poll.result.voted": "Oy verdiğin oylama sonuçlandı",
  "game.voting.opened": "Defile oylaması başladı",
  "game.completed": "Defile sonuçları açıklandı",
};
export function NotificationsScreen() {
  const { client } = useAuth();
  const list = useApiList<Notification>("/me/notifications?limit=20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function act(item?: Notification) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (item) {
        if (!item.isRead)
          await client.request(`/me/notifications/${item.id}/read`, {
            method: "PUT",
          });
        if (item.target.type === "USER")
          openUser({
            id: item.target.id,
            username: item.actor?.username ?? item.target.id,
            displayName: item.actor?.displayName ?? "Profil",
          });
        else if (item.target.type === "GAME")
          router.push({
            pathname: "/games/[id]",
            params: { id: item.target.id },
          });
        else
          router.push({
            pathname: "/polls/[id]",
            params: { id: item.target.id },
          });
      } else {
        if (!list.page?.serverNow) return;
        await client.request("/me/notifications/read-all", {
          method: "POST",
          body: JSON.stringify({ before: list.page.serverNow }),
        });
        await list.refresh();
      }
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
      <Text style={common.title}>Bildirimler</Text>
      <View style={{ gap: 10 }}>
        <Text style={common.subtitle}>
          {list.page?.unreadCount ?? 0} okunmamış
        </Text>
        <Button
          title="Tümünü okundu yap"
          variant="outline"
          disabled={busy || !list.page?.unreadCount}
          onPress={() => void act()}
        />
        <Button
          title="Bildirim tercihleri"
          variant="outline"
          onPress={() =>
            router.push({
              pathname: "/settings/preferences",
              params: { section: "notifications" },
            })
          }
        />
      </View>
      <ApiStatus
        loading={list.loading || busy}
        error={error ?? list.error}
        retry={list.refresh}
      />
      {list.items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.isRead ? "" : "Okunmamış: "}${labels[item.type] ?? "Yeni bildirim"}`}
          disabled={busy}
          onPress={() => void act(item)}
          style={[
            common.card,
            { gap: 6, borderColor: item.isRead ? brand.line : brand.accent },
          ]}
        >
          <Text style={{ fontFamily: fonts.semibold }}>
            {item.actor ? `${item.actor.displayName} ` : ""}
            {labels[item.type] ?? "Yeni bildirim"}
            {item.count > 1 ? ` · ${item.count}` : ""}
          </Text>
          {!!item.target.title && <Text>{item.target.title}</Text>}
          <Text style={common.subtitle}>
            {new Date(item.createdAt).toLocaleString("tr-TR")}
          </Text>
        </Pressable>
      ))}
      {!list.loading && !list.error && !list.items.length && (
        <EmptyState
          icon="notifications-outline"
          title="Henüz bildirim yok"
          message="Oylama sonuçları, arkadaşlık istekleri ve yorumlar burada görünecek."
        />
      )}
      {list.hasMore && (
        <Button
          title="Daha fazla bildirim"
          disabled={list.loading}
          onPress={() => void list.loadMore()}
        />
      )}
    </Screen>
  );
}
