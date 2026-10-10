import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewImage } from "@/components/media/PreviewImage";
import { colors, common, fonts } from "@/theme";
import { ME } from "@/constants/demo";
import { useProfileUser } from "../hooks/use-profile-edits";
import { posts, postsOf } from "@/features/polls/data/demo-polls";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import { usePreviewMessage } from "@/hooks/use-preview-message";

export function ProfileScreen({ username = ME }: { username?: string }) {
  const [tab, setTab] = useState<"POSTS" | "SAVED">("POSTS");
  const { saved } = useDemoPolls();
  const message = usePreviewMessage();
  // Kendi profilinde Profili Düzenle'de kaydedilen alanlar da görünür.
  const { user, handle } = useProfileUser(username);
  const mine = username === ME;
  if (!user)
    return (
      <Screen>
        <EmptyState
          title="Profil bulunamadı"
          message="Bu kullanıcı demo listesinde yok."
        />
        <Button title="Keşfet'e dön" onPress={() => router.replace("/")} />
      </Screen>
    );
  const rows =
    tab === "SAVED" && mine
      ? posts.filter((post) => saved.includes(post.id))
      : postsOf(username);
  return (
    <Screen>
      <View style={mine ? common.spread : [common.row, { gap: 0 }]}>
        {!mine && <BackButton />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 21 }}>{handle}</Text>
        {mine && (
          <View style={[common.row, { gap: 16 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hesap girişi"
              onPress={() => router.push("/auth")}
            >
              <Text style={{ color: colors.accent }}>Giriş</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ayarlar"
              hitSlop={8}
              onPress={() => router.push("/settings")}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={[common.row, { paddingVertical: 12, gap: 18 }]}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: mine ? colors.accent : colors.avatar,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {user.avatar ? (
            <PreviewImage uri={user.avatar} tone={colors.avatar} />
          ) : (
            <Text
              style={{
                fontFamily: fonts.extraBold,
                fontSize: 27,
                color: mine ? colors.onAccent : colors.text,
              }}
            >
              {user.initials}
            </Text>
          )}
        </View>
        <View style={[common.spread, { flex: 1 }]}>
          {[
            { label: "Paylaşım", value: user.counts.polls },
            { label: "Arkadaş", value: user.counts.friends },
            { label: "Yıldız", value: user.counts.stars },
          ].map((count) => (
            <Pressable
              key={count.label}
              disabled={count.label !== "Arkadaş" || !mine}
              onPress={() => router.push("/friends")}
              style={{ alignItems: "center", gap: 4 }}
            >
              <Text
                style={{
                  fontFamily: fonts.extraBold,
                  fontSize: 22,
                  color: count.label === "Yıldız" ? colors.accent : colors.text,
                }}
              >
                {count.value.toLocaleString("tr-TR")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {count.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22 }}>
          {user.displayName}
        </Text>
        {user.bio && <Text style={common.subtitle}>{user.bio}</Text>}
        <View style={[common.row, { flexWrap: "wrap", gap: 6 }]}>
          {user.styles.map((style) => (
            <View
              key={style}
              style={{
                backgroundColor: colors.chip,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 18,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                {style}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title={mine ? "Profili düzenle" : "Arkadaş ekle"}
          variant="outline"
          onPress={() =>
            mine
              ? router.push("/profile/edit")
              : message("Arkadaşlık işlemleri henüz bu önizlemede açık değil.")
          }
          style={{ flex: 1 }}
        />
        <Button
          title={mine ? "Arkadaşlar" : "Daha fazla"}
          variant="dark"
          onPress={() =>
            mine
              ? router.push("/friends")
              : message(
                  "Şikâyet ve engelleme seçenekleri sıradaki adımlarda açılacak.",
                )
          }
          style={{ flex: 1 }}
        />
      </View>
      <ChipRow
        options={
          mine
            ? [
                { value: "POSTS", label: "Paylaşımlar" },
                { value: "SAVED", label: "Kaydedilenler" },
              ]
            : [{ value: "POSTS", label: "Paylaşımlar" }]
        }
        value={tab}
        onChange={setTab}
      />
      {rows.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {rows.map((post) => {
            const leading =
              post.options[0].percent >= post.options[1].percent
                ? post.options[0]
                : post.options[1];
            return (
              <Pressable
                key={post.id}
                accessibilityRole="button"
                accessibilityLabel={post.question}
                onPress={() =>
                  router.push({
                    pathname: "/polls/[id]",
                    params: { id: post.id },
                  })
                }
                style={{
                  width: "31.5%",
                  aspectRatio: 9 / 16,
                  borderRadius: 12,
                  overflow: "hidden",
                  justifyContent: "flex-end",
                }}
              >
                <PreviewImage uri={leading.image} tone={leading.tone} />
                <View
                  style={{ backgroundColor: "rgba(17,17,17,0.75)", padding: 7 }}
                >
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 11, color: colors.onAccent }}
                  >
                    {post.question}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title={
            tab === "SAVED" ? "Henüz kaydedilen yok" : "Henüz paylaşım yok"
          }
          message={
            tab === "SAVED"
              ? "Keşfet'te kaydettiğin kombinler burada görünür."
              : "İlk kombinini paylaştığında burada görünür."
          }
        />
      )}
    </Screen>
  );
}
