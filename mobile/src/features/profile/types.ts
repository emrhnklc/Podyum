export type DemoUser = {
  username: string;
  displayName: string;
  initials: string;
  bio?: string;
  avatar?: string;
  styles: string[];
  counts: { polls: number; friends: number; stars: number };
};
