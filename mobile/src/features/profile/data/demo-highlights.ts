import type { Ionicons } from "@expo/vector-icons";

// Profildeki öne çıkanlar için örnek başlıklar; gerçek hikâye/koleksiyon yok.
export type DemoHighlight = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
};

export const myHighlights: DemoHighlight[] = [
  { label: "Günlük", icon: "cafe-outline", tone: "#F1E2D6" },
  { label: "Seyahat", icon: "airplane-outline", tone: "#DDE6F1" },
  { label: "Kombinler", icon: "shirt-outline", tone: "#EADBC8" },
  { label: "Kahve", icon: "cafe", tone: "#E8D3C3" },
  { label: "Podyum", icon: "sparkles-outline", tone: "#F3D2E2" },
];

export const otherHighlights: DemoHighlight[] = [
  { label: "Kombinler", icon: "shirt-outline", tone: "#E2DDD4" },
  { label: "Seyahat", icon: "airplane-outline", tone: "#DDE6F1" },
  { label: "Spor", icon: "barbell-outline", tone: "#DCDDE6" },
  { label: "Davet", icon: "wine-outline", tone: "#EADBC8" },
  { label: "Ayna", icon: "camera-outline", tone: "#F1D6D6" },
];
