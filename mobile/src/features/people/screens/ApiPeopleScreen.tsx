import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiList } from "@/hooks/use-api-query";
import { brand, colors, common } from "@/theme";
import type { SocialItem } from "../api/social";
import { SocialRow } from "../components/SocialRow";

export function ApiPeopleScreen() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const normalized = query.trim().replace(/^@/, "").toLowerCase();
  const valid = /^[a-z0-9_]{2,30}$/.test(normalized);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(normalized), 300);
    return () => clearTimeout(timer);
  }, [normalized]);
  const list = useApiList<SocialItem>(
    valid && debounced === normalized
      ? `/users/search?q=${encodeURIComponent(debounced)}&limit=20`
      : null,
  );
  return (
    <Screen>
      <BackButton />
      <Text style={common.title}>Kişiler</Text>
      <View style={common.row}>
        <TextInput
          accessibilityLabel="Kullanıcı ara"
          placeholder="Kullanıcı adı ara"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 24,
            backgroundColor: brand.surface,
            color: colors.text,
          }}
        />
        <Button
          title="Temizle"
          variant="outline"
          disabled={!query}
          onPress={() => setQuery("")}
        />
      </View>
      <Text style={common.subtitle}>
        Kullanıcı adının ilk en az 2 harfini yaz. Küçük harf, rakam ve alt çizgi
        kullanabilirsin.
      </Text>
      <Button
        title="Arkadaşlar ve istekler"
        variant="outline"
        onPress={() => router.push("/friends")}
      />
      <ApiStatus
        loading={list.loading}
        error={list.error}
        retry={list.refresh}
      />
      {list.items.map((item) => (
        <SocialRow key={item.user.id} item={item} refresh={list.refresh} />
      ))}
      {valid &&
        debounced === normalized &&
        !list.loading &&
        !list.error &&
        !list.items.length && (
          <EmptyState
            title="Kimse bulunamadı"
            message="Başka bir kullanıcı adı dene."
          />
        )}
      {list.hasMore && (
        <Button
          title="Daha fazla kişi"
          disabled={list.loading}
          onPress={() => void list.loadMore()}
        />
      )}
    </Screen>
  );
}
