import { useLocalSearchParams } from "expo-router";
import { PollDetailScreen } from "@/features/polls/screens/PollDetailScreen";

export default function PollRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PollDetailScreen id={id} />;
}
