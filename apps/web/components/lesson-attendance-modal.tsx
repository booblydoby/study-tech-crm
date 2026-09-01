"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { apiGet, apiPost } from "@/lib/api";
import { dateOnlyToIsoStartInAppTz, formatDateWithWeekdayRu, formatTimeRu, lessonStatusLabelRu } from "@/lib/payment-cycle";
import { Snowflake, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface RosterStudent {
  studentId: string;
  fullName: string;
  avatarId?: number;
  enrollmentId: string | null;
  isFrozen: boolean;
  frozenUntil: string | null;
  freezeReason: string | null;
}

interface LessonRoster {
  lesson: {
    id: string;
    status: string;
    type: string;
    startsAt: string;
    groupName: string | null;
    subjectName: string;
  };
  students: RosterStudent[];
  attendance: Array<{ studentId: string; status: AttendanceStatus; comment?: string | null }>;
}

interface LessonAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  onSuccess: () => void;
}

const statusOptions: Array<{ value: AttendanceStatus; label: string; activeClass: string }> = [
  { value: "PRESENT", label: "Был", activeClass: "admin-chip-active-present" },
  { value: "ABSENT", label: "Пропуск", activeClass: "admin-chip-active-absent" },
  { value: "LATE", label: "Опоздал", activeClass: "admin-chip-active-late" },
  { value: "EXCUSED", label: "Уважит.", activeClass: "admin-chip-active-excused" },
];

export function LessonAttendanceModal({ isOpen, onClose, lessonId, onSuccess }: LessonAttendanceModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<LessonRoster | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [completeLesson, setCompleteLesson] = useState(true);
  const [freezeFor, setFreezeFor] = useState<RosterStudent | null>(null);
  const [freezeUntil, setFreezeUntil] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  useEffect(() => {
    if (isOpen && lessonId) void loadRoster();
  }, [isOpen, lessonId]);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const data = await apiGet<LessonRoster>(`/lessons/${lessonId}/roster`);
      setRoster(data);
      const initial: Record<string, AttendanceStatus> = {};
      for (const student of data.students) {
        const existing = data.attendance.find((a) => a.studentId === student.studentId);
        initial[student.studentId] = existing?.status ?? (student.isFrozen ? "EXCUSED" : "PRESENT");
      }
      setStatuses(initial);
      setCompleteLesson(data.lesson.status !== "COMPLETED");
    } catch (error) {
      console.error(error);
      alert("Не удалось загрузить список студентов");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!roster) return;
    if (roster.lesson.status === "CANCELLED" || roster.lesson.status === "MOVED") {
      alert("Нельзя сохранить посещаемость для отменённого или перенесённого занятия");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/attendance/lesson/${lessonId}`, {
        items: roster.students.map((student) => ({
          studentId: student.studentId,
          status: statuses[student.studentId] ?? "ABSENT",
        })),
        completeLesson,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Не удалось сохранить посещаемость");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!confirm("Отменить проведение занятия? Счётчик пройденных занятий будет скорректирован.")) return;
    setSaving(true);
    try {
      await apiPost(`/lessons/${lessonId}/reopen`, {});
      onSuccess();
      void loadRoster();
    } catch (error) {
      console.error(error);
      alert("Не удалось отменить проведение");
    } finally {
      setSaving(false);
    }
  };

  const handleFreeze = async () => {
    if (!freezeFor?.enrollmentId || !freezeUntil || !freezeReason.trim()) {
      alert("Укажите дату окончания и причину заморозки");
      return;
    }
    setSaving(true);
    try {
      const result = await apiPost<{
        paymentShift?: {
          missedLessons: number;
          previousNextPaymentDue: string | null;
          newNextPaymentDue: string | null;
        };
      }>(`/enrollments/${freezeFor.enrollmentId}/freeze`, {
        frozenUntil: dateOnlyToIsoStartInAppTz(freezeUntil),
        reason: freezeReason.trim(),
      });
      setFreezeFor(null);
      setFreezeUntil("");
      setFreezeReason("");
      void loadRoster();
      onSuccess();
      const shift = result.paymentShift;
      if (shift?.missedLessons && shift.newNextPaymentDue) {
        alert(
          `Заморозка применена.\n` +
            `Пропущено занятий по расписанию: ${shift.missedLessons}.\n` +
            `Следующая оплата сдвинута на ${new Date(shift.newNextPaymentDue).toLocaleDateString("ru-RU")}.`
        );
      }
    } catch (error) {
      console.error(error);
      alert("Не удалось заморозить");
    } finally {
      setSaving(false);
    }
  };

  const handleUnfreeze = async (enrollmentId: string) => {
    setSaving(true);
    try {
      await apiPost(`/enrollments/${enrollmentId}/unfreeze`, {});
      void loadRoster();
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Не удалось разморозить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Посещаемость"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {roster?.lesson.status === "COMPLETED" ? (
              <Button type="button" variant="outline" onClick={() => void handleReopen()} disabled={saving}>
                <Undo2 size={16} className="mr-1" />
                Отменить проведение
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Закрыть
            </Button>
            {roster && roster.lesson.status !== "CANCELLED" && roster.lesson.status !== "MOVED" ? (
              <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {loading || !roster ? (
        <div className="py-8 text-center text-white/45">Загрузка...</div>
      ) : roster.lesson.status === "CANCELLED" || roster.lesson.status === "MOVED" ? (
        <div className="space-y-3 py-4 text-sm">
          <p className="text-rose-300">
            Это занятие {lessonStatusLabelRu(roster.lesson.status).toLowerCase()}. Посещаемость здесь не отмечается.
          </p>
          {roster.lesson.status === "CANCELLED" ? (
            <p className="text-white/60">
              Закройте окно и откройте карточку занятия — там можно создать перенос на другую дату.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="admin-info-box">
            <p className="title">{roster.lesson.groupName ?? roster.lesson.subjectName}</p>
            <p className="text-white/65">
              {formatDateWithWeekdayRu(roster.lesson.startsAt)} · {formatTimeRu(roster.lesson.startsAt)}
            </p>
            <p className="text-white/45">Статус: {lessonStatusLabelRu(roster.lesson.status)}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={completeLesson}
              onChange={(e) => setCompleteLesson(e.target.checked)}
              className="size-4 rounded border-white/20"
            />
            Отметить занятие как проведённое (для присутствовавших +1 к прогрессу)
          </label>

          <div className="space-y-3">
            {roster.students.length === 0 ? (
              <p className="text-sm text-white/45">В занятии нет студентов</p>
            ) : (
              roster.students.map((student) => (
                <div key={student.studentId} className="admin-surface p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar avatarId={student.avatarId} name={student.fullName} size="sm" />
                      <div>
                        <p className="font-medium text-white/90">{student.fullName}</p>
                        {student.isFrozen ? (
                          <p className="text-xs text-amber-400">
                            Заморожен до{" "}
                            {student.frozenUntil ? new Date(student.frozenUntil).toLocaleDateString("ru-RU") : "—"}
                            {student.freezeReason ? ` · ${student.freezeReason}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {student.enrollmentId ? (
                      <div className="flex gap-1">
                        {student.isFrozen ? (
                          <button
                            type="button"
                            onClick={() => void handleUnfreeze(student.enrollmentId!)}
                            className="text-xs text-brand-yellow hover:underline"
                            disabled={saving}
                          >
                            Разморозить
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFreezeFor(student)}
                            className="flex items-center gap-1 text-xs text-white/55 hover:text-white/85"
                            disabled={saving}
                          >
                            <Snowflake size={12} /> Заморозить
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatuses((prev) => ({ ...prev, [student.studentId]: option.value }))}
                        className={cn(
                          "admin-chip",
                          statuses[student.studentId] === option.value && option.activeClass
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {freezeFor ? (
            <div className="admin-surface space-y-3 border-sky-500/20 p-4">
              <p className="text-sm font-medium text-white/90">Заморозка: {freezeFor.fullName}</p>
              <p className="text-xs text-white/55">
                Студент временно не посещает занятия. Дата следующей оплаты сдвинется на число пропущенных занятий по
                расписанию группы.
              </p>
              <Input type="date" value={freezeUntil} onChange={(e) => setFreezeUntil(e.target.value)} />
              <Input
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="Причина (отпуск, болезнь...)"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setFreezeFor(null)}>
                  Отмена
                </Button>
                <Button type="button" onClick={() => void handleFreeze()} disabled={saving}>
                  Заморозить
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
