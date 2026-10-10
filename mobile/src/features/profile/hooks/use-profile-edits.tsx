import { createContext, useContext, useState, type ReactNode } from "react";
import { ME } from "@/constants/demo";
import { getUser } from "../data/demo-users";
import type { DemoUser } from "../types";

export type SocialLinks = {
  instagram: string;
  tiktok: string;
  youtube: string;
};

// Profili Düzenle'de değişebilen alanlar.
export type ProfileEdits = Partial<
  Pick<DemoUser, "displayName" | "bio" | "location" | "styles" | "avatar">
> & {
  handle?: string;
  cover?: string;
  socials?: SocialLinks;
};

type State = { edits: ProfileEdits; save: (edits: ProfileEdits) => void };
const Context = createContext<State | null>(null);

// Yalnız önizleme: düzenlemeler bellekte tutulur, yeniden açılınca sıfırlanır.
// Kullanıcı adı yalnız görünen tanıtıcıyı değiştirir; rota anahtarı ME kalır.
export function ProfileEditsProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<ProfileEdits>({});
  const save = (next: ProfileEdits) =>
    setEdits((previous) => ({ ...previous, ...next }));
  return (
    <Context.Provider value={{ edits, save }}>{children}</Context.Provider>
  );
}

export function useProfileEdits() {
  const context = useContext(Context);
  if (!context) throw new Error("ProfileEditsProvider gerekli.");
  return context;
}

// Demo kullanıcıyı, kendi profilinse kaydedilen düzenlemelerle birleştirir.
export function useProfileUser(username: string) {
  const { edits } = useProfileEdits();
  const user = getUser(username);
  if (!user || username !== ME)
    return { user, handle: user?.username, edits: {} };
  const { handle, cover, socials, ...fields } = edits;
  const initials = fields.displayName
    ? initialsOf(fields.displayName)
    : user.initials;
  return {
    user: { ...user, ...fields, initials },
    handle: handle ?? user.username,
    edits: { cover, socials },
  };
}

// "Deniz Kaya" → "DK"; tek kelimede ilk iki harf.
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : words[0].slice(0, 2);
  return letters.toLocaleUpperCase("tr");
}
