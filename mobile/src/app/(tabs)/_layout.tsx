import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/theme";
import { hasWelcomed } from "@/features/auth/welcome";

export default function TabsLayout() {
  // Açılışta önce karşılama ekranı; "Başla" sonrası sekmeler açılır.
  if (!hasWelcomed()) return <Redirect href="/auth" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trendler"
        options={{
          title: "Trendler",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="paylas"
        options={{
          title: "Paylaş",
          tabBarIcon: () => (
            <Ionicons name="add-circle" size={34} color={colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="bildirimler"
        options={{
          title: "Bildirim",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Defile rotası duruyor; Keşfet'teki kupa düğmesinden açılır. */}
      <Tabs.Screen name="defile" options={{ href: null }} />
    </Tabs>
  );
}
