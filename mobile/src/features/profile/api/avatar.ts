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

export async function prepareAvatar(
  client: SessionManager,
  file: AvatarFile,
  byteSize: number,
  mimeType: string,
) {
  const check = accountGuard(client);
  check();
  const grant = await client.request<{
    asset: AvatarAsset;
    upload: { path: `/${string}`; token: string };
  }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      purpose: "AVATAR",
      mimeType,
      byteSize,
      blurRequested: false,
    }),
  });
  check();
  const data = new FormData();
  // Native FormData yerel URI nesnesini, web ise Blob'u kabul eder.
  if (file instanceof Blob) data.append("file", file, "avatar");
  else data.append("file", file as unknown as Blob);
  await client.response(grant.upload.path, {
    method: "POST",
    headers: { "X-Upload-Token": grant.upload.token },
    body: data,
  });
  check();
  return client.request<AvatarAsset>(`/media/${grant.asset.id}/complete`, {
    method: "POST",
    body: "{}",
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
