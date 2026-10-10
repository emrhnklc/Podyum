import { useLocalSearchParams } from "expo-router";
import { CommentsScreen } from "@/features/polls/screens/CommentsScreen";
import { useAuth } from "@/features/auth/hooks/use-auth";
export default function CommentsRoute() {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  const { session } = useAuth();
  return <CommentsScreen key={`${session?.sessionId}:${pollId}`} pollId={pollId} />;
}
