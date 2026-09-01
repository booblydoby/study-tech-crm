import {
  DEFAULT_TIMEZONE,
  addCalendarDays,
  formatInstantRu,
  formatSchedulePattern,
  getZonedYmd,
  zonedTimeToUtc,
  WEEKDAY_LABELS,
  type SchedulePattern
} from "@study-crm/shared";

export type { SchedulePattern };

export type CyclePreview = {
  lessonsInCycle: number;
  periodFrom: string;
  periodTo: string;
  nextPaymentDue: string;
  lessonDates: string[];
};

export function getAppTimezone(): string {
  return process.env.NEXT_PUBLIC_APP_TIMEZONE ?? DEFAULT_TIMEZONE;
}

type ScheduleSlotLike = { daysOfWeek?: number[]; time?: string; duration?: number };

function formatSlot(slot: ScheduleSlotLike): string {
  if (!slot.daysOfWeek?.length || !slot.time) return "";
  const days = slot.daysOfWeek.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(", ");
  return `${days} в ${slot.time} (${slot.duration ?? 60} мин)`;
}

/** Поддерживает старый формат { daysOfWeek, time, duration } и новый { slots: [...] }. */
export function formatSchedule(pattern: unknown) {
  if (pattern && typeof pattern === "object" && Array.isArray((pattern as { slots?: unknown }).slots)) {
    const slots = (pattern as { slots: ScheduleSlotLike[] }).slots;
    const parts = slots.map(formatSlot).filter(Boolean);
    return parts.length ? parts.join(" · ") : "Расписание не задано";
  }
  return formatSchedulePattern(pattern as SchedulePattern | null | undefined);
}

export function formatDateRu(value: string | Date) {
  return formatInstantRu(value, getAppTimezone());
}

export function formatDateWithWeekdayRu(value: string | Date) {
  return formatInstantRu(value, getAppTimezone(), { weekday: "long" });
}

export function formatTimeRu(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("ru-RU", {
    timeZone: getAppTimezone(),
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Ключ даты YYYY-MM-DD в часовом поясе центра (Asia/Tashkent). */
export function getDateKeyInAppTz(value: string | Date, timeZone = getAppTimezone()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function getStartOfDayInAppTz(ref: Date = new Date(), timeZone = getAppTimezone()): Date {
  const { year, month, day } = getZonedYmd(ref, timeZone);
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Первый день месяца в TZ центра для заданного момента. */
export function getStartOfMonthInAppTz(ref: Date = new Date(), timeZone = getAppTimezone()): Date {
  const { year, month } = getZonedYmd(ref, timeZone);
  return zonedTimeToUtc(year, month, 1, 0, 0, timeZone);
}

/** Последний момент месяца в TZ центра. */
export function getEndOfMonthInAppTz(ref: Date = new Date(), timeZone = getAppTimezone()): Date {
  const { year, month } = getZonedYmd(ref, timeZone);
  const lastDay = new Date(year, month, 0).getDate();
  return getEndOfDayInAppTz(zonedTimeToUtc(year, month, lastDay, 12, 0, timeZone), timeZone);
}

/** Метка месяца для заголовка календаря, напр. «июнь 2026 г.». */
export function formatMonthYearRu(ref: Date, timeZone = getAppTimezone()): string {
  return ref.toLocaleDateString("ru-RU", { timeZone, month: "long", year: "numeric" });
}

export function getEndOfDayInAppTz(ref: Date = new Date(), timeZone = getAppTimezone()): Date {
  const { year, month, day } = getZonedYmd(ref, timeZone);
  const next = addCalendarDays(year, month, day, 1);
  return new Date(zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone).getTime() - 1);
}

export function addAppDays(ref: Date, days: number, timeZone = getAppTimezone()): Date {
  const { year, month, day } = getZonedYmd(ref, timeZone);
  const next = addCalendarDays(year, month, day, days);
  return zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);
}

export function isSameAppDay(a: string | Date, b: string | Date, timeZone = getAppTimezone()): boolean {
  return getDateKeyInAppTz(a, timeZone) === getDateKeyInAppTz(b, timeZone);
}

export function isTodayInAppTz(value: string | Date, timeZone = getAppTimezone()): boolean {
  return isSameAppDay(value, new Date(), timeZone);
}

/** Собирает момент начала/конца занятия по дате и времени в часовом поясе центра. */
export function buildDateTimeInAppTz(
  dateStr: string,
  timeStr: string,
  durationMinutes = 90,
  timeZone = getAppTimezone()
): { startsAt: string; endsAt: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const startsAt = zonedTimeToUtc(year, month, day, hours, minutes || 0, timeZone);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function lessonStatusLabelRu(status: string): string {
  if (status === "COMPLETED") return "Проведено";
  if (status === "CANCELLED") return "Отменено";
  if (status === "MOVED") return "Перенесено";
  return "Запланировано";
}

export function attendanceStatusLabelRu(status: string): string {
  if (status === "PRESENT") return "Был";
  if (status === "ABSENT") return "Пропуск";
  if (status === "LATE") return "Опоздал";
  if (status === "EXCUSED") return "Уважительная";
  return status;
}

/** Ключ даты YYYY-MM-DD для «сегодня» в TZ центра. */
export function getTodayDateKeyInAppTz(timeZone = getAppTimezone()): string {
  return getDateKeyInAppTz(new Date(), timeZone);
}

/** Значение для `<input type="date">` — сегодня в TZ центра. */
export function todayDateInputInAppTz(timeZone = getAppTimezone()): string {
  return getTodayDateKeyInAppTz(timeZone);
}

/** Конвертирует date input в ISO начала календарного дня в TZ центра. */
export function dateOnlyToIsoStartInAppTz(dateStr: string, timeZone = getAppTimezone()): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone).toISOString();
}

/** ISO из API → значение для `<input type="date">` в TZ центра (не slice по UTC!). */
export function isoToDateInputInAppTz(iso: string, timeZone = getAppTimezone()): string {
  return getDateKeyInAppTz(iso, timeZone);
}

/** Дата раньше сегодняшнего дня в TZ центра. */
export function isBeforeTodayInAppTz(value: string | Date, timeZone = getAppTimezone()): boolean {
  return getDateKeyInAppTz(value, timeZone) < getTodayDateKeyInAppTz(timeZone);
}
