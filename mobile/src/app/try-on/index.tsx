import { useLocalSearchParams } from "expo-router";
import { TryOnScreen } from "@/features/try-on/screens/TryOnScreen";

export default function TryOnRoute() {
  const { title, brand, price, url } = useLocalSearchParams<{
    title?: string;
    brand?: string;
    price?: string;
    url?: string;
  }>();
  return (
    <TryOnScreen
      product={{ title: title || "Ürün", brand, price, url }}
    />
  );
}
