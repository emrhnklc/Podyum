import { ApiError } from "../../common/errors/api-error.js";

export function encodeGameCursor(position: number, sessionId: string, userId: string, resource: string) {
  return Buffer.from(JSON.stringify({ v: 1, position, sessionId, userId, resource })).toString("base64url");
}

export function decodeGameCursor(cursor: string | undefined, sessionId: string, userId: string, resource: string) {
  if (cursor === undefined) return -1;
  try {
    if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (value.v !== 1 || value.sessionId !== sessionId || value.userId !== userId || value.resource !== resource
      || !Number.isInteger(value.position) || value.position < 0 || value.position > 2147483647) throw new Error();
    return value.position as number;
  } catch { throw new ApiError(400, "INVALID_CURSOR", "Oyun sayfalama imleci geçersiz veya bu listeye ait değil."); }
}
