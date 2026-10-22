import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { brand, colors, common, fonts } from "@/theme";
import {
  BUDGET,
  MODES,
  SPONSORED,
  formatTry,
  type GameMode,
} from "../data/demo-modes";

// Konsept oyun modları. Seçimler yalnız bu ekranda tutulur; oda, oy veya
// ödül üretmez. Katılım "Yakında" olarak kapalıdır.
export function GameModeScreen({ mode }: { mode: GameMode }) {
  const info = MODES[mode];
  return (
    <Screen>
      <BackButton fallback="/defile" />
      <View style={styles.concept}>
        <Ionicons name="flask-outline" size={16} color={brand.accentDark} />
        <Text style={styles.conceptText}>
          Konsept mod: örnek veri, katılım yakında açılacak.
        </Text>
      </View>
      <View style={common.row}>
        <View style={styles.icon}>
          <Ionicons name={info.icon} size={24} color={brand.accent} />
        </View>
        <Text style={[common.title, { flex: 1 }]}>{info.title}</Text>
      </View>
      <Text style={common.subtitle}>{info.tagline}</Text>
      {mode === "budget" ? <BudgetMode /> : <SponsoredMode />}
    </Screen>
  );
}

function BudgetMode() {
  const [picked, setPicked] = useState<string[]>([]);
  const total = BUDGET.pieces
    .filter((piece) => picked.includes(piece.id))
    .reduce((sum, piece) => sum + piece.priceMinor, 0);
  const over = total > BUDGET.limitMinor;
  const share = Math.min(1, total / BUDGET.limitMinor);
  return (
    <>
      <View style={[common.card, { gap: 10 }]}>
        <Text style={styles.label}>Bu haftanın teması</Text>
        <Text style={styles.big}>{BUDGET.theme}</Text>
        <View style={common.spread}>
          <Text style={{ fontFamily: fonts.bold, color: over ? colors.accent : colors.text }}>
            {formatTry(total)}
          </Text>
          <Text style={{ color: colors.muted }}>
            Bütçe {formatTry(BUDGET.limitMinor)}
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${share * 100}%`,
                backgroundColor: over ? colors.accent : colors.text,
              },
            ]}
          />
        </View>
        <Text style={{ fontSize: 13, color: over ? colors.accent : colors.muted }}>
          {over
            ? `Bütçeyi ${formatTry(total - BUDGET.limitMinor)} aştın. Bir parçayı çıkar.`
            : `${formatTry(BUDGET.limitMinor - total)} kaldı. Parçalar katalogdan gelir.`}
        </Text>
      </View>
      <Text style={styles.label}>Parçaları seç</Text>
      {BUDGET.pieces.map((piece) => {
        const active = picked.includes(piece.id);
        return (
          <Pressable
            key={piece.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${piece.title}, ${formatTry(piece.priceMinor)}`}
            onPress={() =>
              setPicked((rows) =>
                active ? rows.filter((id) => id !== piece.id) : [...rows, piece.id],
              )
            }
            style={[styles.piece, active && styles.pieceActive]}
          >
            <View style={styles.thumb}>
              <Ionicons name={piece.icon} size={22} color={colors.photoText} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.semibold }}>{piece.title}</Text>
            <Text style={{ fontFamily: fonts.bold }}>{formatTry(piece.priceMinor)}</Text>
            <Ionicons
              name={active ? "checkmark-circle" : "add-circle-outline"}
              size={24}
              color={active ? brand.accent : colors.muted}
            />
          </Pressable>
        );
      })}
      <View style={[common.card, { gap: 6 }]}>
        <Text style={styles.label}>Nasıl oynanır?</Text>
        <Text>1. Katalogdan bütçeyi aşmayan parçaları seç.</Text>
        <Text>2. Bu parçalarla kombinini fotoğrafla; sanal denemeyle de gönderebilirsin.</Text>
        <Text>3. Topluluk 1–5 yıldızla oylar; kazanan lig puanı ve rozet alır.</Text>
      </View>
      <Button title="Kombinimi gönder · Yakında" disabled onPress={() => undefined} />
    </>
  );
}

function SponsoredMode() {
  return (
    <>
      <View style={styles.sponsor}>
        <Text style={styles.sponsorBrand}>{SPONSORED.brand}</Text>
        <Text style={styles.sponsorTheme}>{SPONSORED.theme}</Text>
        <View style={[common.row, { gap: 6 }]}>
          <Ionicons name="gift-outline" size={18} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, flex: 1 }}>{SPONSORED.prize}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SPONSORED.timeline.map((step) => (
          <View key={step.label} style={styles.step}>
            <Text style={{ fontSize: 12, color: colors.muted }}>{step.label}</Text>
            <Text style={{ fontFamily: fonts.bold }}>{step.value}</Text>
          </View>
        ))}
      </View>
      <View style={[common.card, { gap: 8 }]}>
        <Text style={styles.label}>Kurallar</Text>
        {SPONSORED.rules.map((rule) => (
          <View key={rule} style={[common.row, { alignItems: "flex-start" }]}>
            <Ionicons name="checkmark-circle" size={18} color={brand.accent} />
            <Text style={{ flex: 1 }}>{rule}</Text>
          </View>
        ))}
      </View>
      <View style={[common.card, { gap: 8 }]}>
        <Text style={styles.label}>Marka ve Podyum ne kazanır?</Text>
        {SPONSORED.revenue.map((row) => (
          <View key={row} style={[common.row, { alignItems: "flex-start" }]}>
            <Ionicons name="trending-up" size={18} color={colors.text} />
            <Text style={{ flex: 1 }}>{row}</Text>
          </View>
        ))}
      </View>
      <Button title="Yarışmaya katıl · Yakında" disabled onPress={() => undefined} />
    </>
  );
}

const styles = StyleSheet.create({
  concept: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: brand.accentSoft,
  },
  conceptText: { flex: 1, fontSize: 13, color: brand.accentDark },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.bold, fontSize: 15 },
  big: { fontFamily: fonts.extraBold, fontSize: 24, letterSpacing: -0.5 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.chip, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  piece: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.line,
    backgroundColor: brand.card,
  },
  pieceActive: { borderColor: brand.accent, backgroundColor: brand.accentSoft },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsor: { padding: 20, borderRadius: 24, backgroundColor: colors.text, gap: 10 },
  sponsorBrand: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentSoft, letterSpacing: 1 },
  sponsorTheme: { fontFamily: fonts.extraBold, fontSize: 28, color: colors.onAccent },
  step: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 2,
  },
});
