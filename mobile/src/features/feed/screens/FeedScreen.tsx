import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { DEMO_FRIENDS, ME } from "@/constants/demo";
import { feed, postsOf } from "@/features/polls/data/demo-polls";
import { PollCard } from "@/features/polls/components/PollCard";
import { useDemoPolls } from "@/features/polls/hooks/use-demo-polls";
import { colors, common, fonts } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";

const categories = [
  { value: "ALL" as const, label: "Tümü" },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
    value: value as PollCategory,
    label,
  })),
];
export function FeedScreen() {
  const [audience, setAudience] = useState<"ALL" | "FRIENDS">("ALL");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [index, setIndex] = useState(0);
  const { votes, saved, toggleSave } = useDemoPolls();
  const message = usePreviewMessage();
  const rows = feed
    .filter((post) => category === "ALL" || post.category === category)
    .filter((post) => audience === "ALL" || DEMO_FRIENDS.includes(post.user));
  const post = rows.length ? rows[index % rows.length] : undefined;
  const myPoll = postsOf(ME)[0];
  return (
    <Screen>
      <View style={common.spread}>
        <Text style={common.title}>Podyum</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Günlük podyumu aç"
          onPress={() => router.push("/games")}
          style={[
            common.row,
            { backgroundColor: colors.chip, padding: 10, borderRadius: 20 },
          ]}
        >
          <Ionicons name="trophy-outline" size={17} color={colors.accent} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>Podyum</Text>
        </Pressable>
      </View>
      <Text style={common.subtitle}>
        Arada kaldığın kombini birlikte seçelim.
      </Text>
      <ChipRow
        options={[
          { value: "ALL", label: "Herkes" },
          { value: "FRIENDS", label: "Arkadaşlar" },
        ]}
        value={audience}
        onChange={(value) => {
          setAudience(value);
          setIndex(0);
        }}
      />
      <ChipRow
        options={categories}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setIndex(0);
        }}
      />
      {myPoll && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Senin oylamanı aç"
          onPress={() =>
            router.push({ pathname: "/polls/[id]", params: { id: myPoll.id } })
          }
          style={[
            common.spread,
            {
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.line,
            },
          ]}
        >
          <Text style={{ fontSize: 13 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
              Senin oylaman
            </Text>{" "}
            · {myPoll.timeLeft} kaldı
          </Text>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 13,
              color: colors.accent,
            }}
          >
            {myPoll.totalVotes} oy →
          </Text>
        </Pressable>
      )}
      {post ? (
        <>
          <PollCard post={post} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              title="Geç"
              variant="outline"
              onPress={() => setIndex((value) => value + 1)}
              style={{ flex: 1 }}
            />
            <Button
              title={saved.includes(post.id) ? "Kaydedildi" : "Kaydet"}
              variant="outline"
              onPress={() => toggleSave(post.id)}
              style={{ flex: 1 }}
              icon={
                <Ionicons
                  name={
                    saved.includes(post.id) ? "bookmark" : "bookmark-outline"
                  }
                  size={17}
                  color={colors.text}
                />
              }
            />
            <Button
              title={`${post.commentCount}`}
              variant="outline"
              onPress={() =>
                message("Yorum ekranı API bağlantısı adımında eklenecek.")
              }
              style={{ flex: 0.6 }}
              icon={
                <Ionicons
                  name="chatbubble-outline"
                  size={17}
                  color={colors.text}
                />
              }
            />
          </View>
          <Button
            title={votes[post.id] ? "Sonuç detayları" : "Kombin detayları"}
            variant="outline"
            onPress={() =>
              router.push({ pathname: "/polls/[id]", params: { id: post.id } })
            }
          />
          {votes[post.id] && (
            <Button
              title="Sıradaki oylama"
              onPress={() => setIndex((value) => value + 1)}
            />
          )}
        </>
      ) : (
        <EmptyState
          title="Henüz oylama yok"
          message="Başka bir kategori seçerek keşfetmeye devam et."
        />
      )}
    </Screen>
  );
}
