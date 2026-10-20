import { router } from "expo-router";

export type Relationship =
  "SELF" | "NONE" | "OUTGOING_REQUEST" | "INCOMING_REQUEST" | "FRIENDS";
export type SocialUser = { id: string; username: string; displayName: string };
export type SocialItem = {
  user: SocialUser;
  relationship: Relationship;
  createdAt: string;
};
export type SocialPage = { items: SocialItem[]; nextCursor: string | null };

export function openUser(user: SocialUser) {
  router.push({
    pathname: "/u/[username]",
    params: { username: user.username, id: user.id },
  });
}
