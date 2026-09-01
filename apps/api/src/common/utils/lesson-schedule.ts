export type SchedulePattern = {
  daysOfWeek: number[];
  time: string;
  duration: number;
};

/** Один слот недельного расписания: дни + время начала + длительность. */
export type ScheduleSlot = {
  daysOfWeek: number[];
  time: string;
  duration: number;
};

/** Конкретное занятие: момент начала и длительность в минутах. */
export type LessonOccurrence = {
  startsAt: Date;
  duration: number;
};

/**
 * Находится ли запись на запланированном перерыве в момент `at`.
 * Перерыв активен, если он начался (breakStart <= at) и ещё не закончился
 * (breakEnd отсутствует — бессрочно, либо at < breakEnd).
 */
export function isEnrollmentOnBreak(
  enrollment: { breakStart?: Date | null; breakEnd?: Date | null },
  at: Date = new Date()
): boolean {
  const start = enrollment.breakStart;
  if (!start) return false;
  if (start.getTime() > at.getTime()) return false;
  const end = enrollment.breakEnd;
  if (end && at.getTime() >= end.getTime()) return false;
  return true;
}

type GroupMembershipLike = {
  joinedAt: Date;
  leftAt?: Date | null;
  status: string;
};

type EnrollmentPeriodLike = {
  startDate: Date;
  endDate?: Date | null;
  breakStart?: Date | null;
  breakEnd?: Date | null;
} | null;

/** Участвовал ли ученик в групповом занятии с учётом даты начала и выхода из группы. */
export function isStudentEligibleForGroupLesson(
  lessonStartsAt: Date,
  membership: GroupMembershipLike,
  enrollment: EnrollmentPeriodLike,
  timeZone = getAppTimezone()
): boolean {
  const effectiveStart = enrollment?.startDate ?? membership.joinedAt;
  const lessonDay = getStartOfDayInAppTz(lessonStartsAt, timeZone);
  const startDay = getStartOfDayInAppTz(effectiveStart, timeZone);
  if (lessonDay.getTime() < startDay.getTime()) return false;

  if (enrollment?.endDate) {
    const endDay = getStartOfDayInAppTz(enrollment.endDate, timeZone);
    if (lessonDay.getTime() > endDay.getTime()) return false;
  }

  if (membership.leftAt) {
    const leftDay = getStartOfDayInAppTz(membership.leftAt, timeZone);
    if (lessonDay.getTime() >= leftDay.getTime()) return false;
  }

  if (membership.status === "ACTIVE") {
    if (enrollment && isEnrollmentOnBreak(enrollment, lessonStartsAt)) return false;
    return true;
  }

  if (membership.status === "LEFT" && membership.leftAt) {
    const leftDay = getStartOfDayInAppTz(membership.leftAt, timeZone);
    return lessonDay.getTime() >= startDay.getTime() && lessonDay.getTime() < leftDay.getTime();
  }

  return false;
}

/** Участвовал ли ученик в индивидуальном занятии с учётом даты начала записи. */
export function isStudentEligibleForIndividualLesson(
  lessonStartsAt: Date,
  enrollment: EnrollmentPeriodLike,
  timeZone = getAppTimezone()
): boolean {
  if (!enrollment) return true;

  const lessonDay = getStartOfDayInAppTz(lessonStartsAt, timeZone);
  const startDay = getStartOfDayInAppTz(enrollment.startDate, timeZone);
  if (lessonDay.getTime() < startDay.getTime()) return false;

  if (enrollment.endDate) {
    const endDay = getStartOfDayInAppTz(enrollment.endDate, timeZone);
    if (lessonDay.getTime() > endDay.getTime()) return false;
  }

  if (isEnrollmentOnBreak(enrollment, lessonStartsAt)) return false;
  return true;
}

export type PaymentCyclePreview = {
  lessonsInCycle: number;
  periodFrom: Date;
  periodTo: Date;
  nextPaymentDue: Date;
  lessonDates: Date[];
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

export function getAppTimezone(): string {
  return process.env.APP_TIMEZONE ?? "Asia/Tashkent";
}

/** Начало календарного дня в TZ центра для заданного момента. */
export function getStartOfDayInAppTz(ref: Date = new Date(), timeZone = getAppTimezone()): Date {
  const { year, month, day } = getZonedYmd(ref, timeZone);
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Для групповых записей — актуальное расписание группы; для индивидуальных — своё. */
export function resolveEnrollmentSchedulePattern(enrollment: {
  type?: string;
  schedulePattern: unknown;
  group?: { schedulePattern: unknown } | null;
}): unknown {
  if (enrollment.type === "GROUP") {
    return enrollment.group?.schedulePattern ?? enrollment.schedulePattern;
  }
  return enrollment.schedulePattern ?? enrollment.group?.schedulePattern;
}

function parseSingleSlot(value: unknown): ScheduleSlot | null {
  if (!value || typeof value !== "object") return null;
  const slot = value as Record<string, unknown>;
  if (!Array.isArray(slot.daysOfWeek) || typeof slot.time !== "string") return null;
  const daysOfWeek = slot.daysOfWeek.filter((day): day is number => typeof day === "number");
  if (!daysOfWeek.length) return null;
  return {
    daysOfWeek,
    time: slot.time,
    duration: typeof slot.duration === "number" ? slot.duration : 60
  };
}

/**
 * Разбирает расписание в массив слотов.
 * Поддерживает новый формат { slots: [...] } и старый { daysOfWeek, time, duration }.
 */
export function parseScheduleSlots(value: unknown): ScheduleSlot[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.slots)) {
    return obj.slots
      .map((slot) => parseSingleSlot(slot))
      .filter((slot): slot is ScheduleSlot => slot !== null);
  }
  const single = parseSingleSlot(obj);
  return single ? [single] : [];
}

/** Совместимость: возвращает первый слот как одиночный паттерн (или null). */
export function parseSchedulePattern(value: unknown): SchedulePattern | null {
  const slots = parseScheduleSlots(value);
  return slots[0] ?? null;
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
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
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getZonedYmd(instant: Date, timeZone: string) {
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

function getWeekdayInTimeZone(year: number, month: number, day: number, timeZone: string): number {
  const instant = zonedTimeToUtc(year, month, day, 12, 0, timeZone);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  return EN_WEEKDAY[wd] ?? 0;
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/**
 * Возвращает ближайшие занятия (момент + длительность) по слотам расписания,
 * в хронологическом порядке. Корректно работает с несколькими слотами в день.
 */
export function getLessonOccurrences(
  rawPattern: unknown,
  startFrom: Date,
  lessonsCount: number,
  timeZone = getAppTimezone()
): LessonOccurrence[] {
  const slots = parseScheduleSlots(rawPattern);
  if (!slots.length) {
    throw new Error("У записи нет расписания занятий");
  }

  const occurrences: LessonOccurrence[] = [];
  let { year, month, day } = getZonedYmd(startFrom, timeZone);

  for (let guard = 0; occurrences.length < lessonsCount && guard < 1460; guard++) {
    const weekday = getWeekdayInTimeZone(year, month, day, timeZone);

    const daySlots = slots
      .filter((slot) => slot.daysOfWeek.includes(weekday))
      .map((slot) => {
        const [hours, minutes] = slot.time.split(":").map((part) => Number(part));
        return {
          startsAt: zonedTimeToUtc(year, month, day, hours, minutes || 0, timeZone),
          duration: slot.duration
        };
      })
      .filter((occ) => occ.startsAt >= startFrom)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    for (const occ of daySlots) {
      if (occurrences.length < lessonsCount) occurrences.push(occ);
    }

    ({ year, month, day } = addCalendarDays(year, month, day, 1));
  }

  if (occurrences.length < lessonsCount) {
    throw new Error("Не удалось построить цикл: проверьте расписание");
  }

  return occurrences;
}

export function getLessonDatesFromSchedule(
  rawPattern: unknown,
  startFrom: Date,
  lessonsCount: number,
  timeZone = getAppTimezone()
): Date[] {
  return getLessonOccurrences(rawPattern, startFrom, lessonsCount, timeZone).map((occ) => occ.startsAt);
}

export function buildLessonPaymentCycle(
  rawPattern: unknown,
  paidAt: Date,
  lessonsInCycle: number
): PaymentCyclePreview {
  const lessonDates = getLessonDatesFromSchedule(rawPattern, paidAt, lessonsInCycle + 1);
  const cycleDates = lessonDates.slice(0, lessonsInCycle);
  const nextLesson = lessonDates[lessonsInCycle];

  return {
    lessonsInCycle,
    periodFrom: cycleDates[0],
    periodTo: cycleDates[cycleDates.length - 1],
    nextPaymentDue: nextLesson,
    lessonDates: cycleDates
  };
}

/** Сколько занятий по расписанию попадает в период [rangeStart, rangeEnd]. */
export function countLessonsInRange(
  rawPattern: unknown,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone = getAppTimezone()
): number {
  const slots = parseScheduleSlots(rawPattern);
  if (!slots.length || rangeEnd < rangeStart) return 0;

  let count = 0;
  let { year, month, day } = getZonedYmd(rangeStart, timeZone);
  const endYmd = getZonedYmd(rangeEnd, timeZone);

  const isPastEnd = (y: number, m: number, d: number) => {
    if (y !== endYmd.year) return y > endYmd.year;
    if (m !== endYmd.month) return m > endYmd.month;
    return d > endYmd.day;
  };

  for (let guard = 0; guard < 1460 && !isPastEnd(year, month, day); guard++) {
    const weekday = getWeekdayInTimeZone(year, month, day, timeZone);
    for (const slot of slots) {
      if (!slot.daysOfWeek.includes(weekday)) continue;
      const [hours, minutes] = slot.time.split(":").map((part) => Number(part));
      const lessonUtc = zonedTimeToUtc(year, month, day, hours, minutes || 0, timeZone);
      if (lessonUtc >= rangeStart && lessonUtc <= rangeEnd) {
        count++;
      }
    }
    ({ year, month, day } = addCalendarDays(year, month, day, 1));
  }

  return count;
}

/** Сдвигает дату оплаты вперёд на N занятий по расписанию. */
export function advanceDueDateByLessons(
  rawPattern: unknown,
  currentDue: Date,
  lessonCount: number,
  timeZone = getAppTimezone()
): Date {
  if (lessonCount <= 0) return currentDue;
  const dates = getLessonDatesFromSchedule(rawPattern, currentDue, lessonCount + 1, timeZone);
  return dates[lessonCount];
}

export function buildMonthlyPaymentCycle(paidAt: Date): PaymentCyclePreview {
  const periodFrom = new Date(paidAt);
  const periodTo = new Date(paidAt);
  periodTo.setMonth(periodTo.getMonth() + 1);

  return {
    lessonsInCycle: 0,
    periodFrom,
    periodTo,
    nextPaymentDue: new Date(periodTo),
    lessonDates: []
  };
}
