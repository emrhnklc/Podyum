import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { blush, colors, fonts } from "@/theme";
import type { ApiComment, CommentPage } from "../api/types";

export function CommentsScreen({ pollId }: { pollId: string }) {
  const { client, me } = useAuth();
  const [rows, setRows] = useState<ApiComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [canComment, setCanComment] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  const receipt = useRef<{ body: string; key: string } | null>(null);
  const load = useCallback(async (next: string | null = null) => {
    const query = new URLSearchParams({ limit: "20" });
    if (next) query.set("cursor", next);
    const page = await client.request<CommentPage>(`/polls/${pollId}/comments?${query}`);
    if (!alive.current) return;
    setRows((previous) => next ? [...previous, ...page.items.filter((item) => !previous.some((row) => row.id === item.id))] : page.items);
    setCursor(page.nextCursor); setCanComment(page.canComment); setCommentsEnabled(page.commentsEnabled);
  }, [client, pollId]);
  const run = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await work(); }
    catch (error) { if (alive.current) setError(errorMessage(error)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (me) void run(() => load());
    return () => { alive.current = false; };
  }, [load, run, me]);
  async function send() {
    const trimmed = body.trim();
    if (!trimmed || !canComment) return;
    await run(async () => {
      if (receipt.current?.body !== trimmed) receipt.current = { body: trimmed, key: Crypto.randomUUID() };
      await client.request(`/polls/${pollId}/comments`, { method: "POST", headers: { "Idempotency-Key": receipt.current.key }, body: JSON.stringify({ body: trimmed }) });
      receipt.current = null;
      if (alive.current) setBody("");
      await load();
    });
  }
  return <Screen>
    <BackButton /><Text style={{ fontFamily: fonts.bold, fontSize: 24 }}>Yorumlar</Text>
    {!me ? <><Text>Yorumları görmek için giriş yap.</Text><Button title="Giriş yap" onPress={() => router.push("/auth/login")} /></> : <>
      {canComment ? <View style={{ gap: 10 }}><TextInput accessibilityLabel="Yorumun" placeholder="Kombin hakkında ne düşünüyorsun?" multiline maxLength={1000} value={body} onChangeText={setBody} editable={!busy} style={{ minHeight: 90, borderRadius: 16, padding: 16, backgroundColor: blush.surface, color: colors.text }} /><Button title="Gönder" disabled={busy || !body.trim()} onPress={() => void send()} /></View> : <Text style={{ color: colors.muted }}>{commentsEnabled ? "Yorum yazmak için önce bir kombin seçmelisin." : "Yeni yorumlara kapalı."}</Text>}
      {busy && <ActivityIndicator color={blush.pink} />}
      {error && <><Text accessibilityRole="alert" style={{ color: colors.accent }}>{error}</Text><Button title="Yorumları yenile" disabled={busy} onPress={() => void run(() => load())} /></>}
      {!busy && !error && !rows.length && <EmptyState title="İlk yorumu sen yaz" message="Henüz yorum yok." />}
      {rows.map((row) => <View key={row.id} style={{ padding: 16, borderRadius: 20, gap: 8, backgroundColor: blush.surface }}><Text style={{ fontFamily: fonts.bold }}>{row.author.username}</Text><Text>{row.body}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(row.createdAt).toLocaleString("tr-TR")}</Text>{row.canRemove && <Button title="Yorumu sil" variant="outline" disabled={busy} onPress={() => void run(async () => { await client.request(`/comments/${row.id}`, { method: "DELETE" }); await load(); })} />}</View>)}
      {cursor && <Button title="Daha fazla yorum" disabled={busy} variant="outline" onPress={() => void run(() => load(cursor))} />}
    </>}
  </Screen>;
}
