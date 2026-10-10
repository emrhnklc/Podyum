import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { blush, colors, common, fonts, serif } from "@/theme";
import { ME } from "@/constants/demo";
import { compactCount } from "@/lib/format";
import { getUser } from "@/features/profile/data/demo-users";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import type { DemoPost } from "../types";

const BADGE_TONE = { A: "rgba(204,92,134,0.85)", B: "rgba(160,112,160,0.85)" };

export function PollCard({
  post,
  footer,
}: {
  post: DemoPost;
  footer?: ReactNode;
}) {
  const { votes, vote } = useDemoPolls();
  const picked = votes[post.id];
  const user = getUser(post.user);
  const mine = post.user === ME;
  const closed = post.timeLeft === "bitti";
  const revealed = !!picked || mine || closed;
  const results = demoResults(post, picked);
  return (
    <View style={styles.card}>
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
            <Text style={{ fontFamily: fonts.bold, color: blush.wine }}>
              {user?.initials ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
              {post.user}
            </Text>
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
        <View style={styles.votes}>
          <Ionicons name="flame" size={16} color={blush.pink} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
            {compactCount(results.total)}{" "}
            <Text style={{ fontSize: 13, color: colors.muted }}>oy</Text>
          </Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
      </View>
      <Text style={styles.question}>
        {post.question} <Text style={styles.heart}>♡</Text>
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
                  picked === option.label ? blush.pink : "transparent",
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
            <View
              style={[styles.badge, { backgroundColor: BADGE_TONE[option.label] }]}
            >
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
                          ? "rgba(236,94,146,0.88)"
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
          <Ionicons name="checkmark-circle" size={20} color={blush.pink} />
          <Text style={{ fontFamily: fonts.bold }}>Tercihin kaydedildi</Text>
        </View>
      ) : (
        <View style={common.row}>
          <View style={styles.rule} />
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {mine
              ? "Kendi paylaşımına oy veremezsin"
              : closed
                ? "Oylama sona erdi"
                : "Seçmek için kombine dokun"}
          </Text>
          <View style={styles.rule} />
        </View>
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
      {footer}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 28,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
    gap: 14,
    shadowColor: blush.wine,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: blush.pinkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  votes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: blush.card,
    borderWidth: 1,
    borderColor: blush.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  question: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.5,
    color: colors.text,
  },
  heart: { fontSize: 26, color: blush.pink },
  rule: { flex: 1, height: 1, backgroundColor: blush.line },
  option: {
    flex: 1,
    height: 300,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  products: {
    position: "absolute",
    bottom: 12,
    left: 10,
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  accepted: { backgroundColor: blush.chip, padding: 12, borderRadius: 14 },
});
