import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type {} from "multer";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { MediaAsset, Prisma } from "../../generated/prisma/client.js";
import { SocialAccessService } from "../social/social-access.service.js";
import type { CompleteMediaDto, CreateUploadDto } from "./dto/media.dto.js";
import { ImageProcessor } from "./image-processor.service.js";
import { LocalMediaStorage } from "./local-media-storage.service.js";
import { MEDIA_LIMITS } from "./media.constants.js";

const missing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Fotoğraf bulunamadı.");
const conflict = (code: string, message: string) => new ApiError(409, code, message);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
type Tx = Prisma.TransactionClient;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, private readonly storage: LocalMediaStorage,
    private readonly images: ImageProcessor, private readonly access: SocialAccessService) {}

  private response(asset: MediaAsset) {
    return {
      id: asset.id, purpose: asset.purpose, status: asset.status, blurRequested: asset.blurRequested,
      mimeType: asset.mimeType, byteSize: asset.byteSize, width: asset.width, height: asset.height,
      uploaded: asset.sourceVersion !== null, rejectionCode: asset.rejectionCode,
      previewAcceptedAt: asset.previewAcceptedAt, createdAt: asset.createdAt, updatedAt: asset.updatedAt,
      displayPath: asset.status === "READY" ? `/v1/media/${asset.id}/content` : null,
      thumbnailPath: asset.status === "READY" ? `/v1/media/${asset.id}/content?variant=thumbnail` : null,
    };
  }

  private async owned(tx: Tx, userId: string, id: string, lock = false) {
    if (lock) await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const asset = await tx.mediaAsset.findFirst({ where: { id, ownerId: userId, status: { not: "DELETED" } } });
    if (!asset) throw missing();
    return asset;
  }

  async createUpload(userId: string, dto: CreateUploadDto) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MEDIA_LIMITS.uploadMinutes * 60_000);
    const asset = await this.prisma.$transaction(async (tx) => {
      // Aynı hesabın eşzamanlı izin talepleri kotayı atlayamaz.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, settings: { select: { defaultBlurFace: true } } } });
      if (user?.status !== "ACTIVE") throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
      const active = await tx.mediaAsset.count({ where: { ownerId: userId, OR: [
        { status: "PENDING_UPLOAD", uploadExpiresAt: { gt: now } }, { status: "PROCESSING" },
      ] } });
      const daily = await tx.mediaAsset.count({ where: { ownerId: userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
      if (active >= MEDIA_LIMITS.activeUploads || daily >= MEDIA_LIMITS.dailyUploads) {
        throw new ApiError(429, "MEDIA_QUOTA_EXCEEDED", "Fotoğraf yükleme sınırına ulaştın; daha sonra tekrar dene.");
      }
      const id = randomUUID();
      return tx.mediaAsset.create({ data: {
        id, ownerId: userId, purpose: dto.purpose, uploadKey: `${id}/source.bin`,
        uploadTokenHash: sha256(token), uploadExpiresAt: expiresAt,
        declaredMimeType: dto.mimeType, declaredByteSize: dto.byteSize,
        blurRequested: dto.blurRequested ?? user.settings?.defaultBlurFace ?? true,
      } });
    });
    return { asset: this.response(asset), upload: {
      method: "POST" as const, path: `/v1/media/${asset.id}/upload`, token, expiresAt,
      field: "file" as const, maxBytes: MEDIA_LIMITS.maxBytes,
    } };
  }

  private checkGrant(asset: MediaAsset, token: unknown) {
    if (asset.status !== "PENDING_UPLOAD" || asset.sourceVersion) throw conflict("MEDIA_IMMUTABLE", "Bu yükleme tamamlandı veya artık kullanılamaz; yeni yükleme oluştur.");
    if (!asset.uploadExpiresAt || asset.uploadExpiresAt <= new Date()) throw conflict("UPLOAD_EXPIRED", "Yükleme izninin süresi doldu; yeni yükleme oluştur.");
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) || !asset.uploadTokenHash
      || !timingSafeEqual(Buffer.from(sha256(token)), Buffer.from(asset.uploadTokenHash))) {
      throw new ApiError(403, "INVALID_UPLOAD_TOKEN", "Geçerli yükleme izni gerekli.");
    }
  }

  async requireUploadGrant(userId: string, id: string, token: unknown) {
    const asset = await this.owned(this.prisma, userId, id);
    this.checkGrant(asset, token);
  }

  async upload(userId: string, id: string, token: unknown, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new ApiError(400, "FILE_REQUIRED", "file alanında bir fotoğraf gönder.");
    let written = false;
    let key: string | undefined;
    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const row = await this.owned(tx, userId, id, true);
        this.checkGrant(row, token);
        if (file.size > MEDIA_LIMITS.maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Fotoğraf en fazla 10 MiB olabilir.");
        if (file.size !== row.declaredByteSize || file.mimetype !== row.declaredMimeType) {
          throw new ApiError(400, "UPLOAD_METADATA_MISMATCH", "Dosya boyutu ve türü yükleme izniyle aynı olmalı.");
        }
        key = row.uploadKey;
        await this.storage.write(key, file.buffer);
        written = true;
        return tx.mediaAsset.update({ where: { id }, data: {
          sourceVersion: randomUUID(), checksum: sha256(file.buffer), byteSize: file.size,
          mimeType: file.mimetype, uploadTokenHash: null,
        } });
      });
      return this.response(asset);
    } catch (error) {
      if (written && key) await this.storage.remove(key);
      throw error;
    }
  }

  async get(userId: string, id: string) { return this.response(await this.owned(this.prisma, userId, id)); }

  async complete(userId: string, id: string, dto: CompleteMediaDto) {
    const regions = dto.blurRegions ?? [];
    for (const region of regions) {
      if (region.x + region.width > 1 || region.y + region.height > 1) throw new ApiError(400, "INVALID_BLUR_REGION", "Bölge fotoğraf sınırları içinde olmalı.");
    }
    const hash = sha256(JSON.stringify({ regions, confirmNoFaces: dto.confirmNoFaces ?? false }));
    const claimed = await this.prisma.$transaction(async (tx) => {
      const asset = await this.owned(tx, userId, id, true);
      if (asset.status === "READY" || asset.status === "PROCESSING") {
        if (asset.processingRequestHash !== hash) throw conflict("MEDIA_IMMUTABLE", "İşlenen fotoğraf değiştirilemez; yeni yükleme oluştur.");
        return { asset, process: false };
      }
      if (!asset.sourceVersion) throw conflict("UPLOAD_REQUIRED", "Önce dosyayı yükle.");
      if (asset.blurRequested && regions.length === 0 && dto.confirmNoFaces !== true) {
        throw new ApiError(400, "BLUR_REGIONS_REQUIRED", "Yüz bölgelerini seç veya fotoğrafta yüz olmadığını doğrula.");
      }
      if ((!asset.blurRequested && regions.length > 0) || (regions.length > 0 && dto.confirmNoFaces === true)) {
        throw new ApiError(400, "INVALID_BLUR_OPTIONS", "Bulanıklaştırma tercihlerini kontrol et.");
      }
      const saved = await tx.mediaAsset.update({ where: { id }, data: {
        status: "PROCESSING", rejectionCode: null, processingRequestHash: hash,
        processingRevision: { increment: 1 }, previewAcceptedAt: null,
      } });
      return { asset: saved, process: true };
    });
    if (!claimed.process) return this.response(claimed.asset);
    const asset = claimed.asset;
    const displayKey = `${id}/display-${asset.processingRevision}-${randomUUID()}.webp`;
    const thumbnailKey = `${id}/thumbnail-${asset.processingRevision}-${randomUUID()}.webp`;
    const writtenKeys: string[] = [];
    let committed = false;
    try {
      const source = await this.storage.read(asset.uploadKey);
      if (sha256(source) !== asset.checksum) throw new ApiError(422, "SOURCE_CHECKSUM_MISMATCH", "Fotoğraf bütünlüğü doğrulanamadı; yeni yükleme oluştur.");
      await this.images.inspect(source, asset.declaredMimeType!);
      const output = await this.images.process(source, asset.purpose, regions);
      await this.storage.write(displayKey, output.display);
      writtenKeys.push(displayKey);
      await this.storage.write(thumbnailKey, output.thumbnail);
      writtenKeys.push(thumbnailKey);
      const saved = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.mediaAsset.updateMany({ where: { id, status: "PROCESSING", processingRevision: asset.processingRevision }, data: {
          status: "READY", displayKey, thumbnailKey, width: output.width, height: output.height, rejectionCode: null,
        } });
        if (updated.count !== 1) throw conflict("MEDIA_STATE_CHANGED", "Fotoğrafın durumu değişti; yeniden kontrol et.");
        return tx.mediaAsset.findUniqueOrThrow({ where: { id } });
      });
      committed = true;
      return this.response(saved);
    } catch (error) {
      const code = error instanceof ApiError ? (error.getResponse() as { code: string }).code : "MEDIA_PROCESSING_FAILED";
      await this.prisma.mediaAsset.updateMany({ where: { id, status: "PROCESSING", processingRevision: asset.processingRevision }, data: { status: "REJECTED", rejectionCode: code } });
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "MEDIA_PROCESSING_FAILED", "Fotoğraf işlenemedi; yeniden dene.");
    } finally {
      if (!committed) for (const key of writtenKeys) await this.storage.remove(key);
    }
  }

  async acceptPreview(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.owned(tx, userId, id, true);
      if (row.status !== "READY") throw conflict("MEDIA_NOT_READY", "Önce fotoğrafın işlenmesi tamamlanmalı.");
      if (row.previewAcceptedAt) return this.response(row);
      return this.response(await tx.mediaAsset.update({ where: { id }, data: { previewAcceptedAt: new Date() } }));
    });
  }

  // Oylama yayını aynı transaction içinde bunu çağırıp PollOption ilişkisini kurmalı.
  async requirePublishableAsset(tx: Tx, userId: string, id: string, purpose: "POLL" | "AVATAR" = "POLL") {
    const row = await this.owned(tx, userId, id, true);
    if (row.purpose !== purpose) throw conflict("MEDIA_PURPOSE_MISMATCH", "Fotoğrafın kullanım amacı uygun değil.");
    if (row.status !== "READY" || !row.previewAcceptedAt || !row.displayKey || !row.thumbnailKey) {
      throw conflict("MEDIA_NOT_APPROVED", "İşlenmiş fotoğrafın önizlemesini onayla.");
    }
    return row;
  }

  async content(viewerId: string, id: string, variant: "display" | "thumbnail" = "display") {
    const key = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.findFirst({ where: { id, status: "READY" } });
      if (!asset) throw missing();
      await this.access.requireUserAccess(tx, viewerId, asset.ownerId);
      if (asset.ownerId !== viewerId) {
        if (!asset.previewAcceptedAt) throw missing();
        if (asset.purpose === "AVATAR") {
          const linked = await tx.user.count({ where: { id: asset.ownerId, avatarMediaId: id } });
          if (!linked) throw missing();
        } else {
          const linked = await tx.pollOption.count({ where: { mediaId: id, poll: this.access.visiblePublishedPollWhere(viewerId) } });
          if (!linked) throw missing();
        }
      }
      const key = variant === "thumbnail" ? asset.thumbnailKey : asset.displayKey;
      if (!key) throw missing();
      return key;
    }, { isolationLevel: "RepeatableRead" });
    try { return await this.storage.read(key); }
    catch { throw new ApiError(503, "MEDIA_CONTENT_UNAVAILABLE", "Fotoğraf dosyası şu anda kullanılamıyor."); }
  }

  async setAvatar(userId: string, mediaId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.requirePublishableAsset(tx, userId, mediaId, "AVATAR");
      await tx.user.update({ where: { id: userId, status: "ACTIVE" }, data: { avatarMediaId: mediaId } });
    });
    return { avatarMediaId: mediaId, avatarPath: `/v1/media/${mediaId}/content` };
  }

  async removeAvatar(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarMediaId: null } });
    return { avatarMediaId: null, avatarPath: null };
  }

  private async referenced(tx: Tx, id: string) {
    return (await tx.pollOption.count({ where: { mediaId: id } })) > 0
      || (await tx.gameEntry.count({ where: { mediaId: id } })) > 0
      || (await tx.user.count({ where: { avatarMediaId: id } })) > 0;
  }

  async delete(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const asset = await tx.mediaAsset.findFirst({ where: { id, ownerId: userId } });
      if (!asset) throw missing();
      if (await this.referenced(tx, id)) throw conflict("MEDIA_IN_USE", "Fotoğraf bir içerikte veya avatarında kullanılıyor; önce bağlantısını kaldır.");
      if (asset.status !== "DELETED") await tx.mediaAsset.update({ where: { id }, data: { status: "DELETED", uploadTokenHash: null, processingRevision: { increment: 1 } } });
    });
    // Tombstone önce yazılır. Disk hatasında erişim kapalı kalır, cleanup tekrar dener.
    await this.storage.removeAssetDirectory(id);
    await this.prisma.mediaAsset.update({ where: { id }, data: { filesPurgedAt: new Date() } });
    return { deleted: true };
  }

  async cleanup(now = new Date()) {
    const old = new Date(now.getTime() - MEDIA_LIMITS.unreferencedHours * 3_600_000);
    const stuck = new Date(now.getTime() - MEDIA_LIMITS.processingTimeoutMinutes * 60_000);
    const timedOut = await this.prisma.mediaAsset.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: stuck } }, data: {
      status: "REJECTED", rejectionCode: "PROCESSING_TIMEOUT", processingRevision: { increment: 1 },
    } });
    const candidates = await this.prisma.mediaAsset.findMany({ where: { pollOptions: { none: {} }, gameEntries: { none: {} }, avatarFor: { is: null }, OR: [
      { status: "DELETED", filesPurgedAt: null }, { status: { in: ["PENDING_UPLOAD", "REJECTED", "READY"] }, createdAt: { lt: old } },
      { status: "PENDING_UPLOAD", sourceVersion: null, uploadExpiresAt: { lte: now } },
    ] }, select: { id: true }, take: 200, orderBy: { updatedAt: "asc" } });
    let removed = 0;
    for (const { id } of candidates) {
      const purge = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const row = await tx.mediaAsset.findUnique({ where: { id } });
        if (!row || row.status === "PROCESSING" || await this.referenced(tx, id)) return false;
        // Aday seçimiyle kilit arasında yeniden yüklenmiş/işlenmiş kayıt silinmez.
        const expired = row.status === "PENDING_UPLOAD" && !row.sourceVersion && row.uploadExpiresAt !== null && row.uploadExpiresAt <= now;
        if (row.status !== "DELETED" && !expired && row.createdAt >= old) return false;
        if (row.status !== "DELETED") await tx.mediaAsset.update({ where: { id }, data: { status: "DELETED", uploadTokenHash: null, processingRevision: { increment: 1 } } });
        return true;
      });
      if (purge) {
        await this.storage.removeAssetDirectory(id);
        await this.prisma.mediaAsset.update({ where: { id }, data: { filesPurgedAt: now } });
        removed++;
      }
    }
    let orphans = 0;
    for (const id of await this.storage.oldAssetDirectories(stuck)) {
      const row = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { status: true } });
      if (!row || row.status === "DELETED") { await this.storage.removeAssetDirectory(id); orphans++; }
    }
    return { timedOut: timedOut.count, removed, orphans };
  }
}
