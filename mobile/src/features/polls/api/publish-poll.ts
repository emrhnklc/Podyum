import * as Crypto from "expo-crypto";
import type { SessionManager } from "@/features/auth/session-manager";
import {
  acceptPreview,
  uploadMedia,
  type AvatarFile,
} from "@/features/profile/api/avatar";
import { ApiError } from "@/lib/api/client";
import type { PollCategory } from "@/constants/poll-categories";
import { productTagInputs, type ProductTagDraft } from "../product-tags";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PickedPhoto = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
  fileName?: string | null;
};

export type PollDraftInput = {
  question: string;
  category: PollCategory;
  durationSeconds: number;
  visibility: "PUBLIC" | "FRIENDS";
  commentsEnabled: boolean;
  blur: boolean;
  // Bulanıklaştırma açıkken kullanıcının açık "fotoğraflarda yüz yok" onayı.
  confirmNoFaces: boolean;
  photos: PickedPhoto[];
  products?: ProductTagDraft[][];
};

// Yarıda kalan yayının kaldığı yer. Tekrar denemede yüklenen fotoğraflar ve
// oluşturulan taslak yeniden üretilmez; aynı işlem anahtarları korunur.
export type PublishProgress = {
  mediaIds: (string | undefined)[];
  createKey: string;
  publishKey: string;
  poll?: { id: string; version: number };
  previewApproved?: boolean;
};

export function newProgress(count: number): PublishProgress {
  return {
    mediaIds: Array.from({ length: count }, () => undefined),
    createKey: Crypto.randomUUID(),
    publishKey: Crypto.randomUUID(),
  };
}

// Galeriden seçilen dosyayı yüklemeye hazırlar; tür ve boyutu sunucu
// sınırlarıyla aynı denetler.
export async function readPhoto(photo: PickedPhoto) {
  if (photo.fileSize && photo.fileSize > MAX_BYTES)
    throw new ApiError(
      0,
      "IMAGE_TOO_LARGE",
      "Fotoğraf en fazla 10 MB olabilir.",
    );
  const blob = await (await fetch(photo.uri)).blob();
  const mimeType = TYPES.includes(blob.type)
    ? blob.type
    : photo.mimeType || blob.type;
  if (!TYPES.includes(mimeType))
    throw new ApiError(
      0,
      "UNSUPPORTED_IMAGE",
      "JPEG, PNG veya WebP fotoğraf seç.",
    );
  if (!blob.size || blob.size > MAX_BYTES)
    throw new ApiError(
      0,
      "IMAGE_TOO_LARGE",
      "Fotoğraf en fazla 10 MB olabilir.",
    );
  // Fotoğrafı zaten okuduk; native URI nesnesine geri çevirmeden aynı
  // Blob'u göndeririz. Expo 57 fetch URI tabanlı multipart kabul etmez.
  const file: AvatarFile =
    blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
  return { file, byteSize: blob.size, mimeType };
}

// Önce işlenmiş fotoğraflar hazırlanır; kullanıcı sunucudaki son halleri görür.
export async function preparePollPhotos(
  client: SessionManager,
  input: PollDraftInput,
  progress: PublishProgress,
  onStep: (label: string) => void,
) {
  for (const [index, photo] of input.photos.entries()) {
    if (progress.mediaIds[index]) continue;
    onStep(`Fotoğraflar yükleniyor ${index + 1}/${input.photos.length}`);
    const { file, byteSize, mimeType } = await readPhoto(photo);
    const asset = await uploadMedia(client, file, byteSize, mimeType, "POLL", {
      requested: input.blur,
      confirmNoFaces: input.confirmNoFaces,
    });
    progress.mediaIds[index] = asset.id;
  }
}

export async function publishPoll(
  client: SessionManager,
  input: PollDraftInput,
  progress: PublishProgress,
  onStep: (label: string) => void,
) {
  if (
    !progress.previewApproved ||
    progress.mediaIds.length !== input.photos.length ||
    progress.mediaIds.some((id) => !id)
  )
    throw new ApiError(
      409,
      "PREVIEW_REQUIRED",
      "Fotoğrafların son halini kontrol edip onayla.",
    );
  for (const mediaId of progress.mediaIds)
    await acceptPreview(client, mediaId!);

  if (input.products && input.products.length !== input.photos.length)
    throw new Error("Ürün listesi fotoğraf seçenekleriyle eşleşmiyor.");

  if (!progress.poll) {
    onStep("Oylama hazırlanıyor");
    const draft = await client.request<{ id: string; version: number }>(
      "/polls",
      {
        method: "POST",
        headers: { "Idempotency-Key": progress.createKey },
        body: JSON.stringify({
          question: input.question.trim(),
          category: input.category,
          durationSeconds: input.durationSeconds,
          visibility: input.visibility,
          commentsEnabled: input.commentsEnabled,
          options: progress.mediaIds.map((mediaId, index) => ({
            position: index + 1,
            mediaId,
            products: productTagInputs(input.products?.[index] ?? []),
          })),
        }),
      },
    );
    progress.poll = { id: draft.id, version: draft.version };
  }

  onStep("Yayınlanıyor");
  await client.request(`/polls/${progress.poll.id}/publish`, {
    method: "POST",
    headers: { "Idempotency-Key": progress.publishKey },
    body: JSON.stringify({ expectedVersion: progress.poll.version }),
  });
  return progress.poll.id;
}
