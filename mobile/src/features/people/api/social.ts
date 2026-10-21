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
// Takip arkadaşlıktan ayrıdır; FRIENDS paylaşımlarını açmaz.
export type FollowItem = {
  user: SocialUser;
  followedAt: string;
  isFollowing: boolean;
  isSelf: boolean;
};
export type FollowReceipt = {
  userId: string;
  isFollowing: boolean;
  followerCount: number;
};
export type RelationshipDetail = {
  userId: string;
  state: Relationship;
  isFollowing: boolean;
  followsYou: boolean;
};

export function openUser(user: SocialUser) {
  router.push({
    pathname: "/u/[username]",
    params: { username: user.username, id: user.id },
  });
}
