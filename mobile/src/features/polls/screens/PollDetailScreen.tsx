import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { posts } from "../data/demo-polls";
import { PollCard } from "../components/PollCard";
import { common } from "@/theme";

export function PollDetailScreen({ id }: { id: string }) {
  const post = posts.find((item) => item.id === id);
  return (
    <Screen>
      <Button
        title="Geri"
        variant="outline"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <Text style={common.title}>Kombin detayları</Text>
      {post ? (
        <>
          <PollCard post={post} />
          <Text style={common.subtitle}>
            Ürün bağlantıları ve yorumlar backend bağlantısı adımında eklenecek.
          </Text>
        </>
      ) : (
        <EmptyState
          title="Oylama bulunamadı"
          message="Bu önizlemede böyle bir paylaşım yok."
        />
      )}
    </Screen>
  );
}
