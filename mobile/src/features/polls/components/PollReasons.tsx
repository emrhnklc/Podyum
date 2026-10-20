import { useRef, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { PillChip } from "@/components/ui/PillChip";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";

const labels = {
  COLOR_HARMONY: "Renk uyumu",
  MORE_STYLISH: "Daha şık",
  MORE_COMFORTABLE: "Daha rahat",
  FITS_OCCASION: "Ortama uygun",
  BETTER_FIT: "Daha iyi duruyor",
};
type Reason = keyof typeof labels;
type Reasons = {
  myReason: Reason | null;
  options: {
    id: string;
    label: string;
    reasons: { code: Reason; count: number }[];
  }[];
};

export function PollReasons({
  pollId,
  canChoose,
}: {
  pollId: string;
  canChoose: boolean;
}) {
  const { client } = useAuth();
  const query = useApiQuery<Reasons>(`/polls/${pollId}/reasons`);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(reason: Reason) {
    if (lock.current || !query.data) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const clear = query.data.myReason === reason;
      await client.request(`/polls/${pollId}/reason`, {
        method: clear ? "DELETE" : "PUT",
        ...(clear ? {} : { body: JSON.stringify({ reason }) }),
      });
      await query.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <ApiStatus
        loading={query.loading || busy}
        error={error ?? query.error}
        retry={query.refresh}
      />
      {canChoose && query.data && (
        <>
          <Text>Neden bu kombini seçtin? (İsteğe bağlı)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(labels) as Reason[]).map((reason) => (
              <PillChip
                key={reason}
                label={labels[reason]}
                active={query.data?.myReason === reason}
                onPress={() => void choose(reason)}
              />
            ))}
          </View>
        </>
      )}
      {query.data?.options.map((option) => {
        const selected = option.reasons.filter((reason) => reason.count > 0);
        return selected.length ? (
          <Text key={option.id}>
            {option.label}:{" "}
            {selected
              .map((reason) => `${labels[reason.code]} · ${reason.count}`)
              .join(" / ")}
          </Text>
        ) : null;
      })}
    </View>
  );
}
