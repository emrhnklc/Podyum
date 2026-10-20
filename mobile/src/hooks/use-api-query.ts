import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";

export function useApiQuery<T>(path: `/${string}` | null) {
  const { client, session } = useAuth();
  const identity = `${session?.sessionId}:${path}`;
  const [state, setState] = useState<{
    identity: string;
    data?: T;
    error: string | null;
    loading: boolean;
  }>({ identity: "", error: null, loading: false });
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    abort.current?.abort();
    if (!path || !session) return;
    const controller = new AbortController();
    abort.current = controller;
    setState((old) => ({
      identity,
      data: old.identity === identity ? old.data : undefined,
      loading: true,
      error: null,
    }));
    try {
      const data = await client.request<T>(path, { signal: controller.signal });
      if (revision === generation.current)
        setState({ identity, data, loading: false, error: null });
    } catch (error) {
      if (revision === generation.current && !controller.signal.aborted)
        setState({ identity, loading: false, error: errorMessage(error) });
    }
  }, [client, identity, path, session]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        ++generation.current;
        abort.current?.abort();
      };
    }, [refresh]),
  );
  const current = state.identity === identity;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: !!path && !!session && (!current || state.loading),
    refresh,
  };
}

export type ApiPage<T> = {
  items: T[];
  nextCursor: string | null;
  serverNow?: string;
  unreadCount?: number;
};

export function useApiList<T>(path: `/${string}` | null) {
  const { client, session } = useAuth();
  const identity = `${session?.sessionId}:${path}`;
  const [state, setState] = useState<{
    identity: string;
    page?: ApiPage<T>;
    error: string | null;
    loading: boolean;
  }>({ identity: "", error: null, loading: false });
  const snapshot = useRef(state);
  useEffect(() => {
    snapshot.current = state;
  }, [state]);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const load = useCallback(
    async (reset: boolean) => {
      if (!path || !session) return;
      if (
        !reset &&
        (pending.current ||
          snapshot.current.identity !== identity ||
          !snapshot.current.page?.nextCursor)
      )
        return;
      if (reset) {
        ++generation.current;
        abort.current?.abort();
      }
      const revision = generation.current;
      const controller = new AbortController();
      abort.current = controller;
      pending.current = true;
      const previous =
        snapshot.current.identity === identity
          ? snapshot.current.page
          : undefined;
      setState({
        identity,
        page: reset ? undefined : previous,
        error: null,
        loading: true,
      });
      const cursor = reset ? null : previous?.nextCursor;
      const url = cursor
        ? (`${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` as const)
        : path;
      try {
        const page = await client.request<ApiPage<T>>(url, {
          signal: controller.signal,
        });
        if (revision === generation.current)
          setState({
            identity,
            page: {
              ...page,
              items: reset
                ? page.items
                : [...(previous?.items ?? []), ...page.items],
            },
            error: null,
            loading: false,
          });
      } catch (error) {
        if (revision === generation.current && !controller.signal.aborted)
          setState({
            identity,
            page: reset ? undefined : previous,
            error: errorMessage(error),
            loading: false,
          });
      } finally {
        if (revision === generation.current) pending.current = false;
      }
    },
    [client, identity, path, session],
  );
  useFocusEffect(
    useCallback(() => {
      void load(true);
      return () => {
        ++generation.current;
        abort.current?.abort();
        pending.current = false;
      };
    }, [load]),
  );
  const current = state.identity === identity;
  return {
    items: current ? (state.page?.items ?? []) : [],
    page: current ? state.page : undefined,
    loading: !!path && !!session && (!current || state.loading),
    error: current ? state.error : null,
    refresh: () => load(true),
    loadMore: () => load(false),
    hasMore: current && !!state.page?.nextCursor,
  };
}
