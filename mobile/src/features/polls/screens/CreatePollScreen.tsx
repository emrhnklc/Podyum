import { useState } from "react";
import { Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { PreviewImage } from "@/components/media/PreviewImage";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { colors, common, fonts } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";

type Label = "A" | "B";
type Photo = { uri: string; mimeType?: string; fileSize?: number };

const slots: { label: Label; tone: string }[] = [
  { label: "A", tone: "#E8D3D6" },
  { label: "B", tone: "#D2DCE8" },
];

export function CreatePollScreen() {
  const [photos, setPhotos] = useState<Partial<Record<Label, Photo>>>({});
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PollCategory>("OUTFIT");
  const [duration, setDuration] = useState("1800");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [comments, setComments] = useState(true);
  const [blur, setBlur] = useState(true);
  const message = usePreviewMessage();
  const ready = !!question.trim() && !!photos.A && !!photos.B;

  // Galeriden tek fotoğraf seçer. quality verildiği için iOS'taki HEIC
  // fotoğraflar JPEG'e çevrilir; backend HEIC kabul etmiyor.
  async function pick(label: Label) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhotos((previous) => ({
        ...previous,
        [label]: {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        },
      }));
    } catch {
      message("Fotoğraf seçilemedi. Galeri iznini kontrol edip tekrar dene.");
    }
  }

  function remove(label: Label) {
    setPhotos((previous) => ({ ...previous, [label]: undefined }));
  }

  return (
    <Screen>
      <Text style={common.title}>Yeni oylama</Text>
      <Text style={common.subtitle}>
        İki kombin, tek soru. Kararı birlikte verelim.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {slots.map(({ label, tone }) => {
          const photo = photos[label];
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={
                photo ? `${label} fotoğrafını değiştir` : `${label} fotoğrafı ekle`
              }
              onPress={() => pick(label)}
              style={[styles.slot, { backgroundColor: tone }]}
            >
              {photo ? (
                <>
                  <PreviewImage uri={photo.uri} tone={tone} />
                  <View style={styles.change}>
                    <Text style={styles.changeText}>Değiştir</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${label} fotoğrafını kaldır`}
                    hitSlop={8}
                    onPress={() => remove(label)}
                    style={styles.remove}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={36}
                    color={colors.photoText}
                  />
                  <Text style={{ fontSize: 13 }}>Fotoğraf ekle</Text>
                </>
              )}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={common.label}>Sorun ne?</Text>
      <TextInput
        accessibilityLabel="Oylama sorusu"
        value={question}
        onChangeText={setQuestion}
        maxLength={200}
        placeholder="Cuma akşamı ilk buluşma. Hangisi?"
        placeholderTextColor={colors.muted}
        multiline
        style={{
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: 16,
          minHeight: 72,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
        }}
      />
      <ChipRow
        label="Kategori"
        options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
          value: value as PollCategory,
          label,
        }))}
        value={category}
        onChange={setCategory}
      />
      <ChipRow
        label="Oylama süresi"
        options={[
          { value: "1800", label: "30 dk" },
          { value: "7200", label: "2 saat" },
          { value: "86400", label: "24 saat" },
        ]}
        value={duration}
        onChange={setDuration}
      />
      <ChipRow
        label="Kimler görsün?"
        options={[
          { value: "PUBLIC", label: "Herkes" },
          { value: "FRIENDS", label: "Arkadaşlarım" },
        ]}
        value={visibility}
        onChange={setVisibility}
      />
      <View style={common.spread}>
        <Text>Yorumlara izin ver</Text>
        <Switch
          accessibilityLabel="Yorumlara izin ver"
          value={comments}
          onValueChange={setComments}
          trackColor={{ true: colors.accent }}
        />
      </View>
      <View style={common.spread}>
        <Text>Yüzümü bulanıklaştır</Text>
        <Switch
          accessibilityLabel="Yüzümü bulanıklaştır"
          value={blur}
          onValueChange={setBlur}
          trackColor={{ true: colors.accent }}
        />
      </View>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        Seçtiğin fotoğraflar şimdilik yalnızca bu telefonda kalır. Giriş
        bağlandığında hesabınla birlikte sunucuya yüklenecek.
      </Text>
      <Button
        title="Oylamayı yayınla"
        disabled={!ready}
        onPress={() =>
          message(
            "Fotoğrafların ve sorun hazır. Yayınlama, giriş ve sunucu bağlantısı eklendiğinde açılacak.",
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.extraBold, color: colors.onAccent },
  change: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeText: { fontSize: 12, fontFamily: fonts.semibold },
  remove: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
