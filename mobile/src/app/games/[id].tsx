import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { GameRoomScreen } from "@/features/games/screens/GameRoomScreen";

export default function GameRoute() {
  const { session } = useAuth();
  const { id, invite } = useLocalSearchParams<{
    id: string;
    invite?: string;
  }>();
  return (
    <GameRoomScreen
      key={`${session?.sessionId}:${id}`}
      id={id}
      justCreated={invite === "1"}
    />
  );
}
