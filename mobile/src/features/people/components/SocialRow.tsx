import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { common, fonts } from "@/theme";
import { openUser, type SocialItem } from "../api/social";
import { RelationshipActions } from "./RelationshipActions";

export function SocialRow({
  item,
  refresh,
}: {
  item: SocialItem;
  refresh: () => unknown;
}) {
  return (
    <View style={[common.card, { gap: 12 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.user.username} profilini aç`}
        onPress={() => openUser(item.user)}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>
          {item.user.displayName}
        </Text>
        <Text style={common.subtitle}>@{item.user.username}</Text>
      </Pressable>
      <RelationshipActions
        userId={item.user.id}
        state={item.relationship}
        onChanged={refresh}
      />
    </View>
  );
}
