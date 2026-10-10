import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import type { ApiPoll, FeedPage } from "@/features/polls/api/types";
import type { PollCategory } from "@/constants/poll-categories";

export function useApiFeed(scope: "everyone" | "friends", category: "ALL" | PollCategory) {
  const { client } = useAuth();
  const [rows, setRows] = useState<ApiPoll[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const focused = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const load = useCallback(async (reset: boolean) => {
    if (pending.current && !reset) return;
    if (!reset && !cursor.current) return;
    if (reset) { ++generation.current; abort.current?.abort(); setRows([]); cursor.current = null; }
    const revision = generation.current;
    const controller = new AbortController(); abort.current = controller;
    pending.current = true; setBusy(true); setError(null);
    const query = new URLSearchParams({ scope, limit: "20" });
    if (category !== "ALL") query.set("category", category);
    if (!reset && cursor.current) query.set("cursor", cursor.current);
    try {
      const page = await client.request<FeedPage>(`/feed?${query}`, { signal: controller.signal });
      if (revision !== generation.current) return;
      cursor.current = page.nextCursor;
      setRows((previous) => reset ? page.items : [...previous, ...page.items.filter((item) => !previous.some((row) => row.id === item.id))]);
    } catch (error) {
      if (revision === generation.current && !controller.signal.aborted) setError(errorMessage(error));
    } finally { if (revision === generation.current) { pending.current = false; setBusy(false); } }
  }, [client, scope, category]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    let disposed = false;
    const invalidate = () => { ++generation.current; abort.current?.abort(); pending.current = false; };
    void Promise.resolve().then(() => { if (!disposed) return load(true); });
    return () => { disposed = true; focused.current = false; invalidate(); };
  }, [load]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active" && focused.current) void load(true); });
    return () => subscription.remove();
  }, [load]);
  const skip = () => setRows((previous) => previous.slice(1));
  useEffect(() => {
    let disposed = false;
    if (!rows.length && !busy && !error && cursor.current) void Promise.resolve().then(() => { if (!disposed) return load(false); });
    return () => { disposed = true; };
  }, [rows.length, busy, error, load]);
  return { post: rows[0], busy, error, skip, refresh: () => load(true), retry: () => load(cursor.current === null) };
}
