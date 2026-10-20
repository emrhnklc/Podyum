import { useLocalSearchParams } from "expo-router";
import { CatalogProductScreen } from "@/features/catalog/screens/CatalogProductScreen";
export default function CatalogProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CatalogProductScreen key={id} id={id} />;
}
