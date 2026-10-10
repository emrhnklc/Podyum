import { createHash } from "node:crypto";
import { ApiError } from "../errors/api-error.js";

export interface CursorPosition { createdAt: string; id: string }

function contextHash(context: Record<string, string | number | boolean | null>) {
  const normalized = Object.fromEntries(Object.entries(context).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function encodeCursor(position: CursorPosition, context: Record<string, string | number | boolean | null>) {
  return Buffer.from(JSON.stringify({ v: 1, context: contextHash(context), ...position })).toString("base64url");
}

export function decodeCursor(cursor: string, context: Record<string, string | number | boolean | null>): CursorPosition {
  try {
    if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (value.v !== 1 || value.context !== contextHash(context)
      || typeof value.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
      || typeof value.createdAt !== "string" || new Date(value.createdAt).toISOString() !== value.createdAt) throw new Error();
    return { id: value.id, createdAt: value.createdAt };
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "Sayfalama imleci geçersiz veya filtrelerle uyuşmuyor.");
  }
}
