import { useLocalSearchParams } from "expo-router";
import { GameRoomScreen } from "@/features/games/screens/GameRoomScreen";

export default function GameRoute() {
  const { id, invite } = useLocalSearchParams<{
    id: string;
    invite?: string;
  }>();
  return <GameRoomScreen id={id} justCreated={invite === "1"} />;
}
