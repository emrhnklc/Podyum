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
// Öne çıkanlar, public/demo/ altında profil fotoğrafı ve paylaşımı olan demo hesaplardır.
export const featuredCreators: DemoPerson[] = [
  {
    username: "luis",
    tags: ["Sokak stili", "Vintage"],
    tone: "#E4E1DA",
    mutualFriends: 14,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "louno",
    tags: ["Sokak stili", "Oversize"],
    tone: "#E9D9D6",
    mutualFriends: 9,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "hannas",
    tags: ["Şık", "Minimal"],
    tone: "#DEDDD8",
    mutualFriends: 6,
    closeTaste: true,
    isNew: false,
  },
  {
    username: "cem",
    tags: ["Workwear", "Denim", "Vintage"],
    tone: "#D9DEE6",
    mutualFriends: 3,
    closeTaste: true,
    isNew: true,
  },
];

export const suggestedPeople: DemoPerson[] = [
  {
    username: "melisdgn",
    tags: ["Vintage", "Sokak stili", "Renkli"],
    tone: "#F3D2E2",
    mutualFriends: 21,
    closeTaste: true,
    isNew: true,
  },
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
