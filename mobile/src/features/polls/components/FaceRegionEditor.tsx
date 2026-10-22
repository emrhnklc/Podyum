import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { brand, colors, common, fonts } from "@/theme";

// Sunucunun beklediği biçim: fotoğrafa oranla 0–1 aralığında dikdörtgen.
export type BlurRegion = { x: number; y: number; width: number; height: number };

const MAX_REGIONS = 10;
const MAX_HEIGHT = 520;
const START_SIZE = 0.24;
const MIN_SIZE = 0.06;
const STEP = 1.25;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Kare kalması için boyut piksel üzerinden hesaplanır, sonra orana çevrilir.
function square(
  centerX: number,
  centerY: number,
  side: number,
  ratio: number,
): BlurRegion {
  const width = clamp(side, MIN_SIZE, 1);
  const height = clamp(side * ratio, MIN_SIZE, 1);
  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height,
  };
}

// Yüz bölgelerini elle işaretleme. Fotoğrafa dokunmak kare ekler; kareye
// dokunmak onu seçer. Bulanıklaştırmayı sunucu yapar, sonuç onay ekranında
// görünür. Otomatik yüz bulma yoktur; bütün yüzleri kullanıcı işaretler.
export function FaceRegionEditor({
  uri,
  label,
  initial,
  onSave,
  onClose,
}: {
  uri: string;
  label: string;
  initial: BlurRegion[];
  onSave: (regions: BlurRegion[]) => void;
  onClose: () => void;
}) {
  const [regions, setRegions] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [areaWidth, setAreaWidth] = useState(0);
  const photo = useRef<View>(null);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => alive && setNatural({ w, h }),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  // Fotoğraf alana sığacak şekilde ölçeklenir; oranı bozulmaz.
  const box = natural
    ? (() => {
        const width = Math.min(
          areaWidth,
          (MAX_HEIGHT * natural.w) / natural.h,
        );
        return { width, height: (width * natural.h) / natural.w };
      })()
    : null;
  // Yükseklik/genişlik oranı: kare çizmek için y boyutu buna göre ölçeklenir.
  const ratio = natural ? natural.w / natural.h : 1;

  // Dokunma noktası fotoğrafın ekrandaki konumuna göre hesaplanır; web'de
  // locationX alt öğeye göre gelebildiği için sayfa koordinatı kullanılır.
  function add(event: GestureResponderEvent) {
    if (!box || regions.length >= MAX_REGIONS) return;
    const { pageX, pageY } = event.nativeEvent;
    photo.current?.measure((_x, _y, width, height, left, top) => {
      const centerX = (pageX - left) / width;
      const centerY = (pageY - top) / height;
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
      const next = square(
        clamp(centerX, 0, 1),
        clamp(centerY, 0, 1),
        START_SIZE,
        ratio,
      );
      setRegions([...regions, next]);
      setSelected(regions.length);
    });
  }
  function resize(factor: number) {
    if (selected === null) return;
    setRegions((rows) =>
      rows.map((row, index) =>
        index === selected
          ? square(
              row.x + row.width / 2,
              row.y + row.height / 2,
              row.width * factor,
              ratio,
            )
          : row,
      ),
    );
  }
  function remove() {
    if (selected === null) return;
    setRegions((rows) => rows.filter((_, index) => index !== selected));
    setSelected(null);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: brand.background }}
        contentContainerStyle={styles.page}
      >
        <View style={common.spread}>
          <Text style={styles.title}>{label}: yüzleri işaretle</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <Text style={common.subtitle}>
          Bulanıklaşacak her yüze dokun. Kareye dokunup büyütebilir veya
          silebilirsin. Sonucu yayından önce göreceksin.
        </Text>
        <View
          onLayout={(event: LayoutChangeEvent) =>
            setAreaWidth(event.nativeEvent.layout.width)
          }
          style={{ alignItems: "center" }}
        >
          {failed && (
            <Text style={{ color: colors.accent }}>
              Fotoğraf açılamadı. Fotoğrafı yeniden seç.
            </Text>
          )}
          {box && areaWidth > 0 && (
            <View
              ref={photo}
              collapsable={false}
              style={{ width: box.width, height: box.height }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yüz bölgesi ekle"
                accessibilityHint="Fotoğrafta dokunduğun yere kare ekler"
                onPress={add}
                style={StyleSheet.absoluteFill}
              >
                <Image
                  source={{ uri }}
                  resizeMode="stretch"
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                />
              </Pressable>
              {regions.map((region, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Bölge ${index + 1}`}
                  accessibilityState={{ selected: selected === index }}
                  onPress={() => setSelected(index)}
                  style={[
                    styles.region,
                    {
                      left: region.x * box.width,
                      top: region.y * box.height,
                      width: region.width * box.width,
                      height: region.height * box.height,
                    },
                    selected === index && styles.regionSelected,
                  ]}
                >
                  <Text style={styles.regionLabel}>{index + 1}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Text style={{ textAlign: "center", color: colors.muted }}>
          {regions.length}/{MAX_REGIONS} bölge
          {selected !== null ? ` · Bölge ${selected + 1} seçili` : ""}
        </Text>
        {selected !== null && (
          <View style={[common.row, { justifyContent: "center" }]}>
            <Button
              title="Küçült"
              variant="outline"
              onPress={() => resize(1 / STEP)}
            />
            <Button
              title="Büyüt"
              variant="outline"
              onPress={() => resize(STEP)}
            />
            <Button title="Sil" variant="outline" onPress={remove} />
          </View>
        )}
        <Button
          title={
            regions.length
              ? `${regions.length} bölgeyi kaydet`
              : "Bölge olmadan kaydet"
          }
          onPress={() => onSave(regions)}
        />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 20,
    paddingTop: 48,
    gap: 16,
  },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 20 },
  region: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.onAccent,
    borderRadius: 10,
    backgroundColor: "rgba(208,10,38,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  regionSelected: { borderColor: brand.accent, borderWidth: 3 },
  regionLabel: { fontFamily: fonts.bold, color: colors.onAccent },
});
