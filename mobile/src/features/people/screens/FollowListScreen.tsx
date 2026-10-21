import { Pressable, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PillChip } from "@/components/ui/PillChip";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList } from "@/hooks/use-api-query";
import { common, fonts } from "@/theme";
import { openUser, type FollowItem } from "../api/social";
import { FollowButton } from "../components/FollowButton";

export type FollowKind = "followers" | "following";

// Bir kullanıcının takipçileri veya takip ettikleri. Satırdaki düğme izleyicinin
// kendi takibini değiştirir; liste sunucudan yeniden okunur.
export function FollowListScreen({
  userId,
  kind,
  onKind,
}: {
  userId: string;
  kind: FollowKind;
  onKind: (kind: FollowKind) => void;
}) {
  const list = useApiList<FollowItem>(`/users/${userId}/${kind}?limit=20`);
  return (
    <Screen>
      <BackButton fallback="/profil" />
      <Text style={common.title}>
        {kind === "followers" ? "Takipçiler" : "Takip edilenler"}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PillChip
          label="Takipçiler"
          active={kind === "followers"}
          onPress={() => onKind("followers")}
        />
        <PillChip
          label="Takip edilenler"
          active={kind === "following"}
          onPress={() => onKind("following")}
        />
      </View>
      <ApiStatus
        loading={list.loading}
        error={list.error}
        retry={list.refresh}
      />
      {list.items.map((item) => (
        <View key={item.user.id} style={[common.card, common.spread]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.user.username} profilini aç`}
            onPress={() => openUser(item.user)}
            style={{ flex: 1 }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
              {item.user.displayName}
            </Text>
            <Text style={common.subtitle}>@{item.user.username}</Text>
          </Pressable>
          {!item.isSelf && (
            <FollowButton
              compact
              userId={item.user.id}
              isFollowing={item.isFollowing}
              onChanged={list.refresh}
            />
          )}
        </View>
      ))}
      {!list.loading && !list.error && !list.items.length && (
        <EmptyState
          title={
            kind === "followers" ? "Henüz takipçi yok" : "Henüz takip yok"
          }
          message={
            kind === "followers"
              ? "Bu profili takip edenler burada görünür."
              : "Takip edilen hesaplar burada görünür."
          }
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
