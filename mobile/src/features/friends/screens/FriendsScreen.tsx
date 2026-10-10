import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { DEMO_FRIENDS } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { common, fonts } from "@/theme";

export function FriendsScreen() {
  return (
    <Screen>
      <Button
        title="Geri"
        variant="outline"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/profil")
        }
      />
      <Text style={common.title}>Arkadaşlar</Text>
      <Text style={common.subtitle}>Önizleme için örnek arkadaş listesi</Text>
      {DEMO_FRIENDS.map((username) => (
        <Pressable
          key={username}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/u/[username]", params: { username } })
          }
          style={[common.card, common.spread]}
        >
          <View>
            <Text style={{ fontFamily: fonts.bold }}>
              {getUser(username)?.displayName}
            </Text>
            <Text style={common.subtitle}>@{username}</Text>
          </View>
          <Text>→</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
