import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList, useApiQuery } from "@/hooks/use-api-query";
import { phaseLabel } from "./BrowseGamesScreen";
import type { GameSummary, LeagueInfo } from "../api/games";
import { common } from "@/theme";

export type MyLeague = { totalPoints: number; league: LeagueInfo };
export function LeagueScreen() {
  const league = useApiQuery<MyLeague>("/me/league");
  return (
    <Screen>
      <BackButton fallback="/defile" />
      <Text style={common.title}>Ligim</Text>
      <ApiStatus
        loading={league.loading}
        error={league.error}
        retry={league.refresh}
      />
      {league.data && (
        <View style={common.card}>
          <Text style={common.title}>{league.data.league.name}</Text>
          <Text>{league.data.totalPoints} lig puanı</Text>
          {league.data.league.nextName && (
            <Text>
              {league.data.league.nextName} için {league.data.league.remaining}{" "}
              puan
            </Text>
          )}
        </View>
      )}
      <Text style={common.subtitle}>
        Herkese açık defilelerin sonuçlarından lig puanı kazanırsın. Davetli
        odalar lig puanı vermez.
      </Text>
      <Button
        title="Defilelerim"
        onPress={() => router.push("/games/history")}
      />
      <Button
        title="Açık defileleri gör"
        variant="outline"
        onPress={() => router.push("/games/browse")}
      />
    </Screen>
  );
}
export function GameHistoryScreen() {
  const list = useApiList<GameSummary & { membershipStatus: string }>(
    "/me/games?limit=20",
  );
  return (
    <Screen>
      <BackButton fallback="/defile" />
      <Text style={common.title}>Defilelerim</Text>
      <Button
        title="Açık defileleri gör"
        variant="outline"
        onPress={() => router.push("/games/browse")}
      />
      <ApiStatus
        loading={list.loading}
        error={list.error}
        retry={list.refresh}
      />
      {list.items.map((game) => (
        <Pressable
          key={game.id}
          accessibilityRole="button"
          accessibilityLabel={`${game.themeTitle}, ${phaseLabel[game.phase]}`}
          disabled={game.membershipStatus !== "ACTIVE"}
          onPress={() =>
            router.push({ pathname: "/games/[id]", params: { id: game.id } })
          }
          style={[common.card, { gap: 8 }]}
        >
          <Text style={common.title}>{game.themeTitle}</Text>
          <Text>
            {game.membershipStatus === "LEFT"
              ? "Ayrıldın"
              : phaseLabel[game.phase]}{" "}
            · {game.isPublic ? "Herkese açık" : "Davetli oda"}
          </Text>
        </Pressable>
      ))}
      {!list.loading && !list.error && !list.items.length && (
        <EmptyState
          title="Henüz defileye katılmadın"
          message="Bir odaya katılabilir veya kendi odanı kurabilirsin."
        />
      )}
      {list.hasMore && (
        <Button
          title="Daha fazla defile"
          disabled={list.loading}
          onPress={() => void list.loadMore()}
        />
      )}
    </Screen>
  );
}
