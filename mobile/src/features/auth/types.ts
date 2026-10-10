export type Session = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  sessionId: string;
  tokenType: "Bearer";
  mock: boolean;
};
export type AuthMe = {
  user: { id: string; username: string; displayName: string; createdAt: string };
  session: { id: string; provider: string; mock: boolean };
  profileSetupRequired: boolean;
};
