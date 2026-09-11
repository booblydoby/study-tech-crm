/** Часовой пояс учебного центра — все занятия считаются в нём. */
export const DEFAULT_TIMEZONE = "Asia/Tashkent";

/** 0 = воскресенье … 6 = суббота (как Date.getDay() и кнопки Пн=1 … Сб=6 в UI). */
export const WEEKDAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export type SchedulePattern = {
  daysOfWeek: number[];
  time: string;
  duration: number;
};

const EN_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function parseSchedulePattern(value: unknown): SchedulePattern | null {
  if (!value || typeof value !== "object") return null;
  const pattern = value as Record<string, unknown>;
  if (!Array.isArray(pattern.daysOfWeek) || typeof pattern.time !== "string") return null;
  return {
    daysOfWeek: pattern.daysOfWeek.filter((day): day is number => typeof day === "number"),
    time: pattern.time,
    duration: typeof pattern.duration === "number" ? pattern.duration : 60
  };
}

export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

export function getZonedYmd(instant: Date, timeZone: string = DEFAULT_TIMEZONE) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function getWeekdayInTimeZone(
  year: number,
  month: number,
  day: number,
  timeZone: string = DEFAULT_TIMEZONE
): number {
  const instant = zonedTimeToUtc(year, month, day, 12, 0, timeZone);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  return EN_WEEKDAY[wd] ?? 0;
}

export function addCalendarDays(year: number, month: number, day: number, days: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function getLessonDatesFromSchedule(
  rawPattern: unknown,
  startFrom: Date,
  lessonsCount: number,
  timeZone: string = DEFAULT_TIMEZONE
): Date[] {
  const pattern = parseSchedulePattern(rawPattern);
  if (!pattern?.daysOfWeek.length) {
    throw new Error("У записи нет расписания занятий");
  }

  const [hours, minutes] = pattern.time.split(":").map((part) => Number(part));
  const dates: Date[] = [];
  let { year, month, day } = getZonedYmd(startFrom, timeZone);

  for (let guard = 0; dates.length < lessonsCount && guard < 730; guard++) {
    const weekday = getWeekdayInTimeZone(year, month, day, timeZone);
    if (pattern.daysOfWeek.includes(weekday)) {
      const lessonUtc = zonedTimeToUtc(year, month, day, hours, minutes || 0, timeZone);
      if (lessonUtc >= startFrom) {
        dates.push(lessonUtc);
      }
    }
    ({ year, month, day } = addCalendarDays(year, month, day, 1));
  }

  if (dates.length < lessonsCount) {
    throw new Error("Не удалось построить цикл: проверьте расписание");
  }

  return dates;
}

export function formatSchedulePattern(pattern: SchedulePattern | null | undefined): string {
  if (!pattern?.daysOfWeek?.length) return "Расписание не задано";
  const days = pattern.daysOfWeek.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(", ");
  return `${days} в ${pattern.time} (${pattern.duration} мин)`;
}

export function formatInstantRu(
  value: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
  options?: { weekday?: "short" | "long" }
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("ru-RU", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(options?.weekday ? { weekday: options.weekday } : {})
  });
}

export function formatTimeRu(value: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("ru-RU", { timeZone, hour: "2-digit", minute: "2-digit" });
}

export function getWeekdayLabelRu(value: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("ru-RU", { timeZone, weekday: "long" });
}
