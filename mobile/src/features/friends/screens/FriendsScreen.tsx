import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { BackButton } from "@/components/ui/BackButton";
import { DEMO_FRIENDS } from "@/constants/demo";
import { getUser } from "@/features/profile/data/demo-users";
import { common, fonts } from "@/theme";

export function FriendsScreen() {
  return (
    <Screen>
      <BackButton fallback="/profil" />
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
