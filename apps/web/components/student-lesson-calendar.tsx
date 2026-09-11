"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import {
  addAppDays,
  formatMonthYearRu,
  formatTimeRu,
  getAppTimezone,
  getDateKeyInAppTz,
  getEndOfMonthInAppTz,
  getStartOfMonthInAppTz,
  isBeforeTodayInAppTz,
  isTodayInAppTz
} from "@/lib/payment-cycle";
import { Tag, lessonStatusTag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

export interface StudentCalendarLesson {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  isReplacementLesson?: boolean;
  subject: { name: string };
  group?: { name: string } | null;
  teacher: { fullName: string };
}

interface StudentLessonCalendarProps {
  studentId: string;
  selectedLessonId?: string | null;
  onSelectLesson: (lesson: StudentCalendarLesson) => void;
  refreshKey?: number;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function weekdayMon0(date: Date, timeZone: string): number {
  const label = date.toLocaleDateString("en-US", { timeZone, weekday: "short" });
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[label] ?? 0;
}

function statusChipClass(status: string, selected: boolean): string {
  const base = selected ? "ring-1 ring-brand-amber/60 ring-offset-1 ring-offset-[#0e0e0e]" : "";
  const st = lessonStatusTag(status);
  if (st.variant === "success") return cn(base, "border-emerald-500/40 bg-emerald-500/20 text-emerald-200");
  if (st.variant === "danger") return cn(base, "border-rose-500/40 bg-rose-500/20 text-rose-200");
  if (st.variant === "warning") return cn(base, "border-amber-500/40 bg-amber-500/20 text-amber-200");
  return cn(base, "border-sky-500/30 bg-sky-500/12 text-sky-100");
}

function statusDotClass(status: string): string {
  const st = lessonStatusTag(status);
  if (st.variant === "success") return "bg-emerald-400";
  if (st.variant === "danger") return "bg-rose-400";
  if (st.variant === "warning") return "bg-amber-400";
  return "bg-sky-400";
}

export function StudentLessonCalendar({
  studentId,
  selectedLessonId,
  onSelectLesson,
  refreshKey = 0
}: StudentLessonCalendarProps) {
  const [monthRef, setMonthRef] = useState(() => getStartOfMonthInAppTz(new Date()));
  const [lessons, setLessons] = useState<StudentCalendarLesson[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const from = getStartOfMonthInAppTz(monthRef);
      const to = getEndOfMonthInAppTz(monthRef);
      const data = await apiGet<StudentCalendarLesson[]>(
        `/lessons?studentId=${encodeURIComponent(studentId)}&from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setLessons(data);
    } catch (error) {
      console.error(error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, monthRef]);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons, refreshKey]);

  const calendarDays = useMemo(() => {
    const tz = getAppTimezone();
    const monthStart = getStartOfMonthInAppTz(monthRef, tz);
    const monthEnd = getEndOfMonthInAppTz(monthRef, tz);
    const startKey = getDateKeyInAppTz(monthStart, tz);
    const endKey = getDateKeyInAppTz(monthEnd, tz);
    const mondayOffset = weekdayMon0(monthStart, tz);
    const gridStart = addAppDays(monthStart, -mondayOffset, tz);
    const cells: Array<{ date: Date; key: string; inMonth: boolean }> = [];

    for (let i = 0; i < 42; i++) {
      const date = addAppDays(gridStart, i, tz);
      const key = getDateKeyInAppTz(date, tz);
      cells.push({ date, key, inMonth: key >= startKey && key <= endKey });
    }
    return cells;
  }, [monthRef]);

  const lessonsByDay = useMemo(() => {
    const tz = getAppTimezone();
    const map = new Map<string, StudentCalendarLesson[]>();
    for (const lesson of lessons) {
      const key = getDateKeyInAppTz(lesson.startsAt, tz);
      const list = map.get(key) ?? [];
      list.push(lesson);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [lessons]);

  const prevMonth = () => setMonthRef((m) => getStartOfMonthInAppTz(addAppDays(m, -1)));
  const nextMonth = () => setMonthRef((m) => getStartOfMonthInAppTz(addAppDays(m, 32)));
  const goToday = () => setMonthRef(getStartOfMonthInAppTz(new Date()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-white/10 p-2 text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="min-w-[11rem] text-center text-base font-semibold capitalize text-white">
            {formatMonthYearRu(monthRef)}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-white/10 p-2 text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
            aria-label="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={goToday}>
          Сегодня
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-white/45">Загрузка календаря...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/12 bg-black/20">
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.05]">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="border-r border-white/8 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white/70 last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, key, inMonth }, index) => {
              const dayLessons = lessonsByDay.get(key) ?? [];
              const dayNum = Number(key.split("-")[2]);
              const today = isTodayInAppTz(date);
              const past = inMonth && isBeforeTodayInAppTz(date) && !today;
              const isLastCol = (index + 1) % 7 === 0;
              const isLastRow = index >= 35;

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[6.25rem] border-b border-r border-white/8 p-1.5",
                    isLastCol && "border-r-0",
                    isLastRow && "border-b-0",
                    inMonth ? "bg-white/[0.02]" : "bg-black/30 opacity-45",
                    past && "bg-white/[0.01]",
                    today && "bg-brand-amber/[0.06]"
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                        today && "bg-brand-amber text-black",
                        !today && inMonth && "text-white/80",
                        !inMonth && "text-white/35"
                      )}
                    >
                      {dayNum}
                    </span>
                    {dayLessons.length > 0 ? (
                      <span className="text-[10px] text-white/35">{dayLessons.length}</span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {dayLessons.slice(0, 3).map((lesson) => {
                      const st = lessonStatusTag(lesson.status);
                      const selected = lesson.id === selectedLessonId;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => onSelectLesson(lesson)}
                          className={cn(
                            "flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight transition-all hover:brightness-110",
                            statusChipClass(lesson.status, selected)
                          )}
                          title={`${lesson.subject.name} · ${formatTimeRu(lesson.startsAt)} · ${st.label}`}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(lesson.status))} />
                          <span className="truncate">
                            {formatTimeRu(lesson.startsAt)} {lesson.subject.name}
                          </span>
                        </button>
                      );
                    })}
                    {dayLessons.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => onSelectLesson(dayLessons[3])}
                        className="w-full pl-1 text-[10px] text-brand-yellow hover:underline"
                      >
                        +{dayLessons.length - 3} ещё
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-xs text-white/40">Статусы:</span>
        {(["SCHEDULED", "COMPLETED", "CANCELLED", "MOVED"] as const).map((status) => {
          const st = lessonStatusTag(status);
          return (
            <Tag key={status} variant={st.variant}>
              {st.label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
