import { createHash } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import { trendUuid } from "./trend-rebuild-cursor.js";
import { TREND_POLICY } from "./trend-policy.js";

export type TrendPagePosition = {
  asOf: string;
  fingerprint: string;
  score: number;
  distinctVoters: number;
  id: string;
};
const hash = (context: Record<string, unknown>) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(context).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .digest("hex");

// Diğer sayfalama imleçleri gibi bu da yetki anahtarı değildir. Her sayfada
// filtreler, örneklem eşiği ve güncel kaynak erişimi DB'de yeniden uygulanır.
export function encodeTrendPage(
  position: TrendPagePosition,
  context: Record<string, unknown>,
) {
  return Buffer.from(
    JSON.stringify({ v: 1, context: hash(context), ...position }),
  ).toString("base64url");
}
export function decodeTrendPage(
  cursor: string,
  context: Record<string, unknown>,
  now: Date,
): TrendPagePosition {
  try {
    if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error();
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      v.v !== 1 ||
      v.context !== hash(context) ||
      !trendUuid(v.id) ||
      typeof v.asOf !== "string" ||
      new Date(v.asOf).toISOString() !== v.asOf ||
      new Date(v.asOf) > now ||
      !/^[0-9a-f]{32}$/.test(v.fingerprint) ||
      !Number.isSafeInteger(v.score) ||
      v.score < TREND_POLICY.minimumDistinctVoters ||
      !Number.isSafeInteger(v.distinctVoters) ||
      v.distinctVoters < TREND_POLICY.minimumDistinctVoters ||
      v.distinctVoters > v.score
    )
      throw new Error();
    if (now.getTime() - new Date(v.asOf).getTime() > 15 * 60000)
      throw new ApiError(
        409,
        "TREND_PAGE_EXPIRED",
        "Trend listesini yenileyerek devam et.",
      );
    return {
      asOf: v.asOf,
      fingerprint: v.fingerprint,
      score: v.score,
      distinctVoters: v.distinctVoters,
      id: v.id,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "INVALID_CURSOR",
      "Sayfalama imleci geçersiz veya filtrelerle uyuşmuyor.",
    );
  }
}
