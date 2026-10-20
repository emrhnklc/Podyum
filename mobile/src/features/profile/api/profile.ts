export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarMediaId: string | null;
  avatarPath: string | null;
  styles: { id: string; label: string }[];
  counts: { polls: number; friends: number; stars: number };
};
export type MyProfile = {
  profile: PublicProfile;
  profileSetupRequired: boolean;
};

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : words[0].slice(0, 2)
  ).toLocaleUpperCase("tr");
}
