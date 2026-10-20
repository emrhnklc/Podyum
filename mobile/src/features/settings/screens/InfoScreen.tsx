import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Text } from "@/components/ui/Text";
import { common } from "@/theme";
import appConfig from "../../../../app.json";

const content: Record<string, string> = {
  Tema: "Şu anda Podyum Kahve teması kullanılıyor. Diğer temalar henüz kullanıma açık değil.",
  Dil: "Uygulama şu anda Türkçe kullanılıyor. Diğer diller henüz kullanıma açık değil.",
  "Yardım Merkezi":
    "Kombin paylaşmak için Paylaş sekmesini, kullanıcı bulmak için Keşfet’teki aramayı kullan. Arkadaşlar ekranında istekleri kabul edebilir, Defile’de oda kurup QR davetini paylaşabilirsin.",
  "Bize Ulaşın":
    "Destek iletişim adresi henüz tanımlanmadı. Kullanıcı veya içerik şikâyetini profil ve kombin ekranındaki Şikâyet et seçeneğinden gönderebilirsin.",
  "Kullanım Koşulları": "Kullanım koşulları henüz yayımlanmadı.",
  "Gizlilik Politikası":
    "Gizlilik politikası henüz yayımlanmadı. Gizlilik ayarlarından analiz iznini ve engellediğin kişileri yönetebilirsin.",
  "Uygulama Hakkında": `Podyum · v${appConfig.expo.version}\nKombinlerini paylaş, tercihlerini keşfet ve arkadaşlarınla defileye katıl.`,
};
export function InfoScreen() {
  const { title = "Uygulama Hakkında" } = useLocalSearchParams<{
    title?: string;
  }>();
  return (
    <Screen>
      <BackButton />
      <Text style={common.title}>{title}</Text>
      <Text>{content[title] ?? "Bu bölüm henüz kullanıma açık değil."}</Text>
    </Screen>
  );
}
