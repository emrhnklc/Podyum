import { useState } from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { CATEGORY_LABEL, type PollCategory } from "@/constants/poll-categories";
import { colors, common, fonts } from "@/theme";
import { usePreviewMessage } from "@/hooks/use-preview-message";

export function CreatePollScreen() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PollCategory>("OUTFIT");
  const [duration, setDuration] = useState("1800");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [comments, setComments] = useState(true);
  const [blur, setBlur] = useState(true);
  const message = usePreviewMessage();
  return (
    <Screen>
      <Text style={common.title}>Yeni oylama</Text>
      <Text style={common.subtitle}>
        İki kombin, tek soru. Kararı birlikte verelim.
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {["A", "B"].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`${label} fotoğrafı ekle`}
            onPress={() =>
              message("Fotoğraf seçimi bir sonraki adımda açılacak.")
            }
            style={{
              flex: 1,
              height: 210,
              borderRadius: 20,
              backgroundColor: label === "A" ? "#E8D3D6" : "#D2DCE8",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Text
              style={{
                position: "absolute",
                left: 14,
                top: 12,
                fontFamily: fonts.extraBold,
              }}
            >
              {label}
            </Text>
            <Ionicons
              name="add-circle-outline"
              size={36}
              color={colors.photoText}
            />
            <Text style={{ fontSize: 13 }}>Fotoğraf ekle</Text>
          </Pressable>
        ))}
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
        Tasarım önizlemesi · Bu form henüz paylaşım yayınlamaz.
      </Text>
      <Button
        title="Oylamayı yayınla"
        disabled={!question.trim()}
        onPress={() =>
          message("Bu bir tasarım önizlemesi. Paylaşım yayınlanmadı.")
        }
      />
    </Screen>
  );
}
