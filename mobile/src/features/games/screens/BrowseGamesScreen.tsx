import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { joinOpen, type GameSummary } from "../api/games";
import { common, colors } from "@/theme";

export const phaseLabel: Record<string, string> = {
  SCHEDULED: "Başlamadı",
  WAITING: "Bekleme",
  SUBMISSION: "Fotoğraf gönderimi",
  VOTING: "Oylama",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};
export function BrowseGamesScreen() {
  const params = useLocalSearchParams<{ theme?: string }>();
  const [theme, setTheme] = useState(params.theme ?? "");
  const { client } = useAuth();
  const rooms = useApiQuery<GameSummary[]>("/games/open");
  const daily = useApiQuery<{
    scheduleConfigured: boolean;
    event: GameSummary | null;
  }>("/games/daily");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const all = [
    ...(daily.data?.event ? [daily.data.event] : []),
    ...(rooms.data ?? []),
  ];
  const rows = all.filter(
    (game, index) =>
      all.findIndex((row) => row.id === game.id) === index &&
      game.themeTitle
        .toLocaleLowerCase("tr")
        .includes(theme.trim().toLocaleLowerCase("tr")),
  );
  async function join(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const game = await joinOpen(client, id);
      router.push({ pathname: "/games/[id]", params: { id: game.id } });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <BackButton fallback="/defile" />
      <Text style={common.title}>Açık defileler</Text>
      <TextInput
        accessibilityLabel="Defile teması ara"
        placeholder="Temaya göre ara"
        value={theme}
        onChangeText={setTheme}
        style={{ padding: 16, color: colors.text }}
      />
      <View style={common.row}>
        <Button
          title="Odalarım"
          variant="outline"
          onPress={() => router.push("/games/history")}
        />
        <Button
          title="Yeni oda"
          onPress={() =>
            router.push({
              pathname: "/games/new",
              params: { theme: theme.trim() || "90'lar" },
            })
          }
        />
      </View>
      <ApiStatus
        loading={rooms.loading || daily.loading || busy}
        error={error ?? rooms.error ?? daily.error}
        retry={() => {
          void rooms.refresh();
          void daily.refresh();
        }}
      />
      {rows.map((game) => (
        <View key={game.id} style={[common.card, { gap: 10 }]}>
          <Text style={common.title}>{game.themeTitle}</Text>
          <Text>
            {game.kind === "DAILY" ? "Günlük defile" : "Açık oda"} ·{" "}
            {phaseLabel[game.phase]}
          </Text>
          {game.startsAt && (
            <Text>{new Date(game.startsAt).toLocaleString("tr-TR")}</Text>
          )}
          {["WAITING", "SCHEDULED", "SUBMISSION"].includes(game.phase) ? (
            <Button
              title="Katıl"
              disabled={busy}
              onPress={() => void join(game.id)}
            />
          ) : (
            <Text>Katıldıysan Odalarım ekranından açabilirsin.</Text>
          )}
        </View>
      ))}
      {!rooms.loading &&
        !daily.loading &&
        !rooms.error &&
        !daily.error &&
        !rows.length && (
          <EmptyState
            title="Bu temada açık defile yok"
            message="İstersen bu temayla yeni bir oda kurabilirsin."
          />
        )}
      {daily.data && !daily.data.scheduleConfigured && (
        <Text style={common.subtitle}>
          Günlük defile saati henüz belirlenmedi. Açık odalara katılabilir veya
          kendi odanı kurabilirsin.
        </Text>
      )}
    </Screen>
  );
}
