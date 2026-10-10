export interface DailyGameSchedule { startTime: string; timeZone: string; themeSlug: string }

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
}

export function gameLocalDay(date: Date, timeZone: string) {
  const value = parts(date, timeZone);
  return `${value.year}-${value.month}-${value.day}`;
}

export function dailyGameStart(day: string, schedule: DailyGameSchedule) {
  const desired = Date.parse(`${day}T${schedule.startTime}:00.000Z`);
  if (!Number.isFinite(desired) || new Date(desired).toISOString().slice(0, 10) !== day) throw new Error("Günlük oyun tarihi geçersiz.");
  let instant = desired;
  for (let i = 0; i < 4; i++) {
    const value = parts(new Date(instant), schedule.timeZone);
    const wallTime = Date.parse(`${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}.000Z`);
    instant += desired - wallTime;
  }
  const result = new Date(instant); const value = parts(result, schedule.timeZone);
  if (`${value.year}-${value.month}-${value.day}` !== day || `${value.hour}:${value.minute}` !== schedule.startTime) {
    throw new Error("Günlük oyun saati bu saat diliminde bu tarihte bulunmuyor.");
  }
  // Saat geri alındığında iki kez oluşan duvar saati sessizce seçilmez.
  for (const delta of [-86400000, 86400000]) {
    const nearby = parts(new Date(instant + delta), schedule.timeZone);
    const wallTime = Date.parse(`${nearby.year}-${nearby.month}-${nearby.day}T${nearby.hour}:${nearby.minute}:${nearby.second}.000Z`);
    const alternative = desired - (wallTime - (instant + delta));
    if (alternative !== instant) {
      const other = parts(new Date(alternative), schedule.timeZone);
      if (`${other.year}-${other.month}-${other.day}` === day && `${other.hour}:${other.minute}` === schedule.startTime) {
        throw new Error("Günlük oyun saati bu tarihte iki kez oluşuyor; tekil bir saat seçilmeli.");
      }
    }
  }
  return result;
}

export function readDailyGameSchedule(env: NodeJS.ProcessEnv): DailyGameSchedule | null {
  const { DAILY_GAME_START_TIME: startTime, DAILY_GAME_TIME_ZONE: timeZone, DAILY_GAME_THEME_SLUG: themeSlug } = env;
  if (startTime === undefined && timeZone === undefined && themeSlug === undefined) return null;
  if (!startTime || !timeZone || !themeSlug || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
    || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(themeSlug)) throw new Error("Günlük oyun saat, saat dilimi ve tema ayarları birlikte ve geçerli girilmeli.");
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw new Error("DAILY_GAME_TIME_ZONE geçerli bir IANA saat dilimi olmalı."); }
  return { startTime, timeZone, themeSlug };
}
