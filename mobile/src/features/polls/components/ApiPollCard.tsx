import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { ApiImage } from "@/components/media/ApiImage";
import { PollReasons } from "./PollReasons";
import { openUser } from "@/features/people/api/social";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { brand, colors, common, fonts } from "@/theme";
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
  // Beğeni tercih oyundan ayrıdır; sayaç sunucu makbuzundan gelir.
  const like = () =>
    action(async () => {
      const receipt = await client.request<{
        isLiked: boolean;
        likeCount: number;
      }>(`/polls/${poll.id}/like`, {
        method: poll.isLiked ? "DELETE" : "PUT",
      });
      if (alive.current)
        setPoll((row) => ({
          ...row,
          isLiked: receipt.isLiked,
          likeCount: receipt.likeCount,
        }));
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
  const soon = !expired && remaining < 600;
  const sections = poll.options.filter((option) => option.products.length);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={common.spread}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${poll.author.username} profilini aç`}
            onPress={() => openUser(poll.author)}
            style={[common.row, { flex: 1, gap: 8 }]}
          >
            <View style={styles.avatar}>
              {poll.author.avatarPath ? (
                <ApiImage path={poll.author.avatarPath} />
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                  {poll.author.displayName.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 14, flexShrink: 1 }}
            >
              {poll.author.username}
            </Text>
            <Text
              style={{ fontSize: 12, color: soon ? colors.blue : colors.muted }}
            >
              {time}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {poll.occasion ?? "Kombin"}
          </Text>
        </View>
        <Text numberOfLines={detail ? undefined : 2} style={styles.question}>
          {poll.question}
        </Text>
      </View>
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
                poll.options.length > 2 && styles.optionHalf,
                { borderColor: selected ? brand.accent : "transparent" },
              ]}
            >
              <ApiImage path={option.media.displayPath} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{option.label}</Text>
              </View>
              {result && (
                <Text style={styles.percentage}>%{result.percentage}</Text>
              )}
              {selected && (
                <View style={styles.choice}>
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold }}>
                    Senin seçimin
                  </Text>
                </View>
              )}
              {!result && !!option.products.length && (
                <View style={styles.choiceBottom}>
                  <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
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
        <Text
          accessibilityRole="alert"
          style={{ color: colors.accent, paddingHorizontal: 16 }}
        >
          {error}
        </Text>
      )}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {(results || poll.totalVotes !== undefined) && (
            <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
              {results?.totalVotes ?? poll.totalVotes} oy
            </Text>
          )}
          <Text numberOfLines={1} style={styles.hint}>
            {poll.myOptionId
              ? "Tercihin kaydedildi"
              : poll.isOwner
                ? "Kendi paylaşımına oy veremezsin"
                : expired
                  ? "Oylama sona erdi"
                  : "Seçmek için kombine dokun"}
          </Text>
        </View>
        <IconAction
          label={`${poll.isLiked ? "Beğeniyi kaldır" : "Beğen"}${poll.likeCount !== undefined ? `, ${poll.likeCount} beğeni` : ""}`}
          icon={poll.isLiked ? "heart" : "heart-outline"}
          color={poll.isLiked ? colors.accent : colors.text}
          count={poll.likeCount}
          disabled={busy}
          onPress={() => void like()}
        />
        <IconAction
          label={poll.isSaved ? "Kaydedilenlerden çıkar" : "Kaydet"}
          icon={poll.isSaved ? "bookmark" : "bookmark-outline"}
          disabled={busy}
          onPress={() => void save()}
        />
        <IconAction
          label={`Yorumlar${poll.commentCount !== undefined ? `, ${poll.commentCount}` : ""}`}
          icon="chatbubble-outline"
          count={poll.commentCount}
          onPress={() =>
            router.push({
              pathname: "/comments/[pollId]",
              params: { pollId: poll.id },
            })
          }
        />
        {!detail && poll.canViewResults && (
          <IconAction
            label="Sonuç detayları"
            icon="stats-chart-outline"
            onPress={() =>
              router.push({ pathname: "/polls/[id]", params: { id: poll.id } })
            }
          />
        )}
        {onSkip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={poll.myOptionId ? "Sıradaki oylama" : "Geç"}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onSkip}
            style={({ pressed }) => [
              styles.next,
              { opacity: busy ? 0.5 : pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="arrow-forward" size={22} color={colors.onAccent} />
          </Pressable>
        )}
      </View>
      {detail && (
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
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
        </View>
      )}
      {!!sections.length && (
        <View style={styles.products}>
          {sections.map((option) => (
            <View key={option.id} style={{ gap: 8 }}>
              <View style={[common.row, { gap: 8 }]}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{option.label}</Text>
                </View>
                <Text style={styles.sectionTitle}>Kombindeki parçalar</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {option.products.length} ürün
                </Text>
              </View>
              {option.products.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function IconAction({
  label,
  icon,
  onPress,
  count,
  color = colors.text,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  count?: number;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        { opacity: disabled ? 0.4 : pressed ? 0.5 : 1 },
      ]}
    >
      <Ionicons name={icon} size={23} color={color} />
      {!!count && <Text style={styles.iconCount}>{count}</Text>}
    </Pressable>
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
  // Bağlantı ve "Üzerimde dene" yan yana iki ayrı düğmedir; iç içe düğme web'de geçersiz.
  return (
    <View style={styles.productRow}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${product.title}, ${price}. Ürünü gör`}
        onPress={() => void open()}
        style={({ pressed }) => [styles.productLink, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={styles.thumb}>
          <Ionicons name="shirt-outline" size={26} color={colors.photoText} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={styles.productName}>
            {product.title}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {[product.brand, price].filter(Boolean).join(" · ")}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {product.source === "CATALOG"
              ? "Katalogdan · yayın anındaki bilgiler"
              : "Paylaşan kişinin ürün bilgisi"}
          </Text>
          <View style={[common.row, { gap: 4 }]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
              Ürünü gör
            </Text>
            <Ionicons name="open-outline" size={13} color={colors.text} />
          </View>
          {error && (
            <Text style={{ color: colors.accent, fontSize: 12 }}>
              Bağlantı açılamadı. Tekrar dene.
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.title} ürününü üzerimde dene, Plus`}
        onPress={() =>
          router.push({
            pathname: "/try-on",
            params: {
              title: product.title,
              ...(product.brand ? { brand: product.brand } : {}),
              ...(product.priceMinor !== null ? { price } : {}),
              url: product.externalUrl,
            },
          })
        }
        style={({ pressed }) => [styles.tryOn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="sparkles" size={16} color={colors.onAccent} />
        <Text style={styles.tryOnText}>Dene</Text>
        <Text style={styles.tryOnPlus}>PLUS</Text>
      </Pressable>
    </View>
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
  // Çerçevesiz kart: fotoğraflar ekranın genişliğini kullanır.
  card: { gap: 10, paddingBottom: 12 },
  header: { paddingHorizontal: 16, gap: 6 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.avatar,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  question: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginHorizontal: 6,
  },
  // Kombin görselleri dikey 9:16 oranındadır.
  option: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderWidth: 3,
    borderRadius: 20,
    overflow: "hidden",
  },
  optionHalf: { flexBasis: "48%" },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { fontFamily: fonts.extraBold, color: colors.onAccent },
  choice: {
    position: "absolute",
    top: 12,
    right: 10,
    backgroundColor: colors.background,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  choiceBottom: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  percentage: {
    position: "absolute",
    bottom: 8,
    left: 12,
    fontSize: 34,
    color: colors.onAccent,
    fontFamily: fonts.extraBold,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 16,
    paddingRight: 12,
  },
  hint: { fontSize: 12, color: colors.muted },
  icon: {
    minWidth: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconCount: { fontSize: 12, fontFamily: fonts.semibold },
  next: {
    width: 48,
    height: 48,
    marginLeft: 4,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  products: { paddingHorizontal: 16, paddingTop: 6, gap: 18 },
  sectionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.onAccent,
  },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  productLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  tryOn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    width: 58,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.text,
  },
  tryOnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent },
  tryOnPlus: { fontFamily: fonts.extraBold, fontSize: 9, color: colors.accentSoft },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
});
