"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import {
  buildDateTimeInAppTz,
  formatDateWithWeekdayRu,
  formatTimeRu,
  lessonStatusLabelRu
} from "@/lib/payment-cycle";
import { Users } from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface LessonRoster {
  lesson: {
    id: string;
    status: string;
    type: string;
    startsAt: string;
    groupName: string | null;
    subjectName: string;
    cancellationReason?: string | null;
    isReplacementLesson?: boolean;
    originalLessonId?: string | null;
  };
  students: Array<{
    studentId: string;
    fullName: string;
    enrollmentId: string | null;
    isFrozen: boolean;
    frozenUntil: string | null;
    freezeReason: string | null;
  }>;
  attendance: Array<{ studentId: string; status: AttendanceStatus }>;
  replacementLessons?: Array<{ id: string; startsAt: string; endsAt: string; status: string }>;
  originalLesson?: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    cancellationReason: string | null;
  } | null;
}

const attendanceLabel: Record<AttendanceStatus, string> = {
  PRESENT: "Был",
  ABSENT: "Пропуск",
  LATE: "Опоздал",
  EXCUSED: "Уважит."
};

interface LessonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string | null;
  canMarkAttendance?: boolean;
  onMarkAttendance?: (lessonId: string) => void;
  onUpdated?: () => void;
}

export function LessonDetailModal({
  isOpen,
  onClose,
  lessonId,
  canMarkAttendance,
  onMarkAttendance,
  onUpdated
}: LessonDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState<LessonRoster | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    if (isOpen && lessonId) void loadRoster(lessonId);
    if (!isOpen) {
      setRoster(null);
      setRescheduleDate("");
      setRescheduleTime("");
    }
  }, [isOpen, lessonId]);

  const loadRoster = async (id: string) => {
    setLoading(true);
    try {
      setRoster(await apiGet<LessonRoster>(`/lessons/${id}/roster`));
    } catch (error) {
      console.error(error);
      alert("Не удалось загрузить участников занятия");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const submitReschedule = async () => {
    if (!lessonId || !rescheduleDate || !rescheduleTime) {
      alert("Укажите дату и время переноса");
      return;
    }
    setSavingReschedule(true);
    try {
      const { startsAt, endsAt } = buildDateTimeInAppTz(rescheduleDate, rescheduleTime);
      const result = await apiPost<{ replacement: { startsAt: string } }>(`/lessons/${lessonId}/reschedule`, {
        newStartsAt: startsAt,
        newEndsAt: endsAt
      });
      alert(
        `Перенос создан: ${formatDateWithWeekdayRu(result.replacement.startsAt)} · ${formatTimeRu(result.replacement.startsAt)}`
      );
      await loadRoster(lessonId);
      onUpdated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось создать перенос";
      alert(message);
    } finally {
      setSavingReschedule(false);
    }
  };

  const canMark =
    roster && (roster.lesson.status === "SCHEDULED" || roster.lesson.status === "COMPLETED");
  const isCancelled = roster?.lesson.status === "CANCELLED";
  const needsReschedule =
    isCancelled && (!roster.replacementLessons || roster.replacementLessons.length === 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Занятие"
      footer={
        <div className="flex w-full items-center gap-2">
          {canMarkAttendance && lessonId && onMarkAttendance && canMark ? (
            <Button variant="outline" onClick={() => onMarkAttendance(lessonId)}>
              <Users size={16} className="mr-1" />
              Посещаемость
            </Button>
          ) : null}
          <Button onClick={onClose} className="ml-auto">
            Закрыть
          </Button>
        </div>
      }
    >
      {loading || !roster ? (
        <div className="py-8 text-center text-white/45">Загрузка...</div>
      ) : (
        <div className="space-y-4">
          <div className="admin-surface p-3 text-sm">
            <p className="font-medium text-base text-white">
              {roster.lesson.groupName ?? roster.lesson.subjectName}
            </p>
            <p className="text-white/70">
              {formatDateWithWeekdayRu(roster.lesson.startsAt)} · {formatTimeRu(roster.lesson.startsAt)}
            </p>
            <p className="text-white/50">
              {roster.lesson.subjectName} · {roster.lesson.type === "GROUP" ? "Групповое" : "Индивидуальное"} ·{" "}
              {lessonStatusLabelRu(roster.lesson.status)}
            </p>
            {roster.lesson.cancellationReason ? (
              <p className="mt-1 text-rose-300">Причина отмены: {roster.lesson.cancellationReason}</p>
            ) : null}
          </div>

          {isCancelled ? (
            <p className="admin-surface border-rose-500/20 px-3 py-2 text-sm text-rose-200">
              Отменённое занятие нельзя отметить по посещаемости — только перенос или новое занятие в расписании.
            </p>
          ) : null}

          {roster.replacementLessons && roster.replacementLessons.length > 0 ? (
            <div className="admin-surface border-amber-500/20 p-3 text-sm">
              <p className="font-medium text-brand-yellow">Перенесено на:</p>
              <ul className="mt-2 space-y-1 text-white/70">
                {roster.replacementLessons.map((item) => (
                  <li key={item.id}>
                    {formatDateWithWeekdayRu(item.startsAt)} · {formatTimeRu(item.startsAt)} ·{" "}
                    {lessonStatusLabelRu(item.status).toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {needsReschedule && canMarkAttendance ? (
            <div className="admin-surface space-y-3 border-amber-500/20 p-3 text-sm">
              <p className="font-medium text-brand-yellow">Перенос не создан</p>
              <p className="text-white/60">
                При отмене, видимо, не была выбрана опция «Перенести занятие». Создайте перенос сейчас:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </div>
              <Button onClick={() => void submitReschedule()} disabled={savingReschedule}>
                {savingReschedule ? "Сохранение..." : "Создать перенос"}
              </Button>
            </div>
          ) : null}

          {roster.originalLesson ? (
            <div className="admin-surface p-3 text-sm">
              <p className="font-medium text-white/90">Это перенос занятия</p>
              <p className="mt-1 text-white/60">
                Вместо: {formatDateWithWeekdayRu(roster.originalLesson.startsAt)} ·{" "}
                {formatTimeRu(roster.originalLesson.startsAt)} (
                {lessonStatusLabelRu(roster.originalLesson.status).toLowerCase()})
              </p>
              {roster.originalLesson.cancellationReason ? (
                <p className="mt-1 text-white/45">Причина: {roster.originalLesson.cancellationReason}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium text-white/80">
              Участники ({roster.students.length})
            </p>
            {roster.students.length === 0 ? (
              <p className="text-sm text-white/45">
                Нет студентов в группе. Добавьте их в раздел «Группы».
              </p>
            ) : (
              <ul className="divide-y divide-white/8 overflow-hidden rounded-lg border border-white/10">
                {roster.students.map((student) => {
                  const att = roster.attendance.find((a) => a.studentId === student.studentId);
                  return (
                    <li key={student.studentId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-white/90">{student.fullName}</span>
                        {student.isFrozen ? (
                          <span className="ml-2 text-xs text-amber-400">
                            заморожен
                            {student.frozenUntil
                              ? ` до ${new Date(student.frozenUntil).toLocaleDateString("ru-RU")}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                      {isCancelled ? (
                        <span className="text-xs text-rose-400">занятие отменено</span>
                      ) : att ? (
                        <span className="admin-tag admin-tag-neutral">{attendanceLabel[att.status]}</span>
                      ) : (
                        <span className="text-xs text-white/35">ожидается</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
