import { View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { common, colors, fonts } from "@/theme";

export function GamesScreen() {
  return (
    <Screen>
      <BackButton />
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
