import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import type { ApiPoll } from "../api/types";
import { ApiPollCard } from "../components/ApiPollCard";

export function ApiPollDetailScreen({ id }: { id: string }) {
  const { client, me, ready } = useAuth();
  const [poll, setPoll] = useState<ApiPoll | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => { setPoll(null); setError(null); setAttempt((row) => row + 1); }, []);
  useEffect(() => {
    if (!me) return;
    const abort = new AbortController();
    void client.request<ApiPoll>(`/polls/${id}`, { signal: abort.signal }).then((row) => { if (!abort.signal.aborted) setPoll(row); }).catch((error) => { if (!abort.signal.aborted) setError(errorMessage(error)); });
    return () => abort.abort();
  }, [client, id, me, attempt]);
  return <Screen><BackButton />{!ready ? <ActivityIndicator /> : !me ? <><Text>Bu paylaşımı görmek için giriş yap.</Text><Button title="Giriş yap" onPress={() => router.push("/auth/login")} /></> : error ? <><Text accessibilityRole="alert">{error}</Text><Button title="Tekrar dene" onPress={load} /></> : poll ? <ApiPollCard key={`${poll.id}:${attempt}`} initial={poll} detail /> : <View><ActivityIndicator /></View>}</Screen>;
}
