import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { blush, colors, common, fonts, serif } from "@/theme";
import { ME } from "@/constants/demo";
import { compactCount } from "@/lib/format";
import { getUser } from "@/features/profile/data/demo-users";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import { PollOptions } from "./PollOptions";
import type { DemoPost } from "../types";

// Pembe oylama kartı: yazar, soru, seçenekler ve durum satırı. Keşfet eylemleri
// `footer` ile kartın içine eklenir; detay ekranı kartı footer'sız kullanır.
export function PollCard({
  post,
  footer,
}: {
  post: DemoPost;
  footer?: ReactNode;
}) {
  const { votes } = useDemoPolls();
  const picked = votes[post.id];
  const user = getUser(post.user);
  const mine = post.user === ME;
  const closed = post.timeLeft === "bitti";
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
      <PollOptions post={post} />
      {picked && !closed ? (
        <View style={[common.row, styles.accepted]}>
          <Ionicons name="checkmark-circle" size={20} color={blush.pink} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold }}>Tercihin kaydedildi</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Değiştirmek için diğerine dokun
            </Text>
          </View>
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
  accepted: { backgroundColor: blush.chip, padding: 12, borderRadius: 14 },
});
