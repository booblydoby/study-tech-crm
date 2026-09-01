"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { buildDateTimeInAppTz, formatDateWithWeekdayRu, formatTimeRu } from "@/lib/payment-cycle";

interface LessonCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  onSuccess: () => void;
}

type CancellationType = "TEACHER" | "STUDENT" | "WEATHER" | "ILLNESS" | "OTHER";
type CancelAction = "add_debt" | "reschedule" | "adjust_payment";

export function LessonCancelModal({
  isOpen,
  onClose,
  lessonId,
  onSuccess,
}: LessonCancelModalProps) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [cancellationType, setCancellationType] = useState<CancellationType>("OTHER");
  const [action, setAction] = useState<CancelAction>("reschedule");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Пожалуйста, укажите причину отмены");
      return;
    }

    if (action === "reschedule" && (!newDate || !newTime)) {
      alert("Пожалуйста, укажите новую дату и время занятия");
      return;
    }

    setLoading(true);

    try {
      let newStartsAt: string | undefined;
      let newEndsAt: string | undefined;

      if (action === "reschedule" && newDate && newTime) {
        const built = buildDateTimeInAppTz(newDate, newTime);
        newStartsAt = built.startsAt;
        newEndsAt = built.endsAt;
      }

      const result = await apiPost<{
        replacement: { startsAt: string } | null;
      }>(`/lessons/${lessonId}/cancel-options`, {
        reason,
        cancellationType,
        action: action === "add_debt" ? "add_debt" : action === "reschedule" ? "reschedule" : "adjust_payment",
        newStartsAt,
        newEndsAt
      });

      if (action === "reschedule") {
        if (result.replacement) {
          alert(
            `Занятие отменено. Перенос: ${formatDateWithWeekdayRu(result.replacement.startsAt)} · ${formatTimeRu(result.replacement.startsAt)}`
          );
        } else {
          alert("Занятие отменено, но перенос не создан — проверьте дату и время");
        }
      } else {
        alert("Занятие отменено");
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Failed to cancel lesson:", error);
      alert("Не удалось отменить занятие");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason("");
    setCancellationType("OTHER");
    setAction("reschedule");
    setNewDate("");
    setNewTime("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Отмена занятия"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Отмена..." : "Подтвердить отмену"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Тип отмены
          </label>
          <select
            value={cancellationType}
            onChange={(e) => setCancellationType(e.target.value as CancellationType)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          >
            <option value="TEACHER">По инициативе учителя</option>
            <option value="STUDENT">По инициативе студента</option>
            <option value="ILLNESS">Болезнь</option>
            <option value="WEATHER">Погодные условия</option>
            <option value="OTHER">Другое</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Причина отмены *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
            rows={3}
            placeholder="Опишите причину отмены..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Действие после отмены
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="action"
                value="add_debt"
                checked={action === "add_debt"}
                onChange={() => setAction("add_debt")}
                className="text-blue-500"
              />
              <div>
                <div className="font-medium">Добавить в долги</div>
                <div className="text-sm text-slate-500">
                  Занятие будет добавлено в графу долгов студента
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="action"
                value="reschedule"
                checked={action === "reschedule"}
                onChange={() => setAction("reschedule")}
                className="text-blue-500"
              />
              <div>
                <div className="font-medium">Перенести занятие</div>
                <div className="text-sm text-slate-500">
                  Создать новое занятие взамен отмененного
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="action"
                value="adjust_payment"
                checked={action === "adjust_payment"}
                onChange={() => setAction("adjust_payment")}
                className="text-blue-500"
              />
              <div>
                <div className="font-medium">Сдвинуть оплату</div>
                <div className="text-sm text-slate-500">
                  Дата оплаты будет сдвинута на дополнительное занятие
                </div>
              </div>
            </label>
          </div>
        </div>

        {action === "reschedule" && (
          <div className="space-y-3 p-3 bg-slate-50 rounded-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Новая дата
                </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Время начала
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}