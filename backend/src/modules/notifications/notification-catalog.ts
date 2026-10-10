// Bildirim türleri tek yerde tanımlanır. Tür adı istemci sözleşmesidir; metni mobil üretir.
export type NotificationPreference = "friendRequestNotifications" | "pollResultNotifications" | "commentNotifications" | "gameNotifications";
export type NotificationTargetType = "USER" | "POLL" | "GAME";

interface NotificationDefinition {
  resourceType: "user" | "poll" | "game";
  // Ayar yalnız push'u kapatır; uygulama içi liste her zaman yazılır.
  preference: NotificationPreference;
  // null: yalnız uygulama içi. Metin kilit ekranında görünür; isim, soru veya yorum taşımaz.
  push: { body: string; ttlSeconds: number } | null;
}

const DAY = 86_400;

export const NOTIFICATIONS = {
  "friend.request.received": { resourceType: "user", preference: "friendRequestNotifications", push: { body: "Yeni bir arkadaşlık isteğin var.", ttlSeconds: DAY } },
  "friend.request.accepted": { resourceType: "user", preference: "friendRequestNotifications", push: { body: "Arkadaşlık isteğin kabul edildi.", ttlSeconds: DAY } },
  "poll.comment.received": { resourceType: "poll", preference: "commentNotifications", push: { body: "Paylaşımına yeni yorum geldi.", ttlSeconds: DAY } },
  "poll.result.own": { resourceType: "poll", preference: "pollResultNotifications", push: { body: "Oylaman sonuçlandı.", ttlSeconds: DAY } },
  "poll.result.voted": { resourceType: "poll", preference: "pollResultNotifications", push: null },
  "game.voting.opened": { resourceType: "game", preference: "gameNotifications", push: { body: "Oylama başladı. Fotoğrafları değerlendirme zamanı.", ttlSeconds: 1800 } },
  "game.completed": { resourceType: "game", preference: "gameNotifications", push: { body: "Oyunun sonuçları açıklandı.", ttlSeconds: DAY } },
} as const satisfies Record<string, NotificationDefinition>;

export type NotificationType = keyof typeof NOTIFICATIONS;
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATIONS) as NotificationType[];
export const PUSH_TITLE = "Podyum";

export const notificationDefinition = (type: string): NotificationDefinition | undefined =>
  (NOTIFICATIONS as Record<string, NotificationDefinition>)[type];

export const targetType = (resourceType: string): NotificationTargetType =>
  resourceType === "user" ? "USER" : resourceType === "game" ? "GAME" : "POLL";
