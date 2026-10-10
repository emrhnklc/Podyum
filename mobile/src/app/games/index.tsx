import { Redirect } from "expo-router";

// Eski /games bağlantıları Defile sekmesine yönlenir.
export default function GamesRedirect() {
  return <Redirect href="/defile" />;
}
