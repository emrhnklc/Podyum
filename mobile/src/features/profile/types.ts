export type DemoUser = {
  username: string;
  displayName: string;
  initials: string;
  bio?: string;
  // Profil başlığındaki örnek konum ve onay rozeti.
  location?: string;
  verified?: boolean;
  avatar?: string;
  styles: string[];
  counts: {
    polls: number;
    friends: number;
    stars: number;
    // Başkasının profilinde gösterilen örnek takipçi/takip sayıları.
    followers: number;
    following: number;
  };
};
