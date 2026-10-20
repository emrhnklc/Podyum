import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "@/features/profile/screens/ProfileScreen";

export default function UserRoute() {
  const { username, id } = useLocalSearchParams<{
    username: string;
    id?: string;
  }>();
  return (
    <ProfileScreen
      key={`${username}:${id ?? ""}`}
      username={username}
      userId={id}
    />
  );
}
