import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "@/features/profile/screens/ProfileScreen";

export default function UserRoute() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ProfileScreen username={username} />;
}
