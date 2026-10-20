import { useRef, useState } from "react";
import { Switch, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { PillChip } from "@/components/ui/PillChip";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { common, colors } from "@/theme";

type Settings = {
  pushEnabled: boolean;
  friendRequestNotifications: boolean;
  pollResultNotifications: boolean;
  commentNotifications: boolean;
  gameNotifications: boolean;
  defaultPollVisibility: "PUBLIC" | "FRIENDS";
  defaultCommentsEnabled: boolean;
  defaultBlurFace: boolean;
};
type Private = {
  gender: string | null;
  ageBand: string | null;
  cityCode: string | null;
  analyticsConsent: boolean;
};
const notificationFields = [
  { key: "pushEnabled", label: "Anlık bildirimler" },
  { key: "friendRequestNotifications", label: "Arkadaşlık istekleri" },
  { key: "pollResultNotifications", label: "Oylama sonuçları" },
  { key: "commentNotifications", label: "Yorumlar" },
  { key: "gameNotifications", label: "Defileler" },
] as const;

export function PreferencesScreen() {
  const { section = "feed" } = useLocalSearchParams<{ section?: string }>();
  const { client } = useAuth();
  const settings = useApiQuery<Settings>("/me/settings");
  const privateQuery = useApiQuery<Private>(
    ["privacy", "location"].includes(section) ? "/me/private" : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const lock = useRef(false);
  async function save(path: "/me/settings" | "/me/private", body: object) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await client.request(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await (path === "/me/settings"
        ? settings.refresh()
        : privateQuery.refresh());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <BackButton />
      <Text style={common.title}>
        {section === "notifications"
          ? "Bildirim tercihleri"
          : section === "privacy"
            ? "Gizlilik"
            : section === "location"
              ? "Konum tercihleri"
              : "Keşfet tercihleri"}
      </Text>
      <ApiStatus
        loading={settings.loading || privateQuery.loading || busy}
        error={error ?? settings.error ?? privateQuery.error}
        retry={() => {
          void settings.refresh();
          void privateQuery.refresh();
        }}
      />
      {section === "notifications" && settings.data && (
        <>
          {notificationFields.map(({ key, label }) => (
            <PreferenceToggle
              key={key}
              label={label}
              value={settings.data![key]}
              disabled={busy}
              onChange={(value) => void save("/me/settings", { [key]: value })}
            />
          ))}
          <Text style={common.subtitle}>
            Uygulama içi bildirimlerin Bildirimler ekranında kalır. Telefona
            bildirim teslimi ayrıca cihaz izni ve push kurulumu gerektirir.
          </Text>
          <Button
            title="Bildirimleri aç"
            variant="outline"
            onPress={() => router.push("/bildirimler")}
          />
        </>
      )}
      {section === "feed" && settings.data && (
        <>
          <Text style={common.subtitle}>
            Bu tercihler yeni paylaşımların için kullanılır.
          </Text>
          <View style={common.row}>
            {(["PUBLIC", "FRIENDS"] as const).map((value) => (
              <PillChip
                key={value}
                label={value === "PUBLIC" ? "Herkes" : "Arkadaşlar"}
                active={settings.data?.defaultPollVisibility === value}
                onPress={() => {
                  if (!busy)
                    void save("/me/settings", { defaultPollVisibility: value });
                }}
              />
            ))}
          </View>
          <PreferenceToggle
            label="Yeni paylaşımlarda yorumlara izin ver"
            value={settings.data.defaultCommentsEnabled}
            disabled={busy}
            onChange={(value) =>
              void save("/me/settings", { defaultCommentsEnabled: value })
            }
          />
          <PreferenceToggle
            label="Yüzü bulanıklaştırma tercihi"
            value={settings.data.defaultBlurFace}
            disabled={busy}
            onChange={(value) =>
              void save("/me/settings", { defaultBlurFace: value })
            }
          />
        </>
      )}
      {section === "privacy" && privateQuery.data && (
        <>
          <PreferenceToggle
            label="Trend analizlerine katıl"
            value={privateQuery.data.analyticsConsent}
            disabled={busy}
            onChange={(value) =>
              void save("/me/private", { analyticsConsent: value })
            }
          />
          <Text style={common.subtitle}>
            Yaş ve cinsiyet bilgilerim tercihlerimin toplu analizinde
            kullanılsın. İznini istediğin zaman kapatabilirsin.
          </Text>
          <Text>Cinsiyet (isteğe bağlı)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { value: null, label: "Belirtmek istemiyorum" },
              { value: "WOMAN", label: "Kadın" },
              { value: "MAN", label: "Erkek" },
              { value: "NON_BINARY", label: "İkili olmayan" },
            ].map((item) => (
              <PillChip
                key={item.label}
                label={item.label}
                active={privateQuery.data?.gender === item.value}
                onPress={() => {
                  if (!busy) void save("/me/private", { gender: item.value });
                }}
              />
            ))}
          </View>
          <Text>Yaş grubu (isteğe bağlı)</Text>
          <View style={common.row}>
            {[
              { value: null, label: "Belirtme" },
              { value: "AGE_18_24", label: "18–24" },
              { value: "AGE_25_34", label: "25–34" },
              { value: "AGE_35_PLUS", label: "35+" },
            ].map((item) => (
              <PillChip
                key={item.label}
                label={item.label}
                active={privateQuery.data?.ageBand === item.value}
                onPress={() => {
                  if (!busy) void save("/me/private", { ageBand: item.value });
                }}
              />
            ))}
          </View>
          <Button
            title="Engellenen kişiler"
            variant="outline"
            onPress={() => router.push("/settings/blocked")}
          />
        </>
      )}
      {section === "location" && privateQuery.data && (
        <>
          <Text style={common.subtitle}>
            İsteğe bağlı şehir kodun; GPS konumun alınmaz. Örnek: TR-34.
          </Text>
          <TextInput
            accessibilityLabel="Şehir kodu"
            value={city ?? privateQuery.data.cityCode ?? ""}
            onChangeText={(value) => setCity(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={20}
            editable={!busy}
            style={{ padding: 16, color: colors.text }}
          />
          <Button
            title="Şehri kaydet"
            disabled={busy}
            onPress={() =>
              void save("/me/private", {
                cityCode:
                  (city ?? privateQuery.data?.cityCode ?? "").trim() || null,
              })
            }
          />
        </>
      )}
    </Screen>
  );
}

function PreferenceToggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[common.card, common.spread]}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}
