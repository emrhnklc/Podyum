import { useLocalSearchParams } from "expo-router";
import { GameModeScreen } from "@/features/games/screens/GameModeScreen";

export default function GameModeRoute() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  return <GameModeScreen mode={mode === "sponsored" ? "sponsored" : "budget"} />;
}
