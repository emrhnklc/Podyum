import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { apiBaseUrl, apiFetch } from "@/lib/api/client";
import { SessionManager } from "../session-manager";
import type { Session } from "../types";

const key = `podyum.session.${encodeURIComponent(apiBaseUrl ?? "unconfigured").replace(/[^a-z0-9._-]/gi, "_")}`;
const Context = createContext<SessionManager | null>(null);

function parse(value: string | null): Session | null {
  if (!value) return null;
  try {
    const row = JSON.parse(value) as Session;
    return row && typeof row.accessToken === "string" && typeof row.refreshToken === "string" && typeof row.sessionId === "string"
      && Number.isFinite(Date.parse(row.accessExpiresAt)) && Number.isFinite(Date.parse(row.refreshExpiresAt)) ? row : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => new SessionManager(apiFetch, {
    // Web önizlemesinde token diske yazılmaz. Native Keychain/Keystore kullanır.
    read: async () => Platform.OS === "web" ? null : parse(await SecureStore.getItemAsync(key)),
    write: async (session) => {
      if (Platform.OS === "web") return;
      if (session) await SecureStore.setItemAsync(key, JSON.stringify(session));
      else await SecureStore.deleteItemAsync(key);
    },
  }));
  useEffect(() => { void manager.restore(); }, [manager]);
  return <Context.Provider value={manager}>{children}</Context.Provider>;
}

export function useAuth() {
  const manager = useContext(Context);
  if (!manager) throw new Error("AuthProvider gerekli.");
  const state = useSyncExternalStore(manager.subscribe, manager.snapshot, manager.snapshot);
  return { ...state, client: manager };
}
