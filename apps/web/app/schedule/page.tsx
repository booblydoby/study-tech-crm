"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LessonDetailModal } from "@/components/lesson-detail-modal";
import { LessonAttendanceModal } from "@/components/lesson-attendance-modal";
import { LessonCancelModal } from "@/components/lesson-cancel-modal";
import { apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getCachedUser, type CurrentUser } from "@/lib/auth";
import {
  addAppDays,
  formatDateWithWeekdayRu,
  formatTimeRu,
  getEndOfDayInAppTz,
  getStartOfDayInAppTz,
  isTodayInAppTz
} from "@/lib/payment-cycle";
import { CalendarPlus, RefreshCw, Sparkles, Trash2, Users, XCircle } from "lucide-react";
import { Tag, lessonStatusTag } from "@/components/ui/tag";

type LessonTypeFilter = "all" | "group" | "individual";

interface Lesson {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  isReplacementLesson?: boolean;
  subject: { name: string };
  group?: { name: string } | null;
  student?: { fullName: string } | null;
  teacher: { fullName: string };
}

interface GenerateResult {
  created: number;
  skipped: number;
  issues?: Array<{ groupName: string; reason: string }>;
}

export default function SchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [lastIssues, setLastIssues] = useState<GenerateResult["issues"]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<LessonTypeFilter>("all");

  const canMarkAttendance = user?.role === "ADMIN" || user?.role === "TEACHER";

  useEffect(() => {
    setUser(getCachedUser());
    void loadSchedule();
  }, [weeks]);

  const loadSchedule = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const from = getStartOfDayInAppTz(new Date());
      const to = getEndOfDayInAppTz(addAppDays(new Date(), weeks * 7 - 1));
      const data = await apiGet<Lesson[]>(
        `/lessons?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setLessons(data);
    } catch (error) {
      console.error(error);
      setLoadError("Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  };

  const openLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setDetailOpen(true);
  };

  const openAttendance = (lessonId: string) => {
    setDetailOpen(false);
    setSelectedLessonId(lessonId);
    setAttendanceOpen(true);
  };

  const openCancel = (lessonId: string) => {
    setDetailOpen(false);
    setSelectedLessonId(lessonId);
    setCancelOpen(true);
  };

  const clearFuture = async () => {
    if (!confirm("Удалить ВСЕ будущие групповые занятия?")) return;
    setGenerating(true);
    try {
      const result = await apiPost<{ deleted: number }>("/lessons/clear-future-schedule", {});
      alert(`Удалено занятий: ${result.deleted}`);
      void loadSchedule();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Не удалось очистить";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const generateSchedule = async () => {
    if (!confirm("Удалить будущие занятия и создать заново из активных групп?")) return;
    setGenerating(true);
    setLastIssues([]);
    try {
      const result = await apiPost<GenerateResult>("/lessons/generate-schedule", {
        weeks: Number(weeks),
        replaceFuture: true
      });
      setLastIssues(result.issues ?? []);
      const issueText = result.issues?.length
        ? `\n\nПропущенные группы:\n${result.issues.map((i) => `• ${i.groupName}: ${i.reason}`).join("\n")}`
        : "";
      alert(`Создано: ${result.created}. Пропущено: ${result.skipped}.${issueText}`);
      void loadSchedule();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Ошибка сервера";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const groupedLessons = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      const key = formatDateWithWeekdayRu(lesson.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lesson);
    }
    return Array.from(map.entries());
  }, [lessons]);

  const todayLabel = formatDateWithWeekdayRu(new Date());

  const matchesTypeFilter = (lesson: Lesson) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "individual") return lesson.type === "INDIVIDUAL";
    return lesson.type === "GROUP";
  };

  const filteredLessonsCount = useMemo(
    () => lessons.filter(matchesTypeFilter).length,
    [lessons, typeFilter]
  );

  return (
    <AppShell allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Расписание"
          description={`Сегодня: ${todayLabel}. Нажмите на занятие, чтобы увидеть участников.`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={2}>2 недели</option>
            <option value={4}>4 недели</option>
            <option value={8}>8 недель</option>
          </select>
          <Button variant="outline" onClick={() => void loadSchedule()}><RefreshCw size={16} />Обновить</Button>
          {user?.role === "ADMIN" ? (
            <>
              <Button variant="outline" onClick={() => void clearFuture()} disabled={generating} className="text-red-600">
                <Trash2 size={16} />Очистить будущие
              </Button>
              <Button onClick={() => void generateSchedule()} disabled={generating}>
                <CalendarPlus size={18} />
                {generating ? "..." : "Сгенерировать заново"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "all" as const, label: "Все занятия", dot: null },
            { id: "group" as const, label: "Групповые", dot: "group" as const },
            { id: "individual" as const, label: "Индивидуальные", dot: "individual" as const }
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTypeFilter(item.id)}
            className={`admin-filter-chip ${typeFilter === item.id ? "admin-filter-chip-active" : ""}`}
          >
            {item.dot ? <span className={`admin-filter-dot admin-filter-dot-${item.dot}`} /> : null}
            {item.label}
          </button>
        ))}
      </div>

      {user?.role === "ADMIN" ? (
        <div className="admin-callout mb-4">
          Новый студент в группе появляется в слотах автоматически. Индивидуальные занятия создаются
          при добавлении ученика и отмечены оранжевой полосой слева.
        </div>
      ) : null}

      {lastIssues && lastIssues.length > 0 ? (
        <div className="admin-callout mb-4 border-amber-500/20">
          <p className="font-medium text-brand-yellow">Группы без генерации:</p>
          <ul className="mt-2 list-inside list-disc text-white/55">
            {lastIssues.map((issue) => (
              <li key={`${issue.groupName}-${issue.reason}`}>{issue.groupName} — {issue.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loadError ? (
        <div className="admin-badge-danger mb-4 px-4 py-3 text-sm">{loadError}</div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-slate-500">Загрузка...</div>
      ) : lessons.length === 0 ? (
        <div className="py-8 text-center text-white/45">Нет занятий на выбранный период</div>
      ) : filteredLessonsCount === 0 ? (
        <div className="py-8 text-center text-white/45">Нет занятий для выбранного фильтра</div>
      ) : (
        <div className="space-y-6 admin-stagger">
          {groupedLessons.map(([dateLabel, dayLessons]) => {
            const visibleLessons = dayLessons.filter(matchesTypeFilter);
            if (visibleLessons.length === 0) return null;
            const isToday = visibleLessons.some((l) => isTodayInAppTz(l.startsAt));
            return (
            <section key={dateLabel}>
              <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${isToday ? "text-brand-yellow" : "text-white/45"}`}>
                {dateLabel}{isToday ? " · сегодня" : ""}
              </h2>
              <div className="space-y-2">
                {visibleLessons.map((lesson) => {
                  const isIndividual = lesson.type === "INDIVIDUAL";
                  const status = lessonStatusTag(lesson.status);
                  return (
                  <Card
                    key={lesson.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openLesson(lesson.id)}
                    onKeyDown={(e) => e.key === "Enter" && openLesson(lesson.id)}
                    className={`admin-lesson-row flex cursor-pointer flex-col gap-3 !p-4 md:flex-row md:items-center md:gap-4 ${
                      lesson.status === "CANCELLED" ? "opacity-55" : ""
                    } ${isIndividual ? "admin-lesson-row--individual" : ""} ${isToday ? "admin-lesson-row--today" : ""}`}
                  >
                    <div className="w-20 shrink-0 font-semibold text-brand-yellow">{formatTimeRu(lesson.startsAt)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white/90">{lesson.group?.name ?? lesson.student?.fullName ?? lesson.subject.name}</div>
                      <div className="text-sm text-white/45">{lesson.subject.name} · {lesson.teacher.fullName}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag variant={status.variant}>{status.label}</Tag>
                      {isIndividual ? (
                        <Tag variant="brand">
                          <Sparkles size={12} /> Индив.
                        </Tag>
                      ) : (
                        <Tag variant="group">Группа</Tag>
                      )}
                      {lesson.isReplacementLesson ? (
                        <Tag variant="warning">Перенос</Tag>
                      ) : null}
                    </div>
                    {canMarkAttendance && lesson.status !== "CANCELLED" ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAttendance(lesson.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:border-brand-amber/40 hover:bg-brand-amber/10 hover:text-brand-yellow"
                        >
                          <Users size={14} />
                          Посещаемость
                        </button>
                        {lesson.status === "SCHEDULED" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCancel(lesson.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2 py-1 text-xs font-medium text-rose-300 transition-colors hover:border-rose-400/40 hover:bg-rose-500/10"
                          >
                            <XCircle size={14} />
                            Отменить
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                  );
                })}
              </div>
            </section>
          );
          })}
        </div>
      )}

      <LessonDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLessonId(null);
        }}
        lessonId={selectedLessonId}
        canMarkAttendance={canMarkAttendance}
        onMarkAttendance={openAttendance}
        onUpdated={() => void loadSchedule()}
      />

      {selectedLessonId ? (
        <>
          <LessonCancelModal
            isOpen={cancelOpen}
            onClose={() => {
              setCancelOpen(false);
              setSelectedLessonId(null);
            }}
            lessonId={selectedLessonId}
            onSuccess={() => {
              setCancelOpen(false);
              setSelectedLessonId(null);
              void loadSchedule();
            }}
          />
          <LessonAttendanceModal
            isOpen={attendanceOpen}
            onClose={() => {
              setAttendanceOpen(false);
              setSelectedLessonId(null);
            }}
            lessonId={selectedLessonId}
            onSuccess={() => void loadSchedule()}
          />
        </>
      ) : null}
    </AppShell>
  );
}
