import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts, serif } from "@/theme";
import { joinByInvite, previewInvite, type GameSummary } from "../api/games";

// QR veya davet linkiyle açılır (podyum://games/join?token=...). Önce oda
// özeti gösterilir; katılım yalnız kullanıcı onaylayınca yapılır.
export function JoinRoomScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { ready, me, client } = useAuth();
  const [room, setRoom] = useState<GameSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

  useEffect(() => {
    if (!ready || !me || !valid) return;
    let alive = true;
    previewInvite(client, token)
      .then((row) => alive && setRoom(row))
      .catch(() => alive && setError("Bu davet geçersiz ya da süresi dolmuş."));
    return () => {
      alive = false;
    };
  }, [ready, me, valid, client, token]);

  async function join() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const game = await joinByInvite(client, token);
      router.replace({ pathname: "/games/[id]", params: { id: game.id } });
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Ionicons name="sparkles" size={28} color={brand.accent} />
        <Text style={styles.caption}>DEFİLE DAVETİ</Text>
        {!ready ? (
          <ActivityIndicator color={brand.accent} />
        ) : !me ? (
          <>
            <Text style={styles.text}>
              Davete katılmak için giriş yapmalısın.
            </Text>
            <Primary
              label="Giriş yap"
              onPress={() =>
                router.push({
                  pathname: "/auth/login",
                  params: valid ? { next: `/games/join?token=${token}` } : {},
                })
              }
            />
          </>
        ) : !valid || (error && !room) ? (
          <Text style={styles.text}>{error ?? "Bu davet linki geçersiz."}</Text>
        ) : !room ? (
          <ActivityIndicator color={brand.accent} />
        ) : (
          <>
            <Text style={styles.title}>Tema: {room.themeTitle}</Text>
            <Text style={styles.text}>
              {room.maxMembers ? `${room.maxMembers} kişilik oda` : "Defile"} ·{" "}
              {room.submissionSeconds / 60} dk
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Primary
              label={busy ? "Katılıyor…" : "Odaya katıl"}
              onPress={() => void join()}
            />
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/defile")}
          style={{ padding: 8 }}
        >
          <Text style={{ color: colors.muted }}>Vazgeç</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.primary}
    >
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.onAccent }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: brand.background,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 28,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  caption: {
    fontSize: 12,
    letterSpacing: 3,
    color: colors.muted,
    fontFamily: fonts.semibold,
  },
  title: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 30,
    color: colors.text,
    textAlign: "center",
  },
  text: { fontSize: 15, color: colors.muted, textAlign: "center" },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
  primary: {
    alignSelf: "stretch",
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
