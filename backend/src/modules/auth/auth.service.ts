import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { ApiError } from "../../common/errors/api-error.js";
import { readEnvironment } from "../../common/config/environment.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { AUTH_RULES } from "./auth.constants.js";
import { hashPassword, verifyPassword, newToken, hashToken } from "./crypto.js";
import { LocalMailService } from "./local-mail.service.js";
import type { RegisterDto, LoginDto, MockLoginDto } from "./dto/auth.dto.js";

type Transaction = Prisma.TransactionClient;
const accepted = { status: "accepted" as const };
const invalidSession = () => new ApiError(401, "INVALID_SESSION", "Oturum geçersiz veya süresi dolmuş.");
const invalidAction = () => new ApiError(400, "INVALID_ACTION_TOKEN", "Bağlantı geçersiz, kullanılmış veya süresi dolmuş.");

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;
  constructor(private readonly prisma: PrismaService, private readonly mail: LocalMailService) {}

  providers() {
    const mock = readEnvironment().authMockEnabled;
    return {
      emailPassword: { available: true, emailDelivery: "local-only" },
      google: { available: mock, mode: mock ? "mock" : "unconfigured" },
      apple: { available: mock, mode: mock ? "mock" : "unconfigured" },
    };
  }

  private async lockUser(tx: Transaction, userId: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  }

  private checkActive(status: string) {
    if (status === "SUSPENDED") throw new ApiError(403, "ACCOUNT_SUSPENDED", "Hesap askıya alınmış.");
    if (status !== "ACTIVE") throw invalidSession();
  }

  private checkProvider(provider: string) {
    if (provider.startsWith("mock:") && !readEnvironment().authMockEnabled) throw invalidSession();
  }

  private async issueAction(tx: Transaction, userId: string, email: string, version: number, kind: "VERIFY_EMAIL" | "RESET_PASSWORD") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * (kind === "VERIFY_EMAIL" ? AUTH_RULES.verificationSeconds : AUTH_RULES.resetSeconds));
    const token = newToken();
    await tx.authActionToken.updateMany({ where: { userId, kind, consumedAt: null }, data: { consumedAt: now } });
    await tx.authActionToken.create({ data: { userId, kind, tokenHash: hashToken(token), credentialVersion: version, expiresAt } });
    // Yerel taşıyıcı. Dosya yazılamazsa transaction geri alınır; başarısız teslim kabul edilmez.
    await this.mail.deliver(email, kind, token, expiresAt, userId);
  }

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`register:${dto.email}`}, 0))`;
        if (await tx.authCredential.findUnique({ where: { email: dto.email } })) return accepted;
        const user = await tx.user.create({ data: {
          username: dto.username, displayName: dto.displayName, profileCompletedAt: new Date(),
          credential: { create: { email: dto.email, passwordHash } },
        } });
        await this.issueAction(tx, user.id, dto.email, 1, "VERIFY_EMAIL");
        return accepted;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ApiError(409, "USERNAME_UNAVAILABLE", "Bu kullanıcı adı kullanılamıyor.");
      }
      throw error;
    }
  }

  private async createSession(tx: Transaction, userId: string, provider: string) {
    const accessToken = newToken();
    const refreshToken = newToken();
    const now = Date.now();
    const accessExpiresAt = new Date(now + AUTH_RULES.accessSeconds * 1000);
    const expiresAt = new Date(now + AUTH_RULES.sessionSeconds * 1000);
    const session = await tx.authSession.create({ data: {
      userId, provider, accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken), accessExpiresAt, expiresAt,
    } });
    return { accessToken, refreshToken, tokenType: "Bearer" as const, accessExpiresAt, refreshExpiresAt: expiresAt, sessionId: session.id, mock: provider.startsWith("mock:") };
  }

  async login(dto: LoginDto) {
    const credential = await this.prisma.authCredential.findUnique({ where: { email: dto.email } });
    this.dummyHash ??= hashPassword(newToken());
    const valid = await verifyPassword(dto.password, credential?.passwordHash ?? await this.dummyHash);
    if (!credential || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı.");
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, credential.userId);
      const current = await tx.authCredential.findUnique({ where: { userId: credential.userId }, include: { user: true } });
      if (!current || current.version !== credential.version) throw new ApiError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı.");
      this.checkActive(current.user.status);
      if (!current.emailVerifiedAt) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Önce e-posta adresini doğrula.");
      return this.createSession(tx, current.userId, "email");
    });
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const session = await this.prisma.authSession.findUnique({ where: { accessTokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.accessExpiresAt.getTime() <= Date.now() || session.expiresAt.getTime() <= Date.now()) throw invalidSession();
    this.checkActive(session.user.status);
    this.checkProvider(session.provider);
    return { userId: session.userId, sessionId: session.id, provider: session.provider };
  }

  async refresh(token: string) {
    const tokenHash = hashToken(token);
    const found = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: tokenHash } });
    const used = found ? null : await this.prisma.usedRefreshToken.findUnique({ where: { tokenHash }, include: { session: true } });
    const original = found ?? used?.session;
    if (!original) throw invalidSession();
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, original.userId);
      const session = await tx.authSession.findUnique({ where: { id: original.id }, include: { user: true } });
      if (!session) throw invalidSession();
      this.checkActive(session.user.status);
      this.checkProvider(session.provider);
      if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw invalidSession();
      if (session.refreshTokenHash !== tokenHash) {
        // Kullanılmış refresh token yeniden sunuldu: bu cihazın tüm oturumu iptal edilir.
        await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        return null;
      }
      const accessToken = newToken();
      const refreshToken = newToken();
      const accessExpiresAt = new Date(Math.min(Date.now() + AUTH_RULES.accessSeconds * 1000, session.expiresAt.getTime()));
      await tx.usedRefreshToken.create({ data: { tokenHash, sessionId: session.id, expiresAt: session.expiresAt } });
      await tx.authSession.update({ where: { id: session.id }, data: {
        accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken), accessExpiresAt,
      } });
      return { accessToken, refreshToken, tokenType: "Bearer" as const, accessExpiresAt, refreshExpiresAt: session.expiresAt, sessionId: session.id, mock: session.provider.startsWith("mock:") };
    });
    if (!result) throw invalidSession();
    return result;
  }

  async logout(user: AuthenticatedUser, all: boolean) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, user.userId);
      await tx.authSession.updateMany({ where: { userId: user.userId, ...(all ? {} : { id: user.sessionId }), revokedAt: null }, data: { revokedAt: new Date() } });
      // Çıkış yapılan oturumun cihazı artık bu hesap adına push almaz.
      await tx.deviceToken.deleteMany({ where: { userId: user.userId, ...(all ? {} : { sessionId: user.sessionId }) } });
    });
    return { status: "ok" as const };
  }

  async me(user: AuthenticatedUser) {
    const { profileCompletedAt, ...profile } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { id: true, username: true, displayName: true, createdAt: true, profileCompletedAt: true } });
    return { user: profile, session: { id: user.sessionId, provider: user.provider, mock: user.provider.startsWith("mock:") }, profileSetupRequired: profileCompletedAt === null };
  }

  async requestAction(email: string, kind: "VERIFY_EMAIL" | "RESET_PASSWORD") {
    const credential = await this.prisma.authCredential.findUnique({ where: { email }, select: { userId: true } });
    if (!credential) return accepted;
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, credential.userId);
      const current = await tx.authCredential.findUnique({ where: { userId: credential.userId }, include: { user: true } });
      if (!current || current.user.status !== "ACTIVE" || (kind === "VERIFY_EMAIL" ? current.emailVerifiedAt !== null : current.emailVerifiedAt === null)) return;
      await this.issueAction(tx, current.userId, current.email, current.version, kind);
    });
    return accepted;
  }

  async consumeAction(token: string, kind: "VERIFY_EMAIL" | "RESET_PASSWORD", password?: string) {
    const tokenHash = hashToken(token);
    const original = await this.prisma.authActionToken.findUnique({ where: { tokenHash } });
    if (!original || original.kind !== kind || original.consumedAt || original.expiresAt.getTime() <= Date.now()) throw invalidAction();
    const passwordHash = password === undefined ? undefined : await hashPassword(password);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, original.userId);
      const action = await tx.authActionToken.findUnique({ where: { tokenHash } });
      const credential = action ? await tx.authCredential.findUnique({ where: { userId: action.userId }, include: { user: true } }) : null;
      if (!action || !credential || action.consumedAt || action.expiresAt.getTime() <= Date.now() || action.credentialVersion !== credential.version) throw invalidAction();
      this.checkActive(credential.user.status);
      const now = new Date();
      await tx.authActionToken.updateMany({ where: { userId: action.userId, ...(kind === "VERIFY_EMAIL" ? { kind } : {}), consumedAt: null }, data: { consumedAt: now } });
      if (kind === "VERIFY_EMAIL") {
        await tx.authCredential.update({ where: { userId: action.userId }, data: { emailVerifiedAt: now } });
      } else {
        if (!passwordHash) throw invalidAction();
        await tx.authCredential.update({ where: { userId: action.userId }, data: { passwordHash, version: { increment: 1 } } });
        await tx.authSession.updateMany({ where: { userId: action.userId, revokedAt: null }, data: { revokedAt: now } });
      }
      return { status: "ok" as const };
    });
  }

  async mockLogin(dto: MockLoginDto) {
    if (!readEnvironment().authMockEnabled) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Kaynak bulunamadı.");
    const issuer = `mock:${dto.provider}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${issuer}:${dto.subject}`}, 0))`;
      let identity = await tx.authIdentity.findUnique({ where: { issuer_subject: { issuer, subject: dto.subject } }, include: { user: true } });
      if (!identity) {
        identity = await tx.authIdentity.create({ data: {
          issuer, subject: dto.subject,
          user: { create: { username: `mock_${randomUUID().replaceAll("-", "").slice(0, 20)}`, displayName: `${dto.provider === "google" ? "Google" : "Apple"} Test` } },
        }, include: { user: true } });
      }
      await this.lockUser(tx, identity.userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: identity.userId } });
      this.checkActive(user.status);
      return this.createSession(tx, identity.userId, issuer);
    });
  }
}
