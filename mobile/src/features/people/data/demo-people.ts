import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type PeopleFilter = "CLOSE" | "NEW" | "Vintage" | "Minimal" | "Sokak stili";

export const PEOPLE_FILTERS: {
  value: PeopleFilter;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  { value: "CLOSE", label: "Yakın zevkler", icon: "people" },
  { value: "NEW", label: "Yeni", icon: "sparkles-outline" },
  { value: "Vintage", label: "Vintage", icon: "shirt-outline" },
  { value: "Minimal", label: "Minimal", icon: "leaf-outline" },
  { value: "Sokak stili", label: "Sokak stili", icon: "footsteps-outline" },
];

export type DemoPerson = {
  username: string;
  tags: string[];
  tone: string;
  mutualFriends: number;
  closeTaste: boolean;
  isNew: boolean;
};

// Önizleme listesi; gerçek öneri/arkadaşlık API bağlantısı adımında gelecek.
export const featuredCreators: DemoPerson[] = [
  {
    username: "elifyz",
    tags: ["Minimal", "Klasik", "Kahve tonları"],
    tone: "#EBD9CF",
    mutualFriends: 0,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "melisdgn",
    tags: ["Vintage", "Sokak stili", "Renkli"],
    tone: "#F3D2E2",
    mutualFriends: 21,
    closeTaste: true,
    isNew: true,
  },
];

export const suggestedPeople: DemoPerson[] = [
  {
    username: "denizktl",
    tags: ["Soft girl", "Minimal", "Kafe stili"],
    tone: "#F2DCD3",
    mutualFriends: 12,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "mertarsln",
    tags: ["Sokak stili", "Sneaker", "Oversize"],
    tone: "#DCDDE6",
    mutualFriends: 8,
    closeTaste: true,
    isNew: true,
  },
  {
    username: "zeynepdemir",
    tags: ["Vintage", "Retro", "Renkli"],
    tone: "#F1D6D6",
    mutualFriends: 15,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "kaanyldz",
    tags: ["Klasik", "Minimal", "Smart casual"],
    tone: "#E2DDD4",
    mutualFriends: 9,
    closeTaste: true,
    isNew: true,
  },
];
