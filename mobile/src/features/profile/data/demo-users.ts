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
];

export function getUser(username: string): DemoUser | undefined {
  return users.find((u) => u.username === username);
}
