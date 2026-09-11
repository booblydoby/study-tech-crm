"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { AvatarId } from "@/lib/avatars";
import { apiPost, apiGet } from "@/lib/api";

interface Teacher {
  id: string;
  fullName: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  subject: { id: string; name: string };
  monthlyPrice: number;
  schedulePattern: { daysOfWeek: number[]; time: string; duration: number } | null;
  teachers: { teacher: { id: string; fullName: string } }[];
}

interface ScheduleSlot {
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

const cycleOptions = [8, 12, 16, 24];

const newSlotId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

interface CreateStudentFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function CreateStudentForm({ onSuccess, onClose }: CreateStudentFormProps) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>(1);

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [individualEnabled, setIndividualEnabled] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [individualPrice, setIndividualPrice] = useState<number | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([
    { id: newSlotId(), days: [1, 3, 5], time: "13:30", duration: 90 }
  ]);

  const [teacherCommission, setTeacherCommission] = useState(30);
  const [totalLessons, setTotalLessons] = useState(12);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teachersData, subjectsData, groupsData] = await Promise.all([
        apiGet<Teacher[]>("/teachers"),
        apiGet<Subject[]>("/subjects"),
        apiGet<Group[]>("/groups?activeOnly=true")
      ]);
      setTeachers(teachersData);
      setSubjects(subjectsData);
      setGroups(groupsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { id: newSlotId(), days: [], time: "17:30", duration: 90 }]);
  };

  const removeSlot = (id: string) => {
    setSlots((prev) => (prev.length > 1 ? prev.filter((slot) => slot.id !== id) : prev));
  };

  const toggleSlotDay = (id: string, day: number) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? {
              ...slot,
              days: slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day]
            }
          : slot
      )
    );
  };

  const updateSlot = (id: string, patch: Partial<ScheduleSlot>) => {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedGroupIds.length === 0 && !individualEnabled) {
      alert("Выберите хотя бы одну группу или включите индивидуальные занятия");
      return;
    }

    let cleanedSlots: { daysOfWeek: number[]; time: string; duration: number }[] = [];
    if (individualEnabled) {
      if (!subjectId || !teacherId) {
        alert("Для индивидуальных занятий выберите предмет и преподавателя");
        return;
      }
      if (!individualPrice || individualPrice < 1) {
        alert("Укажите стоимость цикла оплаты для индивидуальных занятий");
        return;
      }
      cleanedSlots = slots
        .filter((slot) => slot.days.length > 0 && slot.time)
        .map((slot) => ({ daysOfWeek: slot.days, time: slot.time, duration: slot.duration || 60 }));
      if (cleanedSlots.length === 0) {
        alert("Добавьте хотя бы один день и время в персональное расписание");
        return;
      }
    }

    setLoading(true);
    try {
      const studentData: Record<string, unknown> = {
        fullName,
        phone,
        telegram,
        parentPhone,
        teacherCommission,
        totalLessons,
        avatarId
      };
      if (login) studentData.login = login;
      if (password) studentData.password = password;

      if (selectedGroupIds.length > 0) {
        studentData.groupIds = selectedGroupIds;
      }

      if (individualEnabled) {
        studentData.subjectId = subjectId;
        studentData.teacherId = teacherId;
        studentData.price = individualPrice;
        studentData.paymentPeriod = "PER_LESSON";
        studentData.scheduleSlots = cleanedSlots;
      }

      await apiPost("/students", studentData);
      onSuccess();
    } catch (error) {
      console.error("Failed to create student:", error);
      const message = error instanceof Error ? error.message : "Проверьте данные.";
      alert(`Не удалось создать студента. ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-medium text-white/85">Данные студента</h3>
        <AvatarPicker value={avatarId} onChange={setAvatarId} />
        <div>
          <label className="mb-1 block text-sm font-medium">ФИО *</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Телефон</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Telegram</label>
            <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Телефон родителя</label>
          <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+998..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Логин для входа</label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ivan" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Пароль для входа</label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Student123!"
            />
          </div>
        </div>
      </div>

      {/* Групповые занятия */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-slate-700">Групповые занятия</h3>
          <p className="text-xs text-slate-500">Можно выбрать несколько групп и совмещать с индивидуальными.</p>
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 p-2">
          {groups.length === 0 ? (
            <p className="p-2 text-sm text-white/40">Нет групп. Создайте группу в разделе «Группы».</p>
          ) : (
            groups.map((group) => (
              <label
                key={group.id}
                className={`admin-option-card ${selectedGroupIds.includes(group.id) ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                  className="size-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {group.subject?.name} · {group.teachers[0]?.teacher?.fullName ?? "—"} ·{" "}
                    {group.monthlyPrice.toLocaleString()} сум
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
        {selectedGroups.length > 0 ? (
          <p className="text-sm text-slate-500">Выбрано групп: {selectedGroups.length}</p>
        ) : null}
      </div>

      {/* Индивидуальные занятия */}
      <div className="admin-surface space-y-3 p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={individualEnabled}
            onChange={(e) => setIndividualEnabled(e.target.checked)}
            className="size-4"
          />
          <div>
            <p className="text-sm font-medium text-white/90">Индивидуальные занятия</p>
            <p className="text-xs text-white/50">Гибкое персональное расписание на неделю с разным временем по дням.</p>
          </div>
        </label>

        {individualEnabled ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Предмет *</label>
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Выберите предмет</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Преподаватель *</label>
                <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">Выберите преподавателя</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Стоимость цикла оплаты (сум) *</label>
              <Input
                type="number"
                value={individualPrice ?? ""}
                onChange={(e) => setIndividualPrice(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Напр. 1200000"
              />
              <p className="mt-1 text-xs text-slate-500">
                Сумма за весь платёжный цикл (как в разделе «Оплаты»), не за одно занятие.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Персональное расписание на неделю *</p>
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={addSlot}>
                  + Добавить время
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Каждая строка — отдельные дни с одним временем. Например: Пн/Ср/Пт в 13:30 и Вт/Чт/Сб в 17:30.
              </p>
              {slots.map((slot, index) => (
                <div key={slot.id} className="admin-surface space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Слот {index + 1}</span>
                    {slots.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleSlotDay(slot.id, day.value)}
                        className={`admin-day-btn size-9 ${slot.days.includes(day.value) ? "active" : "inactive"}`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Время начала</label>
                      <Input
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlot(slot.id, { time: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Длительность (мин)</label>
                      <Input
                        type="number"
                        value={slot.duration}
                        onChange={(e) => updateSlot(slot.id, { duration: parseInt(e.target.value, 10) || 60 })}
                        placeholder="90"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Процент учителя (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={teacherCommission}
            onChange={(e) => setTeacherCommission(parseInt(e.target.value, 10) || 0)}
            placeholder="30"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Занятий в цикле</label>
          <div className="flex flex-wrap gap-2">
            {cycleOptions.map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setTotalLessons(cycle)}
                className={`rounded-lg px-3 py-1 text-sm ${
                  totalLessons === cycle
                    ? "bg-brand-amber text-black font-semibold"
                    : "border border-white/12 bg-white/5 text-white/70"
                }`}
              >
                {cycle}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Создание..." : "Создать"}
        </Button>
      </div>
    </form>
  );
}
