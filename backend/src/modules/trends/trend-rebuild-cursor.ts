import { ApiError } from "../../common/errors/api-error.js";
export const trendUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type TrendVoteKey = { pollId: string; voterId: string };
export function trendCursor(key: TrendVoteKey, pollId: string | null) {
  return Buffer.from(
    JSON.stringify({ resource: "trend-rebuild-v1", scope: pollId, ...key }),
  ).toString("base64url");
}
export function readTrendCursor(
  value: string,
  pollId: string | null,
): TrendVoteKey {
  try {
    if (value.length > 1024 || !/^[a-z0-9_-]+$/i.test(value)) throw new Error();
    const row = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      row.resource !== "trend-rebuild-v1" ||
      row.scope !== pollId ||
      !trendUuid(row.pollId) ||
      !trendUuid(row.voterId)
    )
      throw new Error();
    return {
      pollId: row.pollId.toLowerCase(),
      voterId: row.voterId.toLowerCase(),
    };
  } catch {
    throw new ApiError(
      400,
      "INVALID_TREND_CURSOR",
      "Trend onarım imleci geçersiz veya kapsam değişmiş.",
    );
  }
}
