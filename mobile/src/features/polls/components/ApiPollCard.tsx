import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ApiImage } from "@/components/media/ApiImage";
import { PollReasons } from "./PollReasons";
import { openUser } from "@/features/people/api/social";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { brand, colors, common, fonts, serif } from "@/theme";
import type { ApiPoll, PollResults, ProductTag } from "../api/types";

export function ApiPollCard({
  initial,
  onSkip,
  detail = false,
}: {
  initial: ApiPoll;
  onSkip?: () => void;
  detail?: boolean;
}) {
  const { client } = useAuth();
  const [poll, setPoll] = useState(initial);
  const [results, setResults] = useState<PollResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [clockOffset] = useState(
    () => Date.now() - Date.parse(initial.serverNow),
  );
  const locked = useRef(false);
  const alive = useRef(true);
  const [deadline, setDeadline] = useState(
    () => Date.now() + initial.remainingSeconds * 1000,
  );
  const expired = poll.effectiveStatus !== "OPEN" || now >= deadline;
  useEffect(() => {
    alive.current = true;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, []);
  // Sunucu sonucu ayrı uçtan gelir; oy öncesi yüzde veya demografi üretilmez.
  useEffect(() => {
    if (!poll.canViewResults) return;
    let cancelled = false;
    void client
      .request<PollResults>(`/polls/${poll.id}/results`)
      .then((row) => {
        if (!cancelled) setResults(row);
      })
      .catch((error) => {
        if (!cancelled) {
          setError(errorMessage(error));
          if (error instanceof ApiError && error.status === 404)
            setUnavailable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, poll.id, poll.canViewResults, poll.version]);

  async function reload() {
    const next = await client.request<ApiPoll>(`/polls/${poll.id}`);
    if (alive.current) {
      setDeadline(next.closesAt ? Date.parse(next.closesAt) + clockOffset : 0);
      setPoll((previous) => ({ ...previous, ...next }));
    }
  }
  async function action(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (error) {
      if (alive.current) {
        setError(errorMessage(error));
        if (error instanceof ApiError && error.status === 404)
          setUnavailable(true);
      }
      if (error instanceof ApiError && [404, 409].includes(error.status)) {
        try {
          await reload();
        } catch {
          /* Erişim kalktıysa hata görünür, geç eylemi kalır. */
        }
      }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const vote = (optionId: string) =>
    action(async () => {
      const receipt = await client.request<{ optionId: string }>(
        `/polls/${poll.id}/vote`,
        { method: "PUT", body: JSON.stringify({ optionId }) },
      );
      // Makbuz başarılıysa tercih sabitlenir; sonuç okuması ayrıca yeniden denenebilir.
      if (alive.current)
        setPoll((row) => ({
          ...row,
          myOptionId: receipt.optionId,
          canVote: false,
          canViewResults: true,
        }));
      await reload();
    });
  const save = () =>
    action(async () => {
      const receipt = await client.request<{ isSaved: boolean }>(
        `/polls/${poll.id}/save`,
        { method: poll.isSaved ? "DELETE" : "PUT" },
      );
      if (alive.current)
        setPoll((row) => ({ ...row, isSaved: receipt.isSaved }));
    });
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const time = expired
    ? "Sona erdi"
    : remaining < 60
      ? `${remaining} sn kaldı`
      : `${Math.ceil(remaining / 60)} dk kaldı`;
  if (unavailable)
    return (
      <View style={styles.card}>
        <EmptyState
          title="Paylaşım artık görünmüyor"
          message="Kaldırılmış veya erişim izni değişmiş olabilir."
        />
        {onSkip && <CardAction onPress={onSkip}>Sıradaki</CardAction>}
      </View>
    );
  return (
    <View style={styles.card}>
      <View style={common.spread}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${poll.author.username} profilini aç`}
          onPress={() => openUser(poll.author)}
          style={[common.row, { flex: 1 }]}
        >
          <View style={styles.avatar}>
            {poll.author.avatarPath ? (
              <ApiImage path={poll.author.avatarPath} />
            ) : (
              <Text style={{ fontFamily: fonts.bold }}>
                {poll.author.displayName.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold }}>
              {poll.author.username}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {poll.occasion ?? "Kombin"} · {time}
            </Text>
          </View>
        </Pressable>
        {(results || poll.totalVotes !== undefined) && (
          <Text>{results?.totalVotes ?? poll.totalVotes} oy</Text>
        )}
      </View>
      <Text style={styles.question}>
        {poll.question} <Text style={{ color: brand.accent }}>♡</Text>
      </Text>
      <View style={styles.options}>
        {poll.options.map((option) => {
          const result = results?.options.find((row) => row.id === option.id);
          const selected = poll.myOptionId === option.id;
          const enabled = poll.canVote && !expired && !busy;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Seçenek ${option.label}${result ? `, yüzde ${result.percentage}` : ""}`}
              accessibilityState={{ selected, disabled: !enabled }}
              disabled={!enabled}
              onPress={() => void vote(option.id)}
              style={[
                styles.option,
                { borderColor: selected ? brand.accent : "transparent" },
              ]}
            >
              <ApiImage path={option.media.displayPath} />
              <View style={styles.badge}>
                <Text style={{ fontFamily: fonts.bold }}>{option.label}</Text>
              </View>
              {result && (
                <Text style={styles.percentage}>%{result.percentage}</Text>
              )}
              {selected && (
                <View style={styles.choice}>
                  <Text style={{ fontSize: 11 }}>Senin seçimin</Text>
                </View>
              )}
              {!result && !!option.products.length && (
                <View style={styles.choiceBottom}>
                  <Text style={{ fontSize: 12 }}>
                    {option.products.length} ürün
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {busy && <ActivityIndicator color={brand.accent} />}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.accent }}>
          {error}
        </Text>
      )}
      <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>
        {poll.myOptionId
          ? "Tercihin kaydedildi"
          : poll.isOwner
            ? "Kendi paylaşımına oy veremezsin"
            : expired
              ? "Oylama sona erdi"
              : "Seçmek için kombine dokun"}
      </Text>
      <View style={common.row}>
        {onSkip && (
          <CardAction disabled={busy} onPress={onSkip}>
            Geç →
          </CardAction>
        )}
        <CardAction disabled={busy} onPress={() => void save()}>
          {poll.isSaved ? "Kaydedildi ✓" : "Kaydet"}
        </CardAction>
        <CardAction
          onPress={() =>
            router.push({
              pathname: "/comments/[pollId]",
              params: { pollId: poll.id },
            })
          }
        >
          Yorumlar
          {poll.commentCount !== undefined ? ` · ${poll.commentCount}` : ""}
        </CardAction>
      </View>
      {!detail && poll.canViewResults && (
        <CardAction
          onPress={() =>
            router.push({ pathname: "/polls/[id]", params: { id: poll.id } })
          }
        >
          Sonuç detayları
        </CardAction>
      )}
      {detail && (
        <>
          {results && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold }}>
                {results.isFinal ? "Kesin sonuç" : "Anlık sonuç"} ·{" "}
                {results.totalVotes} oy
              </Text>
              {results.options.map((row) => (
                <Text key={row.id}>
                  {row.label}: {row.votes} oy · %{row.percentage}
                </Text>
              ))}
            </View>
          )}
          {poll.canViewResults && (
            <PollReasons pollId={poll.id} canChoose={!!poll.myOptionId} />
          )}
          <CardAction disabled={busy} onPress={() => void action(reload)}>
            Sonuçları yenile
          </CardAction>
        </>
      )}
      {!!poll.options.some((option) => option.products.length) && (
        <CardAction onPress={() => setProductsOpen(true)}>
          Kombin detaylarını gör ↑
        </CardAction>
      )}
      <Modal
        visible={productsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProductsOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={common.spread}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20 }}>
                Kombindeki parçalar
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                onPress={() => setProductsOpen(false)}
              >
                <Ionicons name="close" size={28} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              {poll.options.map((option) => (
                <View key={option.id} style={{ gap: 10 }}>
                  <Text style={{ fontFamily: fonts.bold }}>
                    {option.label} Kombini
                  </Text>
                  {option.products.length ? (
                    option.products.map((product) => (
                      <ProductRow key={product.id} product={product} />
                    ))
                  ) : (
                    <Text>Etiketlenen ürün yok.</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <Button
              title="Kapat"
              variant="outline"
              onPress={() => setProductsOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProductRow({ product }: { product: ProductTag }) {
  const [error, setError] = useState(false);
  const price =
    product.priceMinor === null
      ? "Fiyat belirtilmemiş"
      : new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: product.currency,
        }).format(product.priceMinor / 100);
  async function open() {
    try {
      if (!/^https?:\/\//i.test(product.externalUrl)) throw new Error();
      await Linking.openURL(product.externalUrl);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void open()}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: brand.chip,
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold }}>{product.title} ↗</Text>
      <Text style={{ color: colors.muted }}>
        {[product.brand, price].filter(Boolean).join(" · ")}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        {product.source === "CATALOG"
          ? "Katalogdan seçildi · Yayın anındaki bilgiler"
          : "Paylaşan kişinin ürün bilgisi"}
      </Text>
      {error && (
        <Text style={{ color: colors.accent }}>
          Bağlantı açılamadı. Tekrar dene.
        </Text>
      )}
    </Pressable>
  );
}
export function CardAction({
  children,
  onPress,
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 46,
        justifyContent: "center",
        alignItems: "center",
        padding: 10,
        borderRadius: 24,
        backgroundColor: brand.card,
        borderWidth: 1,
        borderColor: brand.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold }}>{children}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 28,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.line,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: brand.accentSoft,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  question: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    width: "48.5%",
    aspectRatio: 9 / 16,
    borderWidth: 3,
    borderRadius: 20,
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: brand.card,
    borderRadius: 20,
    padding: 10,
  },
  choice: {
    position: "absolute",
    top: 12,
    right: 6,
    backgroundColor: brand.card,
    borderRadius: 14,
    padding: 6,
  },
  choiceBottom: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: brand.card,
    borderRadius: 14,
    padding: 6,
  },
  percentage: {
    position: "absolute",
    bottom: 8,
    left: 8,
    fontSize: 34,
    color: "white",
    fontFamily: fonts.extraBold,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    padding: 24,
    paddingBottom: 40,
    backgroundColor: brand.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 20,
  },
});
