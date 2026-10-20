import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PillChip } from "@/components/ui/PillChip";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList } from "@/hooks/use-api-query";
import { SocialRow } from "@/features/people/components/SocialRow";
import type { SocialItem } from "@/features/people/api/social";
import { common } from "@/theme";

const views = [
  { label: "Arkadaşlar", path: "/me/friends?limit=20" },
  {
    label: "Gelen istekler",
    path: "/me/friend-requests?direction=incoming&limit=20",
  },
  {
    label: "Gönderilenler",
    path: "/me/friend-requests?direction=outgoing&limit=20",
  },
] as const;

export function FriendsScreen() {
  const [tab, setTab] = useState(0);
  const list = useApiList<SocialItem>(views[tab].path);
  return (
    <Screen>
      <BackButton fallback="/profil" />
      <Text style={common.title}>Arkadaşlar</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {views.map((item, index) => (
          <PillChip
            key={item.path}
            label={item.label}
            active={tab === index}
            onPress={() => setTab(index)}
          />
        ))}
      </View>
      <Button
        title="Kişi ara"
        variant="outline"
        onPress={() => router.push("/people")}
      />
      <ApiStatus
        loading={list.loading}
        error={list.error}
        retry={list.refresh}
      />
      {list.items.map((item) => (
        <SocialRow key={item.user.id} item={item} refresh={list.refresh} />
      ))}
      {!list.loading && !list.error && !list.items.length && (
        <EmptyState
          title="Henüz kimse yok"
          message="Arkadaşların ve isteklerin burada görünecek."
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
