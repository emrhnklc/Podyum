import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { brand, colors, fonts } from "@/theme";
import { ME } from "@/constants/demo";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import type { DemoPost } from "../types";

const BADGE_TONE = { A: "rgba(183,118,74,0.9)", B: "rgba(107,65,40,0.85)" };

// Yan yana iki seçenek. Dokununca tercih kaydedilir; oylama açıkken diğerine
// dokunarak tercih değiştirilebilir. Kendi paylaşımında ve kapanmış oylamada
// yalnızca sonuç görünür.
export function PollOptions({
  post,
  style,
}: {
  post: DemoPost;
  style?: StyleProp<ViewStyle>;
}) {
  const { votes, vote } = useDemoPolls();
  const picked = votes[post.id];
  const mine = post.user === ME;
  const closed = post.timeLeft === "bitti";
  const canVote = !mine && !closed;
  const revealed = !!picked || !canVote;
  const results = demoResults(post, picked);
  return (
    <View style={[styles.row, style]}>
      {results.options.map((option) => {
        const selected = picked === option.label;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={`Seçenek ${option.label}${revealed ? `, yüzde ${option.percent}` : ""}`}
            accessibilityHint={
              canVote && picked && !selected
                ? "Tercihini bu seçeneğe değiştirir"
                : undefined
            }
            accessibilityState={{ selected, disabled: !canVote }}
            disabled={!canVote}
            onPress={() => vote(post.id, option.label)}
            style={[
              styles.option,
              { borderColor: selected ? brand.accent : "transparent" },
            ]}
          >
            <PreviewImage uri={option.image} tone={option.tone} />
            {!option.image && (
              <Text style={styles.placeholderLabel}>{post.photoLabel}</Text>
            )}
            {revealed && (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.resultFill,
                    {
                      height: `${option.percent}%`,
                      backgroundColor: selected
                        ? "rgba(183,118,74,0.85)"
                        : "rgba(17,17,17,0.45)",
                    },
                  ]}
                />
                <Text style={styles.percent}>%{option.percent}</Text>
              </>
            )}
            <View
              style={[styles.badge, { backgroundColor: BADGE_TONE[option.label] }]}
            >
              <Text style={styles.badgeText}>{option.label}</Text>
            </View>
            {selected && (
              <View style={styles.mine}>
                <Text style={styles.mineText}>Senin seçimin</Text>
              </View>
            )}
            {!revealed && option.products.length > 0 && (
              <View style={styles.products}>
                <Text style={styles.productsText}>
                  {option.products.length} ürün
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  // Kombin görselleri dikey 9:16 oranındadır.
  option: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderLabel: { fontSize: 12, color: colors.photoText, marginTop: 65 },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    height: 34,
    width: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { fontFamily: fonts.extraBold, color: colors.onAccent },
  mine: {
    position: "absolute",
    top: 12,
    right: 10,
    backgroundColor: colors.background,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mineText: { fontSize: 11, fontFamily: fonts.bold },
  products: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: brand.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  productsText: { fontSize: 12, fontFamily: fonts.semibold },
  resultFill: { position: "absolute", bottom: 0, left: 0, right: 0 },
  percent: {
    position: "absolute",
    bottom: 8,
    left: 12,
    fontSize: 34,
    fontFamily: fonts.extraBold,
    color: colors.onAccent,
  },
});
