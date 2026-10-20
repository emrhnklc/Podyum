import { ApiError } from "../../common/errors/api-error.js";
import type { TrendPeriod } from "./dto/trends.dto.js";

const dayMs = 86400000;
export function istanbulDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function trendPeriod(
  period: TrendPeriod,
  date: string | undefined,
  now: Date,
) {
  const anchorDate = date ?? istanbulDate(now);
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ||
    !Number.isFinite(anchor.getTime()) ||
    anchor.toISOString().slice(0, 10) !== anchorDate ||
    anchorDate < "2017-01-01" ||
    anchorDate > istanbulDate(now)
  ) {
    throw new ApiError(
      400,
      "INVALID_TREND_DATE",
      "Geçerli, gelecekte olmayan bir İstanbul takvim tarihi seç.",
    );
  }
  const start = new Date(anchor);
  if (period === "WEEK")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === "MONTH") start.setUTCDate(1);
  const end = new Date(start);
  if (period === "MONTH") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setTime(end.getTime() + (period === "WEEK" ? 7 : 1) * dayMs);
  const startDate = start.toISOString().slice(0, 10),
    endDate = end.toISOString().slice(0, 10);
  // 2017 sonrası İstanbul kalıcı UTC+03; sunucunun yerel saat dilimine bağlı değil.
  return {
    period,
    anchorDate,
    startDate,
    endDate,
    startsAt: new Date(`${startDate}T00:00:00.000+03:00`),
    endsAt: new Date(`${endDate}T00:00:00.000+03:00`),
  };
}
