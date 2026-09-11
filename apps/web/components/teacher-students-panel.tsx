"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDateRu, formatSchedule } from "@/lib/payment-cycle";

export interface TeacherEnrollment {
  id: string;
  type: string;
  status: string;
  schedulePattern?: unknown;
  student: { fullName: string; phone?: string | null };
  subject: { name: string };
  group?: { name: string; id?: string } | null;
  breakStart?: string | null;
  breakEnd?: string | null;
}

interface GroupOption {
  id: string;
  name: string;
  subject: { name: string };
}

interface EditorSlot {
  id: string;
  days: number[];
  time: string;
  duration: number;
}

const dayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" }
];

const slotId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

function scheduleToSlots(pattern: unknown): EditorSlot[] {
  const make = (s: { daysOfWeek?: number[]; time?: string; duration?: number }): EditorSlot => ({
    id: slotId(),
    days: s.daysOfWeek ?? [],
    time: s.time ?? "17:30",
    duration: s.duration ?? 90
  });
  if (pattern && typeof pattern === "object") {
    const obj = pattern as { slots?: unknown; daysOfWeek?: number[]; time?: string; duration?: number };
    if (Array.isArray(obj.slots) && obj.slots.length > 0) {
      return obj.slots.map((s) => make(s as { daysOfWeek?: number[]; time?: string; duration?: number }));
    }
    if (Array.isArray(obj.daysOfWeek) && obj.daysOfWeek.length > 0) return [make(obj)];
  }
  return [{ id: slotId(), days: [1, 3, 5], time: "17:30", duration: 90 }];
}

function isOnBreak(e: TeacherEnrollment) {
  if (!e.breakStart) return false;
  const now = Date.now();
  if (new Date(e.breakStart).getTime() > now) return false;
  if (!e.breakEnd) return true;
  return now < new Date(e.breakEnd).getTime();
}

export function TeacherStudentsPanel({
  enrollments,
  onRefresh
}: {
  enrollments: TeacherEnrollment[];
  onRefresh: () => void;
}) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [transferTarget, setTransferTarget] = useState<TeacherEnrollment | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [scheduleTarget, setScheduleTarget] = useState<TeacherEnrollment | null>(null);
  const [editorSlots, setEditorSlots] = useState<EditorSlot[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    void apiGet<GroupOption[]>("/teachers/me/groups")
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  const openTransfer = (e: TeacherEnrollment) => {
    setTransferTarget(e);
    setTargetGroupId("");
  };

  const submitTransfer = async () => {
    if (!transferTarget || !targetGroupId) return;
    setSavingTransfer(true);
    try {
      await apiPost(`/enrollments/${transferTarget.id}/transfer-group`, { targetGroupId });
      setTransferTarget(null);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось перевести ученика");
    } finally {
      setSavingTransfer(false);
    }
  };

  const openSchedule = (e: TeacherEnrollment) => {
    setScheduleTarget(e);
    setEditorSlots(scheduleToSlots(e.schedulePattern));
  };

  const saveSchedule = async () => {
    if (!scheduleTarget) return;
    setSavingSchedule(true);
    try {
      await apiPatch(`/enrollments/${scheduleTarget.id}/schedule`, {
        slots: editorSlots.map(({ days, time, duration }) => ({
          daysOfWeek: days,
          time,
          duration
        }))
      });
      setScheduleTarget(null);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось сохранить расписание");
    } finally {
      setSavingSchedule(false);
    }
  };

  if (enrollments.length === 0) {
    return <Card className="py-12 text-center text-slate-500">Нет активных учеников</Card>;
  }

  return (
    <>
      <div className="space-y-3">
        {enrollments.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.student.fullName}</span>
                  {isOnBreak(e) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">На перерыве</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {e.subject.name} · {e.type === "GROUP" ? `Группа: ${e.group?.name ?? "—"}` : "Индивидуально"}
                </p>
                {e.type === "INDIVIDUAL" && (
                  <p className="mt-1 text-xs text-slate-400">Расписание: {formatSchedule(e.schedulePattern)}</p>
                )}
                {e.student.phone && <p className="mt-1 text-xs text-slate-400">{e.student.phone}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {e.type === "GROUP" && (
                  <button
                    onClick={() => openTransfer(e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    <ArrowRightLeft size={14} />
                    Перевести
                  </button>
                )}
                {e.type === "INDIVIDUAL" && (
                  <button
                    onClick={() => openSchedule(e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    <CalendarClock size={14} />
                    Расписание
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title="Перевести в другую группу"
        footer={null}
      >
        {transferTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Ученик: <strong>{transferTarget.student.fullName}</strong>
            </p>
            <select
              value={targetGroupId}
              onChange={(ev) => setTargetGroupId(ev.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">Выберите группу</option>
              {groups
                .filter((g) => g.id !== transferTarget.group?.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.subject.name})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferTarget(null)} disabled={savingTransfer}>
                Отмена
              </Button>
              <Button onClick={() => void submitTransfer()} disabled={!targetGroupId || savingTransfer}>
                {savingTransfer ? "Перевод..." : "Перевести"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        title="Изменить расписание"
        footer={null}
      >
        {scheduleTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {scheduleTarget.student.fullName} · {scheduleTarget.subject.name}
            </p>
            {editorSlots.map((slot, index) => (
              <div key={slot.id} className="space-y-2 rounded-lg border p-3">
                <p className="text-xs font-medium text-slate-500">Слот {index + 1}</p>
                <div className="flex flex-wrap gap-1">
                  {dayOptions.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() =>
                        setEditorSlots((prev) =>
                          prev.map((s) =>
                            s.id === slot.id
                              ? {
                                  ...s,
                                  days: s.days.includes(d.value)
                                    ? s.days.filter((x) => x !== d.value)
                                    : [...s.days, d.value]
                                }
                              : s
                          )
                        )
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        slot.days.includes(d.value) ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    value={slot.time}
                    onChange={(ev) =>
                      setEditorSlots((prev) =>
                        prev.map((s) => (s.id === slot.id ? { ...s, time: ev.target.value } : s))
                      )
                    }
                  />
                  <Input
                    type="number"
                    value={slot.duration}
                    onChange={(ev) =>
                      setEditorSlots((prev) =>
                        prev.map((s) =>
                          s.id === slot.id ? { ...s, duration: parseInt(ev.target.value, 10) || 60 } : s
                        )
                      )
                    }
                    placeholder="мин"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setEditorSlots((prev) => [...prev, { id: slotId(), days: [], time: "17:30", duration: 90 }])
              }
              className="text-sm text-primary hover:underline"
            >
              + Добавить время
            </button>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setScheduleTarget(null)} disabled={savingSchedule}>
                Отмена
              </Button>
              <Button onClick={() => void saveSchedule()} disabled={savingSchedule}>
                {savingSchedule ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
