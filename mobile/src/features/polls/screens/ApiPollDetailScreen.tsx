import { useRef, useState } from "react";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useApiQuery } from "@/hooks/use-api-query";
import { confirmAction } from "@/lib/confirm";
import { errorMessage } from "@/lib/api/client";
import type { ApiPoll } from "../api/types";
import { ApiPollCard } from "../components/ApiPollCard";

export function ApiPollDetailScreen({ id }: { id: string }) {
  const { client, me } = useAuth();
  const query = useApiQuery<ApiPoll>(`/polls/${id}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const poll = query.data;
  async function manage(
    action: "publish" | "cancel" | "delete" | "comment-settings",
  ) {
    if (lock.current || !poll) return;
    lock.current = true;
    try {
      if (
        ["delete", "cancel"].includes(action) &&
        !(await confirmAction(
          action === "delete" ? "Taslağı sil" : "Oylamayı iptal et",
          "Bu işlem geri alınamaz. Devam etmek istiyor musun?",
        ))
      )
        return;
      setBusy(true);
      setError(null);
      const signature = `${id}:${action}:${poll.version}`;
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, key: Crypto.randomUUID() };
      await client.request(
        action === "delete"
          ? `/polls/${id}?expectedVersion=${poll.version}`
          : `/polls/${id}/${action}`,
        {
          method:
            action === "delete"
              ? "DELETE"
              : action === "comment-settings"
                ? "PATCH"
                : "POST",
          headers: { "Idempotency-Key": attempt.current.key },
          ...(action === "delete"
            ? {}
            : {
                body: JSON.stringify({
                  expectedVersion: poll.version,
                  ...(action === "comment-settings"
                    ? { commentsEnabled: !poll.commentsEnabled }
                    : {}),
                }),
              }),
        },
      );
      attempt.current = null;
      if (action === "delete") router.replace("/profil");
      else await query.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      await query.refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <BackButton />
      {!me ? (
        <>
          <Text>Bu paylaşımı görmek için giriş yap.</Text>
          <Button
            title="Giriş yap"
            onPress={() => router.push("/auth/login")}
          />
        </>
      ) : (
        <>
          <ApiStatus
            loading={query.loading || busy}
            error={error ?? query.error}
            retry={query.refresh}
          />
          {poll && (
            <>
              <ApiPollCard
                key={`${poll.id}:${poll.version}`}
                initial={poll}
                detail
              />
              {poll.isOwner ? (
                <>
                  {["OPEN", "CLOSED"].includes(poll.effectiveStatus) && (
                    <Button
                      title={
                        poll.commentsEnabled
                          ? "Yeni yorumları kapat"
                          : "Yorumlara izin ver"
                      }
                      disabled={busy}
                      variant="outline"
                      onPress={() => void manage("comment-settings")}
                    />
                  )}
                  {poll.canEditDraft && (
                    <>
                      <Button
                        title="Taslağı yayınla"
                        disabled={
                          busy ||
                          poll.options.length < 2 ||
                          !poll.question.trim()
                        }
                        onPress={() => void manage("publish")}
                      />
                      <Button
                        title="Taslağı sil"
                        variant="outline"
                        disabled={busy}
                        onPress={() => void manage("delete")}
                      />
                    </>
                  )}
                  {poll.canCancel && (
                    <Button
                      title="Oylamayı iptal et"
                      variant="outline"
                      disabled={busy}
                      onPress={() => void manage("cancel")}
                    />
                  )}
                </>
              ) : (
                <Button
                  title="Paylaşımı şikâyet et"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/reports/new",
                      params: { type: "POLL", id },
                    })
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
