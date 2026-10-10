import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit } from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import { readEnvironment } from "../../common/config/environment.js";
import { ApiError } from "../../common/errors/api-error.js";
import { OutboxRegistry } from "../../common/outbox/outbox-dispatcher.js";
import type { OutboxHandler } from "../../common/outbox/outbox.types.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { OutboxEvent } from "../../generated/prisma/client.js";
import { AuthService } from "../auth/auth.service.js";
import { GameAccessService } from "./game-access.service.js";
import { GamesService } from "./games.service.js";

export const GAME_REALTIME_LIMITS = Object.freeze({ connectionsPerUser: 5, subscriptionsPerConnection: 5, messagesPerWindow: 30, windowMs: 10_000, sweepMs: 15_000 });
const GAME_EVENTS = ["game.created", "game.settings.changed", "game.invite.rotated", "game.invite.revoked", "game.member.joined", "game.member.left",
  "game.submission.opened", "game.submission.accepted", "game.voting.opened", "game.rating.cast", "game.completed", "game.cancelled"];
type Client = Socket<any, any, any, { token: string; user: AuthenticatedUser; subscriptions: Set<string>; busy: boolean; windowAt: number; messages: number }>;
type Ack = (value: unknown) => void;
const isDenied = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.getStatus());
const failure = (error: unknown) => ({ ok: false, error: error instanceof ApiError
  ? error.getResponse() : { code: "SERVICE_UNAVAILABLE", message: "Canlı bağlantı geçici olarak kullanılamıyor; tekrar dene." } });

function sessionId(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("sessionId" in body)
    || typeof body.sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessionId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Yalnız geçerli sessionId gönderilmeli.");
  }
  return body.sessionId.toLowerCase();
}

// HTTP komutları tek yazma yoludur. Socket yalnız kişisel snapshot ve yenileme
// sinyali taşır. Broadcast room kullanılmaz: her alıcının erişimi tekrar okunur.
@WebSocketGateway({ namespace: "/games", transports: ["websocket"], maxHttpBufferSize: 16 * 1024,
  allowRequest: (request: { headers: { origin?: string } }, done: (error: string | null, allowed: boolean) => void) => {
    const origin = request.headers.origin;
    done(null, !origin || readEnvironment().corsOrigins.includes(origin));
  },
})
export class GameRealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy, OutboxHandler {
  readonly name = "game-realtime";
  readonly types = [...GAME_EVENTS, "social.relationship.changed", "user.status.changed"];
  private readonly logger = new Logger(GameRealtimeGateway.name);
  private readonly clients = new Set<Client>();
  private readonly subscriptions = new Map<string, Set<Client>>();
  private readonly pending = new Set<Promise<void>>();
  private timer?: ReturnType<typeof setInterval>;
  private sweeping?: Promise<void>;
  private stopping = false;

  constructor(private readonly auth: AuthService, private readonly games: GamesService, private readonly access: GameAccessService,
    private readonly prisma: PrismaService, private readonly registry: OutboxRegistry) {}

  onModuleInit() {
    this.registry.register(this);
    if (readEnvironment().nodeEnv !== "test") {
      this.timer = setInterval(() => { void this.sweep().catch(() => this.logger.error("Canlı erişim kontrolü başarısız; sonraki turda tekrar denenecek.")); }, GAME_REALTIME_LIMITS.sweepMs);
      this.timer.unref();
    }
  }

  afterInit(server: Namespace) {
    server.use(async (socket: Client, next) => {
      try {
        const token: unknown = socket.handshake.auth?.accessToken;
        if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, "AUTH_REQUIRED", "Geçerli bir oturum gerekli.");
        const user = await this.auth.authenticate(token);
        if (this.stopping) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Sunucu kapanıyor.");
        socket.data = { token, user, subscriptions: new Set(), busy: false, windowAt: Date.now(), messages: 0 };
        socket.handshake.auth = {};
        next();
      } catch (error) {
        const result = failure(error);
        next(Object.assign(new Error("Canlı bağlantı kurulamadı."), { data: result.error }));
      }
    });
  }

  handleConnection(socket: Client) {
    const count = [...this.clients].filter((client) => client.data.user.userId === socket.data.user.userId).length;
    if (count >= GAME_REALTIME_LIMITS.connectionsPerUser) {
      socket.emit("game.error", { code: "CONNECTION_LIMIT", message: "Çok fazla canlı bağlantı açık." }); socket.disconnect(true); return;
    }
    this.clients.add(socket);
    // Bu iki protokol mesajı HTTP guard/pipeline'ına girmez; run oturumu,
    // sessionId doğrulaması gövdeyi, GamesService ise üyelik ve engeli denetler.
    socket.on("game.subscribe", (body: unknown, ack?: Ack) => this.run(socket, ack, async () => {
      const id = sessionId(body);
      if (!socket.data.subscriptions.has(id) && socket.data.subscriptions.size >= GAME_REALTIME_LIMITS.subscriptionsPerConnection) {
        throw new ApiError(429, "SUBSCRIPTION_LIMIT", "Çok fazla oyun aboneliği açık.");
      }
      await this.games.get(socket.data.user.userId, id);
      if (!socket.connected) return null;
      const listeners = this.subscriptions.get(id) ?? new Set<Client>();
      listeners.add(socket); this.subscriptions.set(id, listeners); socket.data.subscriptions.add(id);
      try {
        // Kayıt ile ilk snapshot arasındaki değişikliği kaçırmamak için tekrar
        // oku. Daha eski canlı sinyal snapshot'ın version'ıyla elenir.
        return { state: await this.games.get(socket.data.user.userId, id) };
      } catch (error) { this.remove(socket, id); throw error; }
    }));
    socket.on("game.unsubscribe", (body: unknown, ack?: Ack) => this.run(socket, ack, async () => {
      const id = sessionId(body); this.remove(socket, id); return { sessionId: id };
    }));
  }

  private run(socket: Client, ack: Ack | undefined, action: () => Promise<unknown>) {
    if (this.stopping || !socket.connected) return;
    const reply = (value: unknown) => { if (socket.connected && typeof ack === "function") ack(value); };
    if (Date.now() - socket.data.windowAt >= GAME_REALTIME_LIMITS.windowMs) { socket.data.windowAt = Date.now(); socket.data.messages = 0; }
    if (++socket.data.messages > GAME_REALTIME_LIMITS.messagesPerWindow || socket.data.busy) {
      reply(failure(new ApiError(429, "RATE_LIMITED", "Biraz bekleyip tekrar dene."))); return;
    }
    socket.data.busy = true;
    const operation = (async () => {
      try {
        if (!await this.authenticate(socket)) return;
        const data = await action();
        if (await this.authenticate(socket)) reply({ ok: true, data });
      } catch (error) { reply(failure(error)); }
      finally { socket.data.busy = false; }
    })();
    this.pending.add(operation); void operation.finally(() => this.pending.delete(operation));
  }

  private remove(socket: Client, id: string) {
    socket.data.subscriptions.delete(id);
    const listeners = this.subscriptions.get(id); listeners?.delete(socket);
    if (listeners?.size === 0) this.subscriptions.delete(id);
  }

  handleDisconnect(socket: Client) {
    for (const id of socket.data.subscriptions ?? []) this.remove(socket, id);
    this.clients.delete(socket);
  }

  private async authenticate(socket: Client) {
    if (!socket.connected || this.stopping) return false;
    try { await this.auth.authenticate(socket.data.token); return socket.connected; }
    catch (error) {
      if (!isDenied(error)) throw error;
      socket.emit("game.error", failure(error).error); socket.disconnect(true); return false;
    }
  }

  private async visible(socket: Client, id: string) {
    const session = await this.prisma.gameSession.findFirst({ where: { id, ...this.access.visibleSessionWhere(socket.data.user.userId) }, select: { version: true } });
    if (!session && socket.data.subscriptions.has(id)) {
      this.remove(socket, id); socket.emit("game.access-revoked", { sessionId: id });
    }
    return session;
  }

  async deliver(event: OutboxEvent) {
    if (event.type === "social.relationship.changed" || event.type === "user.status.changed") { await this.sweep(); return; }
    if (event.aggregateType !== "game-session" || !GAME_EVENTS.includes(event.type)) return;
    const id = event.aggregateId;
    const listeners = this.subscriptions.get(id);
    if (!listeners?.size) return;
    const [{ now }] = await this.prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    for (const socket of [...listeners]) {
      if (!await this.authenticate(socket)) continue;
      const current = await this.visible(socket, id);
      if (!current || !socket.connected || !socket.data.subscriptions.has(id)) continue;
      // Payload veya eski olayın phase/version'ı yayınlanmaz. Aynı kaynak olay
      // tekrar gelse de istemci güncel sürümü yeniden okuyabilir.
      socket.emit("game.changed", { eventId: event.id, sessionId: id, version: current.version, serverNow: now.toISOString() });
    }
  }

  sweep(): Promise<void> {
    if (this.sweeping) return this.sweeping;
    this.sweeping = (async () => {
      for (const socket of [...this.clients]) {
        if (!await this.authenticate(socket)) continue;
        for (const id of [...socket.data.subscriptions]) await this.visible(socket, id);
      }
    })().finally(() => { this.sweeping = undefined; });
    return this.sweeping;
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    for (const client of [...this.clients]) client.disconnect(true);
    await Promise.allSettled([...this.pending, ...(this.sweeping ? [this.sweeping] : [])]);
  }
}
