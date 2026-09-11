"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Sparkles, Users, Wallet, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LessonCancelModal } from "@/components/lesson-cancel-modal";
import { LessonAttendanceModal } from "@/components/lesson-attendance-modal";
import { TeacherEarnings } from "@/components/teacher-earnings";
import { TeacherStudentsPanel, type TeacherEnrollment } from "@/components/teacher-students-panel";
import { apiGet } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import {
  formatDateWithWeekdayRu,
  formatTimeRu,
  getStartOfDayInAppTz,
  getEndOfDayInAppTz,
  addAppDays,
  isSameAppDay
} from "@/lib/payment-cycle";

interface Lesson {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  enrollment?: { id: string; student: { fullName: string } } | null;
  group?: { name: string } | null;
  student?: { fullName: string } | null;
  subject: { name: string };
}

interface Enrollment extends TeacherEnrollment {}

type Tab = "today" | "week" | "students" | "earnings";

const statusLabel: Record<string, string> = {
  SCHEDULED: "Запланировано",
  COMPLETED: "Проведено",
  CANCELLED: "Отменено",
  MOVED: "Перенесено"
};

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  if (status === "MOVED") return "bg-amber-100 text-amber-700";
  return "bg-sky-100 text-sky-700";
}

function lessonTitle(lesson: Lesson) {
  return lesson.group?.name ?? lesson.student?.fullName ?? lesson.enrollment?.student?.fullName ?? lesson.subject.name;
}

export default function TeacherWorkspacePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const me = await getCurrentUser();
      setUser(me);

      const now = new Date();
      const from = addAppDays(now, -7);
      const to = getEndOfDayInAppTz(addAppDays(now, 28));

      const [lessonsData, enrollmentsData] = await Promise.all([
        apiGet<Lesson[]>(`/lessons?from=${from.toISOString()}&to=${to.toISOString()}`),
        apiGet<Enrollment[]>("/enrollments")
      ]);
      setLessons(lessonsData);
      setEnrollments(enrollmentsData.filter((e) => e.status !== "CANCELLED"));
    } catch (error) {
      console.error("Failed to load teacher workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const todayLessons = useMemo(
    () =>
      lessons.filter((l) => isSameAppDay(l.startsAt, new Date())).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [lessons]
  );

  const weekLessons = useMemo(() => {
    const start = getStartOfDayInAppTz(new Date());
    const end = addAppDays(new Date(), 7);
    return lessons
      .filter((l) => {
        const t = new Date(l.startsAt);
        return t >= start && t < end;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [lessons]);

  const groupedWeek = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of weekLessons) {
      const key = formatDateWithWeekdayRu(lesson.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lesson);
    }
    return Array.from(map.entries());
  }, [weekLessons]);

  const stats = useMemo(() => {
    const weekStart = getStartOfDayInAppTz(new Date());
    const weekEnd = addAppDays(new Date(), 7);

    const inWeek = lessons.filter((l) => {
      const t = new Date(l.startsAt);
      return t >= weekStart && t < weekEnd;
    });

    const subjects = new Set(enrollments.map((e) => e.subject.name));

    return {
      today: todayLessons.length,
      todayDone: todayLessons.filter((l) => l.status === "COMPLETED").length,
      weekTotal: inWeek.length,
      weekDone: inWeek.filter((l) => l.status === "COMPLETED").length,
      students: enrollments.length,
      subjects: subjects.size
    };
  }, [lessons, todayLessons, enrollments]);

  const openAttendance = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setAttendanceOpen(true);
  };

  const openCancel = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setCancelOpen(true);
  };

  const tabs: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
    { id: "today", label: "Сегодня", icon: Clock },
    { id: "week", label: "Неделя", icon: CalendarDays },
    { id: "students", label: "Ученики", icon: Users },
    { id: "earnings", label: "Доход", icon: Wallet }
  ];

  const renderLessonActions = (lesson: Lesson) => {
    if (lesson.status === "CANCELLED") return null;
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => openAttendance(lesson.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Users size={15} />
          {lesson.status === "COMPLETED" ? "Изменить" : "Посещаемость"}
        </button>
        {lesson.status === "SCHEDULED" ? (
          <button
            onClick={() => openCancel(lesson.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            <XCircle size={15} />
            Отменить
          </button>
        ) : null}
      </div>
    );
  };

  const renderLessonCard = (lesson: Lesson) => {
    const individual = lesson.type === "INDIVIDUAL";
    return (
      <Card
        key={lesson.id}
        className={`grid gap-3 p-4 md:grid-cols-[88px_1fr_auto] md:items-center ${
          lesson.status === "CANCELLED" ? "opacity-60" : ""
        } ${individual ? "border-violet-200 bg-violet-50/40" : ""}`}
      >
        <div>
          <div className="text-lg font-semibold">{formatTimeRu(lesson.startsAt)}</div>
          <div className="text-xs text-slate-500">{formatTimeRu(lesson.endsAt)}</div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{lessonTitle(lesson)}</span>
            {individual ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                <Sparkles size={12} /> Индив.
              </span>
            ) : (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">Группа</span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">{lesson.subject.name}</div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(lesson.status)}`}>
            {statusLabel[lesson.status] ?? lesson.status}
          </span>
          {renderLessonActions(lesson)}
        </div>
      </Card>
    );
  };

  return (
    <AppShell allowedRoles={["TEACHER", "ADMIN"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={user?.fullName ? `Здравствуйте, ${user.fullName.split(" ")[0]}` : "Кабинет преподавателя"}
          description="Расписание, посещаемость и ваши ученики — всё в одном месте."
        />
        <Link
          href="/schedule"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <CalendarDays size={16} />
          Полное расписание
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Сегодня", value: stats.today, hint: `${stats.todayDone} проведено` },
          { label: "На неделе", value: stats.weekTotal, hint: `${stats.weekDone} проведено` },
          { label: "Учеников", value: stats.students, hint: "активных записей" },
          { label: "Предметов", value: stats.subjects, hint: "направлений" }
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-border hover:bg-accent"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Загрузка...</div>
      ) : (
        <>
          {activeTab === "today" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Сегодня, {formatDateWithWeekdayRu(new Date())}. Прошедшие занятия тоже можно отметить.
              </p>
              {todayLessons.length === 0 ? (
                <Card className="py-12 text-center text-slate-500">
                  <p>На сегодня занятий нет в системе.</p>
                  <p className="mt-2 text-xs">
                    Проверьте вкладку «Неделя» или попросите администратора сгенерировать расписание.
                  </p>
                </Card>
              ) : (
                todayLessons.map(renderLessonCard)
              )}
            </div>
          )}

          {activeTab === "week" && (
            <div className="space-y-6">
              {groupedWeek.length === 0 ? (
                <Card className="py-12 text-center text-slate-500">На ближайшую неделю занятий нет</Card>
              ) : (
                groupedWeek.map(([dateLabel, dayLessons]) => (
                  <section key={dateLabel}>
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{dateLabel}</h2>
                    <div className="space-y-2">{dayLessons.map(renderLessonCard)}</div>
                  </section>
                ))
              )}
            </div>
          )}

          {activeTab === "students" && (
            <TeacherStudentsPanel enrollments={enrollments} onRefresh={() => void loadAll()} />
          )}

          {activeTab === "earnings" && user?.teacherId ? (
            <TeacherEarnings teacherId={user.teacherId} />
          ) : activeTab === "earnings" ? (
            <Card className="py-12 text-center text-slate-500">Профиль преподавателя не привязан к аккаунту</Card>
          ) : null}
        </>
      )}

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
              void loadAll();
            }}
          />
          <LessonAttendanceModal
            isOpen={attendanceOpen}
            onClose={() => {
              setAttendanceOpen(false);
              setSelectedLessonId(null);
            }}
            lessonId={selectedLessonId}
            onSuccess={() => void loadAll()}
          />
        </>
      ) : null}
    </AppShell>
  );
}
