import type { DemoUser } from "../types";

export const users: DemoUser[] = [
  {
    username: "elifyz",
    displayName: "Elif Yılmaz",
    initials: "EY",
    bio: "Minimal dolap, vintage zaaf.",
    styles: ["Minimal", "Vintage", "Sokak stili"],
    counts: { polls: 2, friends: 312, stars: 1240 },
  },
  {
    username: "luis",
    displayName: "Luis",
    initials: "LU",
    avatar: "/demo/luis/5.jpg",
    styles: ["Sokak stili", "Vintage"],
    counts: { polls: 3, friends: 148, stars: 860 },
  },
  {
    username: "louno",
    displayName: "Louno",
    initials: "LO",
    avatar: "/demo/louno/3.jpg",
    styles: ["Sokak stili", "Oversize"],
    counts: { polls: 2, friends: 207, stars: 1015 },
  },
  {
    username: "hannas",
    displayName: "Hannas",
    initials: "HA",
    avatar: "/demo/hannas/2.jpg",
    styles: ["Şık", "Minimal"],
    counts: { polls: 1, friends: 96, stars: 430 },
  },
  {
    username: "melisdgn",
    displayName: "Melis Doğan",
    initials: "MD",
    styles: ["Vintage", "Sokak stili", "Renkli"],
    counts: { polls: 4, friends: 264, stars: 1830 },
  },
  {
    username: "denizktl",
    displayName: "Deniz Kuntal",
    initials: "DK",
    styles: ["Soft girl", "Minimal", "Kafe stili"],
    counts: { polls: 2, friends: 118, stars: 540 },
  },
  {
    username: "mertarsln",
    displayName: "Mert Arslan",
    initials: "MA",
    styles: ["Sokak stili", "Sneaker", "Oversize"],
    counts: { polls: 3, friends: 175, stars: 690 },
  },
  {
    username: "zeynepdemir",
    displayName: "Zeynep Demir",
    initials: "ZD",
    styles: ["Vintage", "Retro", "Renkli"],
    counts: { polls: 5, friends: 233, stars: 910 },
  },
  {
    username: "kaanyldz",
    displayName: "Kaan Yıldız",
    initials: "KY",
    styles: ["Klasik", "Minimal", "Smart casual"],
    counts: { polls: 1, friends: 87, stars: 320 },
  },
];

export function getUser(username: string): DemoUser | undefined {
  return users.find((u) => u.username === username);
}
