import type { SessionManager } from "../../auth/session-manager";
import { ApiError } from "../../../lib/api/client";

export type AvatarAsset = {
  id: string;
  displayPath: string | null;
  previewAcceptedAt: string | null;
};
export type AvatarFile = Blob | { uri: string; name: string; type: string };

function accountGuard(client: SessionManager) {
  const sessionId = client.state.session?.sessionId;
  return () => {
    if (!sessionId || client.state.session?.sessionId !== sessionId)
      throw new ApiError(
        401,
        "INVALID_SESSION",
        "Oturum değişti. Fotoğrafı yeniden seç.",
      );
  };
}

// Yükleme izni → dosya → işleme. Avatar ve oylama fotoğrafları aynı akışı
// kullanır; bulanıklaştırma açıksa ve bölge seçilmemişse kullanıcının "yüz yok"
// onayı (confirmNoFaces) gerekir, istemci bunu kendiliğinden göndermez.
export async function uploadMedia(
  client: SessionManager,
  file: AvatarFile,
  byteSize: number,
  mimeType: string,
  purpose: "AVATAR" | "POLL" | "GAME",
  blur: {
    requested: boolean;
    confirmNoFaces?: boolean;
    regions?: { x: number; y: number; width: number; height: number }[];
  } = { requested: false },
) {
  const check = accountGuard(client);
  check();
  // Expo 57 fetch, multipart içinde React Native'in { uri, name, type }
  // nesnesini kodlayamaz. Bütün platformlarda gerçek Blob gönderilir.
  let blob: Blob;
  try {
    blob = file instanceof Blob ? file : await (await fetch(file.uri)).blob();
  } catch {
    throw new ApiError(
      0,
      "LOCAL_IMAGE_READ_FAILED",
      "Seçilen fotoğraf okunamadı. Galeriden yeniden seçip tekrar dene.",
    );
  }
  check();
  if (!blob.size || blob.size !== byteSize)
    throw new ApiError(
      0,
      "LOCAL_IMAGE_CHANGED",
      "Fotoğraf dosyası değişti. Galeriden yeniden seçip tekrar dene.",
    );
  if (blob.type !== mimeType) blob = blob.slice(0, blob.size, mimeType);
  const data = new FormData();
  data.append(
    "file",
    blob,
    file instanceof Blob ? purpose.toLowerCase() : file.name,
  );
  const grant = await client.request<{
    asset: AvatarAsset;
    upload: { path: `/${string}`; token: string };
  }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      mimeType,
      byteSize,
      blurRequested: blur.requested,
    }),
  });
  check();
  await client.response(grant.upload.path, {
    method: "POST",
    headers: { "X-Upload-Token": grant.upload.token },
    body: data,
  });
  check();
  return client.request<AvatarAsset>(`/media/${grant.asset.id}/complete`, {
    method: "POST",
    // Bölge seçildiyse sunucu onları bulanıklaştırır; seçilmediyse yalnız
    // kullanıcının açık "yüz yok" onayı gönderilir. İkisi birlikte gitmez.
    body: JSON.stringify(
      !blur.requested
        ? {}
        : blur.regions?.length
          ? { blurRegions: blur.regions }
          : blur.confirmNoFaces
            ? { confirmNoFaces: true }
            : {},
    ),
  });
}

export function prepareAvatar(
  client: SessionManager,
  file: AvatarFile,
  byteSize: number,
  mimeType: string,
) {
  return uploadMedia(client, file, byteSize, mimeType, "AVATAR");
}

// Kullanıcı son görüntüyü ekranda onayladığında çağrılır.
export async function acceptPreview(client: SessionManager, mediaId: string) {
  await client.request(`/media/${mediaId}/accept-preview`, {
    method: "POST",
    body: JSON.stringify({ confirmed: true }),
  });
}

export async function acceptAvatar(client: SessionManager, asset: AvatarAsset) {
  const check = accountGuard(client);
  check();
  await client.request(`/media/${asset.id}/accept-preview`, {
    method: "POST",
    body: JSON.stringify({ confirmed: true }),
  });
  check();
  return client.request<{ avatarMediaId: string; avatarPath: string }>(
    "/me/avatar",
    { method: "PUT", body: JSON.stringify({ mediaId: asset.id }) },
  );
}
