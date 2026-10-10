import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { common, colors, fonts } from "@/theme";

export function GamesScreen() {
  return (
    <Screen>
      <Button
        title="Geri"
        variant="outline"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <Text style={common.title}>Podyum</Text>
      <Text style={common.subtitle}>
        Bir tema, farklı yorumlar. Sıra sende.
      </Text>
      <View style={[common.card, { backgroundColor: "#FBE7EB" }]}>
        <Text style={{ fontFamily: fonts.extraBold, fontSize: 24 }}>
          Günlük tema
        </Text>
        <Text>30 dakika kombin fotoğrafını hazırla.</Text>
        <Text>Sonraki 30 dakika katılımcılar oy versin.</Text>
        <Text style={{ color: colors.muted }}>
          Günlük saat ve tema yakında açıklanacak.
        </Text>
        <Button title="Katılım yakında" disabled onPress={() => {}} />
      </View>
      <View style={common.card}>
        <Text style={{ fontFamily: fonts.extraBold, fontSize: 24 }}>
          Arkadaşlarla oda
        </Text>
        <Text>
          Lobini kur, QR ile paylaş. Fotoğraf ve oylama sürelerini birlikte
          belirleyin.
        </Text>
        <Button
          title="Lobiler yakında"
          variant="dark"
          disabled
          onPress={() => {}}
        />
      </View>
    </Screen>
  );
}
