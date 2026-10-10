import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { colors, common, fonts } from "@/theme";
import { CATEGORY_LABEL } from "@/constants/poll-categories";
import { ME } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import type { DemoPost } from "../types";

export function PollCard({ post }: { post: DemoPost }) {
  const { votes, vote } = useDemoPolls();
  const picked = votes[post.id];
  const user = getUser(post.user);
  const mine = post.user === ME;
  const closed = post.timeLeft === "bitti";
  const revealed = !!picked || mine || closed;
  const results = demoResults(post, picked);
  return (
    <View style={common.card}>
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
            <Text style={{ fontFamily: fonts.bold }}>
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
        <View style={styles.category}>
          <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
            {CATEGORY_LABEL[post.category]}
          </Text>
        </View>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 23, lineHeight: 28 }}>
        {post.question}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {results.options.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={`Seçenek ${option.label}${revealed ? `, yüzde ${option.percent}` : ""}`}
            accessibilityState={{
              selected: picked === option.label,
              disabled: revealed,
            }}
            disabled={revealed}
            onPress={() => vote(post.id, option.label)}
            style={[
              styles.option,
              {
                borderColor:
                  picked === option.label ? colors.accent : "transparent",
              },
            ]}
          >
            <PreviewImage uri={option.image} tone={option.tone} />
            {!option.image && (
              <Text
                style={{ fontSize: 12, color: colors.photoText, marginTop: 65 }}
              >
                {post.photoLabel}
              </Text>
            )}
            <View style={styles.badge}>
              <Text
                style={{ fontFamily: fonts.extraBold, color: colors.onAccent }}
              >
                {option.label}
              </Text>
            </View>
            {revealed ? (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.resultFill,
                    {
                      height: `${option.percent}%`,
                      backgroundColor:
                        picked === option.label
                          ? "rgba(208,10,38,0.88)"
                          : "rgba(17,17,17,0.12)",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.percent,
                    {
                      color:
                        picked === option.label ? colors.onAccent : colors.text,
                    },
                  ]}
                >
                  %{option.percent}
                </Text>
                {picked === option.label && (
                  <View style={styles.mine}>
                    <Text style={{ fontSize: 11, fontFamily: fonts.bold }}>
                      Senin seçimin
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.products}>
                <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
                  {option.productCount} ürün
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      {picked ? (
        <View style={[common.row, styles.accepted]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          <Text style={{ fontFamily: fonts.bold }}>Tercihin kaydedildi</Text>
        </View>
      ) : (
        <Text
          style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}
        >
          {mine
            ? "Kendi paylaşımına oy veremezsin"
            : closed
              ? "Oylama sona erdi"
              : "Seçmek için kombine dokun"}
        </Text>
      )}
      {revealed && (
        <View style={common.spread}>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {results.total} oy · {closed ? "Sonuç" : "Anlık sonuç"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Demo önizleme
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.avatar,
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    backgroundColor: "#E5E4DF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  option: {
    flex: 1,
    height: 285,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  products: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "white",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultFill: { position: "absolute", bottom: 0, left: 0, right: 0 },
  percent: {
    position: "absolute",
    bottom: 8,
    left: 10,
    fontSize: 34,
    fontFamily: fonts.extraBold,
  },
  mine: {
    position: "absolute",
    top: 50,
    left: 8,
    right: 8,
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 5,
  },
  accepted: { backgroundColor: "#FBE7EB", padding: 12, borderRadius: 14 },
});
