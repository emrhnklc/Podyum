import { createContext, useContext, useState, type ReactNode } from "react";
import { ME } from "@/constants/demo";
import { getUser } from "../data/demo-users";
import type { DemoUser } from "../types";

export type SocialLinks = { instagram: string; tiktok: string; youtube: string };

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
  if (!user || username !== ME) return { user, handle: user?.username, edits: {} };
  const { handle, cover, socials, ...fields } = edits;
  return {
    user: { ...user, ...fields },
    handle: handle ?? user.username,
    edits: { cover, socials },
  };
}
