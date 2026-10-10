import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/ui/Text";
import { colors, common, fonts } from "@/theme";
import { CATEGORY_LABEL } from "@/constants/poll-categories";
import { ME } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import { PollOptions } from "./PollOptions";
import type { DemoPost } from "../types";

// Detay ekranındaki kart: yazar, soru, seçenekler ve kısa durum satırı.
export function PollCard({ post }: { post: DemoPost }) {
  const { votes } = useDemoPolls();
  const picked = votes[post.id];
  const user = getUser(post.user);
  const mine = post.user === ME;
  const closed = post.timeLeft === "bitti";
  const revealed = !!picked || mine || closed;
  const results = demoResults(post, picked);
  return (
    <View style={{ gap: 12 }}>
      <View style={common.spread}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.user} profilini aç`}
          onPress={() =>
            router.push({
              pathname: "/u/[username]",
              params: { username: post.user },
            })
          }
          style={[common.row, { flex: 1 }]}
        >
          <View style={styles.avatar}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
              {user?.initials ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold }}>{post.user}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {post.context} ·{" "}
              <Text
                style={{
                  fontSize: 12,
                  color: post.urgent ? colors.blue : colors.muted,
                }}
              >
                {closed ? "Sona erdi" : `${post.timeLeft} kaldı`}
              </Text>
            </Text>
          </View>
        </Pressable>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {CATEGORY_LABEL[post.category]}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 26 }}>
        {post.question}
      </Text>
      <PollOptions post={post} style={{ marginHorizontal: -8 }} />
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
        {mine
          ? "Kendi paylaşımına oy veremezsin"
          : closed
            ? "Oylama sona erdi"
            : picked
              ? "Tercihin kaydedildi. Değiştirmek için diğerine dokun."
              : "Seçmek için kombine dokun"}
      </Text>
      {revealed && (
        <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
          {results.total} oy · {closed ? "Sonuç" : "Anlık sonuç"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.avatar,
    alignItems: "center",
    justifyContent: "center",
  },
});
