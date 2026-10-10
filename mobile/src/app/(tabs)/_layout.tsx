import { Redirect, Tabs, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, type ColorValue } from "react-native";
import { brand, colors, fonts } from "@/theme";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { hasWelcomed } from "@/features/auth/welcome";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, idle: IconName) {
  return function TabIcon({
    color,
    focused,
  }: {
    color: ColorValue;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? active : idle} size={24} color={color} />;
  };
}

export default function TabsLayout() {
  const { ready, me } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;
  // Açılışta önce karşılama ekranı; "Başla" sonrası sekmeler açılır.
  if (!me && !hasWelcomed()) return <Redirect href="/auth" />;
  return (
    <View style={{ flex: 1 }}>
    {me && segments.length > 1 && <View style={{ backgroundColor: brand.chip, paddingTop: insets.top, paddingBottom: 8, alignItems: "center" }}><Text style={{ color: colors.muted, fontSize: 12 }}>Bu ekran tasarım önizlemesidir.</Text></View>}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: brand.surface,
          borderTopColor: brand.line,
          height: 76,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Keşfet", tabBarIcon: tabIcon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="trendler"
        options={{
          title: "Trendler",
          tabBarIcon: tabIcon("trending-up", "trending-up"),
        }}
      />
      <Tabs.Screen
        name="paylas"
        options={{
          title: "Paylaş",
          // Ortadaki + yalnız ikon; ekran okuyucu yine "Paylaş" der.
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: "Paylaş",
          tabBarActiveTintColor: colors.muted,
          tabBarIcon: () => (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                marginTop: -22,
                backgroundColor: brand.accent,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: brand.accent,
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Ionicons name="add" size={30} color={colors.onAccent} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="defile"
        options={{
          title: "Defile",
          tabBarIcon: tabIcon("sparkles", "sparkles-outline"),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: tabIcon("person", "person-outline"),
        }}
      />
      {/* Bildirimler rotası duruyor; sekme çubuğunda Defile yer aldı. */}
      <Tabs.Screen name="bildirimler" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
