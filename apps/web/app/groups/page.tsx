"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

interface Subject {
  id: string;
  name: string;
}
interface Teacher {
  id: string;
  fullName: string;
}
interface Group {
  id: string;
  name: string;
  subject: { name: string; id: string };
  monthlyPrice: number;
  status: string;
  teachers: { teacher: { id: string; fullName: string } }[];
  schedulePattern: { daysOfWeek: number[]; time: string; duration: number } | null;
  students?: { student: { id: string; fullName: string } }[];
}

type StatusFilter = "ACTIVE" | "ALL" | "INACTIVE";

const dayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" }
];

const statusLabels: Record<string, string> = {
  ACTIVE: "Активна",
  INACTIVE: "Неактивна",
  ARCHIVED: "Архив"
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [formData, setFormData] = useState({
    name: "",
    subjectId: "",
    teacherId: "",
    monthlyPrice: 0,
    scheduleDays: [1, 3, 5] as number[],
    scheduleTime: "18:00",
    scheduleDuration: 90
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsData, subjectsData, teachersData] = await Promise.all([
        apiGet<Group[]>(statusFilter === "ACTIVE" ? "/groups?activeOnly=true" : "/groups"),
        apiGet<Subject[]>("/subjects"),
        apiGet<Teacher[]>("/teachers")
      ]);
      setGroups(groupsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (statusFilter === "INACTIVE" && g.status === "ACTIVE") return false;
      if (subjectFilter !== "ALL" && g.subject.id !== subjectFilter) return false;
      return true;
    });
  }, [groups, statusFilter, subjectFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/groups", {
        name: formData.name,
        subjectId: formData.subjectId,
        teacherId: formData.teacherId,
        monthlyPrice: formData.monthlyPrice,
        schedulePattern: {
          daysOfWeek: formData.scheduleDays,
          time: formData.scheduleTime,
          duration: formData.scheduleDuration
        }
      });
      setIsModalOpen(false);
      void loadData();
    } catch {
      alert("Не удалось создать группу");
    }
  };

  const handleDelete = async (group: Group, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить группу «${group.name}»?`)) return;
    try {
      await apiDelete(`/groups/${group.id}`);
      void loadData();
    } catch {
      alert("Не удалось удалить группу");
    }
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter((d) => d !== day)
        : [...prev.scheduleDays, day]
    }));
  };

  const formatSchedule = (g: Group) => {
    if (!g.schedulePattern?.daysOfWeek?.length) return "—";
    const days = g.schedulePattern.daysOfWeek.map((d) => dayOptions.find((o) => o.value === d)?.label).join(", ");
    return `${days} ${g.schedulePattern.time}`;
  };

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Группы" description="Групповые занятия по расписанию." />
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Новая группа
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ACTIVE">Активные</option>
          <option value="ALL">Все статусы</option>
          <option value="INACTIVE">Неактивные</option>
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Все предметы</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="self-center text-sm text-slate-500">Найдено: {filteredGroups.length}</span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Загрузка...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-8 text-center text-slate-500">Группы не найдены</div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              className="relative block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300"
            >
              <Link href={`/groups/${g.id}`} className="block pr-10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{g.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {g.subject?.name} · {g.teachers[0]?.teacher?.fullName ?? "—"} · {g.students?.length ?? 0} уч.
                    </p>
                    <p className="text-xs text-slate-400">{formatSchedule(g)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium">{(g.monthlyPrice / 1000).toFixed(0)}K сум</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${g.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {statusLabels[g.status] ?? g.status}
                    </span>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => void handleDelete(g, e)}
                className="absolute right-4 top-4 text-rose-600 hover:text-rose-800"
                title="Удалить"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Новая группа" footer={null}>
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-slate-500">
            Групповое занятие — несколько учеников по общему расписанию. Для индивидуальных занятий используйте раздел
            «Студенты».
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Название группы *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Напр. English A1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Предмет *</label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
                required
              >
                <option value="">Выберите предмет</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Преподаватель *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
                required
              >
                <option value="">Выберите преподавателя</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Цена за месяц (сум) *</label>
            <Input
              type="number"
              value={formData.monthlyPrice}
              onChange={(e) => setFormData({ ...formData, monthlyPrice: parseInt(e.target.value, 10) || 0 })}
              placeholder="Напр. 500000"
              required
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Дни занятий *</p>
            <div className="mb-2 flex gap-2">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`flex size-9 items-center justify-center rounded-full text-xs ${formData.scheduleDays.includes(day.value) ? "bg-blue-500 text-white" : "bg-slate-100"}`}
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
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Длительность (мин)</label>
                <Input
                  type="number"
                  value={formData.scheduleDuration}
                  onChange={(e) => setFormData({ ...formData, scheduleDuration: parseInt(e.target.value, 10) || 90 })}
                  placeholder="90"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit">Создать</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
