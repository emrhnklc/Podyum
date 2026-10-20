import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ApiStatus } from "@/components/ui/ApiStatus";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type {
  CatalogProduct,
  CatalogResolution,
} from "@/features/catalog/api/catalog";
import type { PollCategory } from "@/constants/poll-categories";
import { brand, colors, fonts } from "@/theme";
import {
  manualProduct,
  productTagInputs,
  productTitle,
  type ProductTagDraft,
} from "../product-tags";

export function ProductTagEditor({
  label,
  initial,
  category,
  onSave,
  onClose,
}: {
  label: string;
  initial: ProductTagDraft[];
  category: PollCategory;
  onSave: (items: ProductTagDraft[]) => void;
  onClose: () => void;
}) {
  const { client } = useAuth();
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState<CatalogResolution | null>(null);
  const [title, setTitle] = useState("");
  const [brandName, setBrandName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const suggestionKey = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  function checked(next: ProductTagDraft[]) {
    productTagInputs(next);
    return next;
  }
  function add(item: ProductTagDraft) {
    try {
      setItems(checked([...items, item]));
      setError(null);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Ürün eklenemedi.");
      return false;
    }
  }
  async function search() {
    if (operation.current || query.trim().length < 2) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(null);
    setResolution(null);
    setNotice(null);
    const value = query.trim(),
      isUrl = /^https?:\/\//i.test(value);
    try {
      const data = await client.request<CatalogResolution>("/catalog/resolve", {
        method: "POST",
        body: JSON.stringify(isUrl ? { url: value } : { query: value }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResolution(data);
      if (isUrl) setUrl(value);
      if (!isUrl && !title) setTitle(value);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : "Arama tamamlanamadı.",
        );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function choose(product: CatalogProduct) {
    const original =
      resolution?.match === "EXACT" && resolution.product?.id === product.id
        ? resolution.originalUrl
        : null;
    if (!original && !product.canonicalUrl) {
      setError("Bu ürünün bağlantısı henüz eklenmemiş.");
      return;
    }
    if (
      add({
        kind: "catalog",
        product,
        ...(original ? { externalUrl: original } : {}),
      })
    )
      setNotice("Katalog ürünü eklendi.");
  }
  async function addManual(suggest: boolean) {
    if (operation.current) return;
    const controller = new AbortController();
    try {
      const data = manualProduct({
        title,
        brand: brandName,
        url,
        price,
        currency,
      });
      const next = checked([...items, { kind: "manual", ...data }]);
      setError(null);
      setNotice(null);
      if (suggest) {
        operation.current = controller;
        setBusy(true);
        const body = { ...data, url: data.externalUrl, category };
        const { externalUrl: _url, ...request } = body;
        const signature = JSON.stringify(request);
        if (suggestionKey.current?.signature !== signature)
          suggestionKey.current = { signature, key: Crypto.randomUUID() };
        await client.request("/catalog/suggestions", {
          method: "POST",
          headers: { "Idempotency-Key": suggestionKey.current.key },
          body: signature,
          signal: controller.signal,
        });
      }
      if (controller.signal.aborted) return;
      setItems(next);
      setTitle("");
      setBrandName("");
      setUrl("");
      setPrice("");
      setNotice(
        suggest
          ? "Ürün eklendi; önerin incelemeye gönderildi. Paylaşımında elle eklenen ürün olarak kalır."
          : "Ürün eklendi.",
      );
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : "Ürün eklenemedi.",
        );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const products = resolution?.product
    ? [resolution.product]
    : (resolution?.candidates ?? []);
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.page}
        >
          <Text style={styles.heading}>
            {label} · Ürünler ({items.length}/10)
          </Text>
          <Button
            title="Vazgeç"
            variant="outline"
            disabled={busy}
            onPress={onClose}
          />
          {items.map((item, index) => (
            <View key={`${index}:${productTitle(item)}`} style={styles.card}>
              <Text style={styles.name}>{productTitle(item)}</Text>
              <Text style={styles.muted}>
                {item.kind === "catalog"
                  ? "Katalogdan seçildi"
                  : "Elle eklendi"}
              </Text>
              <Button
                title={`${productTitle(item)} ürününü kaldır`}
                variant="outline"
                disabled={busy}
                onPress={() => setItems(items.filter((_, i) => i !== index))}
              />
            </View>
          ))}
          <Text style={styles.name}>Katalogda ara</Text>
          <Field
            label="Ürün adı veya bağlantısı"
            value={query}
            maxLength={2048}
            editable={!busy}
            onChange={(value) => {
              setQuery(value);
              setResolution(null);
            }}
          />
          <Button
            title="Ürün ara"
            disabled={busy || query.trim().length < 2}
            onPress={() => void search()}
          />
          {resolution && (
            <Text style={styles.muted}>
              {resolution.match === "EXACT"
                ? "Bağlantı katalogdaki ürünle eşleşti."
                : resolution.match === "CANDIDATES"
                  ? "Benzer ürünler bulundu. Uygun olanı seç."
                  : "Eşleşme yok. Aşağıdan elle ekleyebilirsin."}
            </Text>
          )}
          {products.map((product) => (
            <Pressable
              key={product.id}
              accessibilityRole="button"
              accessibilityLabel={`${product.title} ürününü seç`}
              disabled={busy || items.length >= 10}
              style={styles.card}
              onPress={() => choose(product)}
            >
              <Text style={styles.name}>{product.title}</Text>
              <Text style={styles.muted}>
                {[product.brand, product.store?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text>
                {product.priceMinor === null
                  ? "Fiyat belirtilmemiş"
                  : `${(product.priceMinor / 100).toFixed(2)} ${product.currency}`}
              </Text>
              <Text style={styles.muted}>
                {product.canonicalUrl
                  ? "Seçmek için dokun"
                  : "Bağlantı henüz eklenmemiş"}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.name}>Elle ürün ekle</Text>
          <Field
            label="Ürün adı"
            value={title}
            onChange={setTitle}
            maxLength={150}
            editable={!busy}
          />
          <Field
            label="Marka (isteğe bağlı)"
            value={brandName}
            onChange={setBrandName}
            maxLength={100}
            editable={!busy}
          />
          <Field
            label="Ürün bağlantısı"
            value={url}
            onChange={setUrl}
            maxLength={2048}
            editable={!busy}
          />
          <Field
            label="Fiyat (isteğe bağlı)"
            value={price}
            onChange={setPrice}
            maxLength={14}
            editable={!busy}
            numeric
          />
          <View style={styles.currencies}>
            {["TRY", "EUR", "USD", "GBP"].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: currency === value }}
                disabled={busy}
                onPress={() => setCurrency(value)}
                style={[
                  styles.currency,
                  currency === value && { borderColor: brand.accent },
                ]}
              >
                <Text>{value}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            title="Elle ekle"
            variant="outline"
            disabled={busy || items.length >= 10}
            onPress={() => void addManual(false)}
          />
          <Button
            title="Kataloğa öner ve ekle"
            variant="outline"
            disabled={busy || items.length >= 10}
            onPress={() => void addManual(true)}
          />
          <ApiStatus loading={busy} error={error} />
          {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
          <Button
            title="Ürünleri kaydet"
            disabled={busy}
            onPress={() => onSave(items)}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  editable,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  editable: boolean;
  numeric?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={colors.muted}
      value={value}
      onChangeText={onChange}
      maxLength={maxLength}
      editable={editable}
      keyboardType={numeric ? "decimal-pad" : "default"}
      autoCapitalize="none"
      autoCorrect={false}
      style={styles.input}
    />
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.background },
  page: {
    padding: 20,
    gap: 12,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  heading: { fontFamily: fonts.bold, fontSize: 23 },
  name: { fontFamily: fonts.semibold, fontSize: 16 },
  muted: { color: colors.muted, fontSize: 13 },
  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: brand.line,
    borderRadius: 16,
    gap: 7,
    backgroundColor: brand.surface,
  },
  input: {
    padding: 14,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.line,
    backgroundColor: brand.surface,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  currencies: { flexDirection: "row", gap: 8 },
  currency: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.line,
  },
});
