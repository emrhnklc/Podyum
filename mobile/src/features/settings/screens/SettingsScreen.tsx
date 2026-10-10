import { Fragment } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { resetWelcomed } from "@/features/auth/welcome";
import { usePreviewMessage } from "@/hooks/use-preview-message";
import appConfig from "../../../../app.json";
import { blush, colors, fonts, serif } from "@/theme";

type Row = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  // Bağlı bir ekran varsa oraya gider; yoksa "yakında" uyarısı gösterilir.
  href?: Href;
};

// Web'de Constants.expoConfig sürümü güvenilir değil; app.json tek kaynak.
const version = appConfig.expo.version;

const sections: { title: string; rows: Row[] }[] = [
  {
    title: "Hesap",
    rows: [
      { label: "Profil Bilgileri", icon: "person-outline" },
      { label: "Hesap ve Güvenlik", icon: "key-outline" },
      { label: "Bildirimler", icon: "notifications-outline", href: "/bildirimler" },
      { label: "Gizlilik", icon: "shield-checkmark-outline" },
    ],
  },
  {
    title: "Uygulama Tercihleri",
    rows: [
      { label: "Tema", icon: "brush-outline", value: "Podyum Pembe" },
      { label: "Dil", icon: "globe-outline", value: "Türkçe" },
      { label: "Keşfet Tercihleri", icon: "options-outline" },
      { label: "Konum Tercihleri", icon: "location-outline" },
    ],
  },
  {
    title: "Destek",
    rows: [
      { label: "Yardım Merkezi", icon: "help-circle-outline" },
      { label: "Bize Ulaşın", icon: "chatbox-ellipses-outline" },
      { label: "Kullanım Koşulları", icon: "document-text-outline" },
      { label: "Gizlilik Politikası", icon: "shield-outline" },
      {
        label: "Uygulama Hakkında",
        icon: "information-circle-outline",
        value: version ? `v${version}` : undefined,
      },
    ],
  },
];

export function SettingsScreen() {
  const message = usePreviewMessage();
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/profil");
  const open = (row: Row) =>
    row.href
      ? router.push(row.href)
      : message(`${row.label} sıradaki adımlarda açılacak.`);
  // Gerçek oturum yok; çıkış karşılama ekranına döndürür.
  const signOut = () => {
    resetWelcomed();
    router.replace("/auth");
  };
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.page}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={back}
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Ayarlar
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.rows.map((row, index) => (
                <Fragment key={row.label}>
                  {index > 0 && <View style={styles.divider} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      row.value ? `${row.label}, ${row.value}` : row.label
                    }
                    onPress={() => open(row)}
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name={row.icon} size={23} color={colors.text} />
                    <Text style={styles.label}>{row.label}</Text>
                    {row.value && <Text style={styles.value}>{row.value}</Text>}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </Fragment>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Çıkış Yap"
          onPress={signOut}
          style={({ pressed }) => [
            styles.signOut,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={22} color={blush.pink} />
          <Text style={{ fontFamily: fonts.bold, color: blush.pink }}>
            Çıkış Yap
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: blush.background },
  page: { width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { padding: 16, paddingBottom: 32, gap: 18 },
  header: { minHeight: 48, justifyContent: "center" },
  back: {
    position: "absolute",
    left: -6,
    zIndex: 1,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 24,
    color: colors.text,
  },
  // Başlık şeridi kartın arkasından görünür; görseldeki katmanlı kutu.
  section: {
    borderRadius: 20,
    backgroundColor: blush.chip,
    overflow: "hidden",
  },
  sectionTitle: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: blush.wine,
  },
  card: {
    borderRadius: 20,
    backgroundColor: blush.surface,
    borderWidth: 1,
    borderColor: blush.line,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  divider: { height: 1, backgroundColor: blush.line, marginLeft: 57 },
  label: { flex: 1, fontSize: 16, color: colors.text },
  value: { fontSize: 14, color: colors.muted },
  signOut: {
    minHeight: 56,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: blush.chip,
  },
});
