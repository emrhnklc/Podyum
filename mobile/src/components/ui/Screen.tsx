import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme";

export function Screen({
  children,
  scroll = true,
  padding = 16,
}: {
  children: ReactNode;
  scroll?: boolean;
  // Kaydırmasız ekranlarda kenar boşluğu; içerik kenara dayanacaksa 0.
  padding?: number;
}) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{ width: "100%", maxWidth: 520, flex: 1, alignSelf: "center" }}
      >
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 28,
              gap: 16,
              flexGrow: 1,
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding, gap: 14 }}>{children}</View>
        )}
      </View>
    </SafeAreaView>
  );
}
