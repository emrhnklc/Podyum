import { router, useLocalSearchParams } from "expo-router";
import {
  FollowListScreen,
  type FollowKind,
} from "@/features/people/screens/FollowListScreen";

export default function FollowsRoute() {
  const { userId, kind } = useLocalSearchParams<{
    userId: string;
    kind?: FollowKind;
  }>();
  return (
    <FollowListScreen
      key={`${userId}:${kind}`}
      userId={userId}
      kind={kind === "following" ? "following" : "followers"}
      onKind={(next) => router.setParams({ kind: next })}
    />
  );
}
