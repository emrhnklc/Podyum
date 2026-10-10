import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { colors, common, fonts } from "@/theme";
import { CATEGORY_LABEL } from "@/constants/poll-categories";
import { getUser } from "@/features/profile/data/demo-users";
import { PollOptions } from "@/features/polls/components/PollOptions";
import { OptionProducts } from "@/features/polls/components/OptionProducts";
import {
  demoResults,
  useDemoPolls,
} from "@/features/polls/hooks/use-demo-polls";
import type { DemoPost } from "@/features/polls/types";
import { usePreviewMessage } from "@/hooks/use-preview-message";

// Keşfet'teki tek oylama: fotoğraflar ekranın çoğunu kaplar, geri kalan her şey
// tek satırlık üst bilgi ve ikonlardan ibarettir.
export function FeedPoll({
  post,
  onNext,
}: {
  post: DemoPost;
  onNext: () => void;
}) {
  const { votes, saved, toggleSave } = useDemoPolls();
  const message = usePreviewMessage();
  const picked = votes[post.id];
  const user = getUser(post.user);
  const isSaved = saved.includes(post.id);
  const results = demoResults(post, picked);
  const openDetails = () =>
    router.push({ pathname: "/polls/[id]", params: { id: post.id } });
  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
    >
      <View style={styles.header}>
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
            style={[common.row, { flex: 1, gap: 8 }]}
          >
            <View style={styles.avatar}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                {user?.initials ?? "?"}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
              {post.user}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: post.urgent ? colors.blue : colors.muted,
              }}
            >
              {post.timeLeft} kaldı
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {CATEGORY_LABEL[post.category]}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.question}>
          {post.question}
        </Text>
      </View>
      <PollOptions post={post} style={{ marginHorizontal: 6 }} />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {picked ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                {results.total} oy
              </Text>
              <Text numberOfLines={1} style={styles.hint}>
                Değiştirmek için diğerine dokun
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={styles.hint}>
              Seçmek için kombine dokun
            </Text>
          )}
        </View>
        <IconButton
          label={isSaved ? "Kaydedilenlerden çıkar" : "Kaydet"}
          icon={isSaved ? "bookmark" : "bookmark-outline"}
          onPress={() => toggleSave(post.id)}
        />
        <IconButton
          label={`${post.commentCount} yorum`}
          icon="chatbubble-outline"
          onPress={() =>
            message("Yorum ekranı API bağlantısı adımında eklenecek.")
          }
        />
        <IconButton
          label={picked ? "Sonuç detayları" : "Kombin detayları"}
          icon="stats-chart-outline"
          onPress={openDetails}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picked ? "Sıradaki oylama" : "Geç"}
          onPress={onNext}
          style={({ pressed }) => [styles.next, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="arrow-forward" size={22} color={colors.onAccent} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
        <OptionProducts post={post} />
      </View>
    </ScrollView>
  );
}

function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={23} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 6 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.avatar,
    alignItems: "center",
    justifyContent: "center",
  },
  question: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 10,
  },
  hint: { fontSize: 12, color: colors.muted },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  next: {
    width: 48,
    height: 48,
    marginLeft: 4,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
