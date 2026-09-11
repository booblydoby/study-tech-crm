"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPatch, apiPost } from "@/lib/api";
import {
  buildDateTimeInAppTz,
  formatDateWithWeekdayRu,
  formatTimeRu,
  getAppTimezone,
  getDateKeyInAppTz,
  isBeforeTodayInAppTz,
  lessonStatusLabelRu
} from "@/lib/payment-cycle";
import { Tag, lessonStatusTag } from "@/components/ui/tag";
import type { StudentCalendarLesson } from "@/components/student-lesson-calendar";

interface LessonRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  startsAt: string;
  endsAt: string;
  onSuccess: () => void;
}

function durationMinutes(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(30, Math.round(ms / 60_000));
}

export function LessonRescheduleModal({
  isOpen,
  onClose,
  lessonId,
  startsAt,
  endsAt,
  onSuccess
}: LessonRescheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setDate("");
      setTime("");
      return;
    }
    setDate(getDateKeyFromIso(startsAt));
    setTime(toTimeInput(startsAt));
  }, [isOpen, startsAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    setLoading(true);
    try {
      const built = buildDateTimeInAppTz(date, time, durationMinutes(startsAt, endsAt));
      await apiPatch(`/lessons/${lessonId}`, {
        startsAt: built.startsAt,
        endsAt: built.endsAt
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Не удалось перенести занятие");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Перенос занятия"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" form="lesson-reschedule-form" disabled={loading}>
            {loading ? "Сохранение..." : "Перенести"}
          </Button>
        </div>
      }
    >
      <form id="lesson-reschedule-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="admin-info-box">
          <p className="title">Текущее время</p>
          <p>
            {formatDateWithWeekdayRu(startsAt)} · {formatTimeRu(startsAt)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Новая дата *</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Новое время *</label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function getDateKeyFromIso(iso: string): string {
  return getDateKeyInAppTz(iso, getAppTimezone());
}

function toTimeInput(iso: string): string {
  const t = formatTimeRu(iso);
  return t.length === 5 ? t : t.replace(".", ":");
}

interface StudentLessonActionPanelProps {
  lesson: StudentCalendarLesson | null;
  onReschedule: () => void;
  onCancel: () => void;
  onMarkCompleted: () => void;
  onOpenAttendance: () => void;
  onReopen: () => void;
  onCreateReplacement: () => void;
  onClose: () => void;
  actionLoading?: boolean;
}

export function StudentLessonActionPanel({
  lesson,
  onReschedule,
  onCancel,
  onMarkCompleted,
  onOpenAttendance,
  onReopen,
  onCreateReplacement,
  onClose,
  actionLoading
}: StudentLessonActionPanelProps) {
  if (!lesson) return null;

  const st = lessonStatusTag(lesson.status);
  const canMove = lesson.status === "SCHEDULED";
  const canCancel = lesson.status === "SCHEDULED";
  const canMarkCompleted = lesson.status === "SCHEDULED";
  const canAttendance = lesson.status === "SCHEDULED" || lesson.status === "COMPLETED";
  const canReopen = lesson.status === "COMPLETED";
  const canReplacement = lesson.status === "CANCELLED";
  const isPast = isBeforeTodayInAppTz(lesson.startsAt);

  return (
    <div className="admin-surface space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-white">{lesson.subject.name}</p>
          <p className="text-sm text-white/60">
            {formatDateWithWeekdayRu(lesson.startsAt)} · {formatTimeRu(lesson.startsAt)} — {formatTimeRu(lesson.endsAt)}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {lesson.type === "GROUP" ? (lesson.group?.name ?? "Группа") : "Индивидуально"} · {lesson.teacher.fullName}
            {lesson.isReplacementLesson ? " · перенос" : ""}
          </p>
        </div>
        <Tag variant={st.variant}>{st.label}</Tag>
      </div>

      {canMarkCompleted && isPast ? (
        <p className="text-xs text-amber-300/90">
          Занятие уже прошло — отметьте проведённым или отмените, если не состоялось.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canMarkCompleted ? (
          <Button type="button" className="h-8 px-3 text-xs" onClick={onMarkCompleted} disabled={actionLoading}>
            Проведено
          </Button>
        ) : null}
        {canAttendance ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={onOpenAttendance}
            disabled={actionLoading}
          >
            Посещаемость
          </Button>
        ) : null}
        {canMove ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={onReschedule}
            disabled={actionLoading}
          >
            Перенести
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={onCancel}
            disabled={actionLoading}
          >
            Отменить
          </Button>
        ) : null}
        {canReopen ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={onReopen}
            disabled={actionLoading}
          >
            Отменить проведение
          </Button>
        ) : null}
        {canReplacement ? (
          <Button type="button" className="h-8 px-3 text-xs" onClick={onCreateReplacement} disabled={actionLoading}>
            Создать перенос
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={onClose} disabled={actionLoading}>
          Закрыть
        </Button>
      </div>
      {lesson.status === "CANCELLED" ? (
        <p className="text-xs text-white/45">
          Статус: {lessonStatusLabelRu(lesson.status).toLowerCase()}. Можно создать новое занятие взамен отменённого.
        </p>
      ) : null}
    </div>
  );
}

interface StudentReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  onSuccess: () => void;
}

export function StudentReplacementModal({ isOpen, onClose, lessonId, onSuccess }: StudentReplacementModalProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setDate("");
      setTime("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    setLoading(true);
    try {
      const built = buildDateTimeInAppTz(date, time, 90);
      await apiPost(`/lessons/${lessonId}/reschedule`, {
        newStartsAt: built.startsAt,
        newEndsAt: built.endsAt
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Не удалось создать перенос");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Создать перенос"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" form="replacement-form" disabled={loading}>
            {loading ? "Сохранение..." : "Создать"}
          </Button>
        </div>
      }
    >
      <form id="replacement-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Дата *</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Время *</label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>
      </form>
    </Modal>
  );
}
