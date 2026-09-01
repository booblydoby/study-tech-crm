export enum RoleName {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT"
}

export enum StudentStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED"
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
  EXCUSED = "EXCUSED"
}

export enum LessonStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  MOVED = "MOVED"
}

export enum EnrollmentType {
  GROUP = "GROUP",
  INDIVIDUAL = "INDIVIDUAL"
}

export enum EnrollmentStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  CANCELLED = "CANCELLED"
}

export enum PaymentPeriod {
  MONTHLY = "MONTHLY",
  PER_LESSON = "PER_LESSON"
}

export enum LessonType {
  GROUP = "GROUP",
  INDIVIDUAL = "INDIVIDUAL"
}

export enum LessonCancellationReason {
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  WEATHER = "WEATHER",
  ILLNESS = "ILLNESS",
  OTHER = "OTHER"
}

export {
  DEFAULT_TIMEZONE,
  WEEKDAY_LABELS,
  addCalendarDays,
  formatInstantRu,
  formatSchedulePattern,
  formatTimeRu,
  getLessonDatesFromSchedule,
  getWeekdayInTimeZone,
  getWeekdayLabelRu,
  getZonedYmd,
  parseSchedulePattern,
  zonedTimeToUtc,
  type SchedulePattern
} from "./schedule";
