import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { trendsPath } from "../api/trends";
import { TrendList } from "../trend-list";
import {
  DEFAULT_TREND_FILTERS,
  type TrendFilters,
  type TrendsPage,
} from "../types";

export function useTrends() {
  const { client, session } = useAuth();
  const [filters, setFilters] = useState<TrendFilters>(DEFAULT_TREND_FILTERS);
  const path = trendsPath(filters);
  const sessionId = session?.sessionId;
  const list = useMemo(
    () =>
      new TrendList(
        (url, options) => client.request<TrendsPage>(url, options),
        sessionId ? path : "/trends",
      ),
    [client, path, sessionId],
  );
  const state = useSyncExternalStore(
    list.subscribe,
    list.snapshot,
    list.snapshot,
  );
  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;
      if (AppState.currentState === "active") void list.refresh();
      const listener = AppState.addEventListener("change", (next) => {
        if (next === "active") void list.refresh();
        else list.cancel();
      });
      return () => {
        listener.remove();
        list.cancel();
      };
    }, [list, sessionId]),
  );
  const set = <K extends keyof TrendFilters>(key: K, value: TrendFilters[K]) =>
    setFilters((old) => ({ ...old, [key]: value }));
  return {
    ...state,
    filters,
    rows: state.page?.items ?? [],
    authenticated: !!sessionId,
    set,
    refresh: list.refresh,
    loadMore: list.loadMore,
    hasMore: !!state.page?.nextCursor,
    activeCount:
      Number(filters.category !== "ALL") +
      Number(filters.voter !== "ANY") +
      Number(filters.age !== "ANY") +
      Number(!!filters.brand) +
      Number(filters.price !== "ALL") +
      Number(filters.currency !== "TRY"),
    reset: () =>
      setFilters((old) => ({ ...DEFAULT_TREND_FILTERS, period: old.period })),
  };
}
