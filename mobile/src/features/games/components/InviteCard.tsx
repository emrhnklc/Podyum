import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { brand, colors, fonts } from "@/theme";
import {
  getGame,
  rotateInvite,
  type GameInvite,
  type GameState,
} from "../api/games";

// Oda sahibinin QR daveti. Davet edilenin arkadaş olması gerekmez; yeni QR
// eskisini geçersiz kılar. Ham davet yalnız bu ekranda tutulur.
export function InviteCard({
  game,
  autoCreate,
  onChanged,
}: {
  game: GameState;
  autoCreate: boolean;
  onChanged: () => Promise<void>;
}) {
  const { client } = useAuth();
  const [invite, setInvite] = useState<GameInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const created = useRef(false);

  const lock = useRef(false);
  const create = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      setInvite(await rotateInvite(client, await getGame(client, game.id)));
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }, [client, game.id, onChanged]);
  // Oda yeni kurulduysa davet bir kez kendiliğinden hazırlanır.
  useEffect(() => {
    if (!autoCreate || created.current) return;
    created.current = true;
    void create();
  }, [autoCreate, create]);

  const inviteUrl = invite
    ? Linking.createURL("games/join", { queryParams: { token: invite.token } })
    : "";

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="qr-code-outline" size={22} color={colors.text} />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16 }}>
          Arkadaşlarını davet et
        </Text>
      </View>
      {invite ? (
        <>
          <View style={styles.qr} accessibilityLabel="Davet QR kodu">
            <QRCode
              value={inviteUrl}
              size={190}
              color={colors.text}
              backgroundColor={brand.card}
            />
          </View>
          <Text style={styles.hint}>
            QR&apos;ı okutan ya da linke dokunan kişi giriş yapıp odaya katılır;
            arkadaşın olması gerekmez.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void Share.share({
                  message: `Podyum defileme katıl: ${inviteUrl}`,
                }).catch((failure) => setError(errorMessage(failure)))
              }
              style={[styles.button, styles.primary]}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={colors.onAccent}
              />
              <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
                Linki paylaş
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yeni QR oluştur"
              disabled={busy}
              onPress={() => void create()}
              style={styles.button}
            >
              <Ionicons name="refresh" size={18} color={colors.text} />
              <Text style={{ fontFamily: fonts.semibold }}>Yenile</Text>
            </Pressable>
          </View>
        </>
      ) : busy || (autoCreate && !error) ? (
        <ActivityIndicator color={brand.accent} />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => void create()}
          style={[styles.button, styles.primary]}
        >
          <Ionicons name="qr-code-outline" size={18} color={colors.onAccent} />
          <Text style={{ fontFamily: fonts.bold, color: colors.onAccent }}>
            Davet QR&apos;ı oluştur
          </Text>
        </Pressable>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  qr: {
    alignSelf: "center",
    padding: 12,
    borderRadius: 18,
    backgroundColor: brand.card,
    borderWidth: 1,
    borderColor: brand.line,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    textAlign: "center",
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.line,
  },
  primary: { backgroundColor: brand.accent, borderColor: brand.accent },
  error: { fontSize: 13, color: brand.accentDark, textAlign: "center" },
});
