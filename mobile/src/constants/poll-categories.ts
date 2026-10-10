import type { Ionicons } from "@expo/vector-icons";

export type PollCategory =
  "OUTFIT" | "SHOES" | "BAG" | "JEWELRY" | "ACCESSORY" | "TATTOO";

export const CATEGORY_LABEL: Record<PollCategory, string> = {
  OUTFIT: "Kombin",
  SHOES: "Ayakkabı",
  BAG: "Çanta",
  JEWELRY: "Takı",
  ACCESSORY: "Aksesuar",
  TATTOO: "Dövme",
};

export const CATEGORY_ICON: Record<PollCategory, keyof typeof Ionicons.glyphMap> = {
  OUTFIT: "shirt-outline",
  SHOES: "footsteps-outline",
  BAG: "bag-handle-outline",
  JEWELRY: "diamond-outline",
  ACCESSORY: "glasses-outline",
  TATTOO: "brush-outline",
};
