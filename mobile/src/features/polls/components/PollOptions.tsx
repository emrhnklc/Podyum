import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { PreviewImage } from "@/components/media/PreviewImage";
import { colors, fonts } from "@/theme";
import { ME } from "@/constants/demo";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import type { DemoPost } from "../types";

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
              { borderColor: selected ? colors.accent : "transparent" },
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
                        ? "rgba(208,10,38,0.82)"
                        : "rgba(17,17,17,0.45)",
                    },
                  ]}
                />
                <Text style={styles.percent}>%{option.percent}</Text>
              </>
            )}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{option.label}</Text>
            </View>
            {selected && (
              <View style={styles.mine}>
                <Text style={styles.mineText}>Senin seçimin</Text>
              </View>
            )}
            {!revealed && (
              <View style={styles.products}>
                <Text style={styles.productsText}>
                  {option.productCount} ürün
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
  row: { flexDirection: "row", gap: 4 },
  option: {
    flex: 1,
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
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
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
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
