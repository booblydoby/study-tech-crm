"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import { dateOnlyToIsoStartInAppTz, formatDateRu, todayDateInputInAppTz } from "@/lib/payment-cycle";
import { ArrowLeft, Save, Users, RotateCcw, UserMinus, UserPlus, Trash2 } from "lucide-react";

interface GroupDetail {
  id: string;
  name: string;
  subject: { id: string; name: string };
  monthlyPrice: number;
  schedulePattern: { daysOfWeek: number[]; time: string; duration: number } | null;
  status: string;
  teachers: { teacher: { id: string; fullName: string } }[];
  students: { student: { id: string; fullName: string } }[];
}

interface GroupStudent {
  id: string;
  studentId: string;
  fullName: string;
  phone: string | null;
  avatarId?: number;
  status: string;
  joinedAt: string;
  price: number;
  isCustomPrice: boolean;
}

interface Teacher {
  id: string;
  fullName: string;
}

const dayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" }
];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit mode for group settings
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editScheduleDays, setEditScheduleDays] = useState<number[]>([]);
  const [editScheduleTime, setEditScheduleTime] = useState("18:00");
  const [editScheduleDuration, setEditScheduleDuration] = useState(90);

  // Track price changes per student
  const [studentPrices, setStudentPrices] = useState<Record<string, number>>({});
  const [savingPriceFor, setSavingPriceFor] = useState<string | null>(null);

  // Add student modal
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [allStudents, setAllStudents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [addStudentId, setAddStudentId] = useState("");
  const [addStudentStartDate, setAddStudentStartDate] = useState(() => todayDateInputInAppTz());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, studentsData, teachersData] = await Promise.all([
        apiGet<GroupDetail>(`/groups/${groupId}`),
        apiGet<GroupStudent[]>(`/groups/${groupId}/students`),
        apiGet<Teacher[]>("/teachers")
      ]);
      setGroup(groupData);
      setStudents(studentsData);
      setTeachers(teachersData);

      // Initialize edit fields
      setEditName(groupData.name);
      setEditPrice(groupData.monthlyPrice);
      setEditTeacherId(groupData.teachers[0]?.teacher?.id ?? "");
      if (groupData.schedulePattern) {
        setEditScheduleDays(groupData.schedulePattern.daysOfWeek);
        setEditScheduleTime(groupData.schedulePattern.time);
        setEditScheduleDuration(groupData.schedulePattern.duration);
      }

      // Initialize student prices
      const prices: Record<string, number> = {};
      studentsData.forEach((s) => {
        prices[s.studentId] = s.price;
      });
      setStudentPrices(prices);
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) loadData();
  }, [loadData, groupId]);

  const handleSaveGroup = async () => {
    const scheduleChanged =
      group &&
      (JSON.stringify(editScheduleDays.sort()) !== JSON.stringify(group.schedulePattern?.daysOfWeek?.sort() ?? []) ||
        editScheduleTime !== (group.schedulePattern?.time ?? "") ||
        editScheduleDuration !== (group.schedulePattern?.duration ?? 90));
    const priceChanged = group && editPrice !== group.monthlyPrice;

    setSaving(true);
    try {
      await apiPatch(`/groups/${groupId}`, {
        name: editName,
        monthlyPrice: editPrice,
        teacherId: editTeacherId,
        schedulePattern: {
          daysOfWeek: editScheduleDays,
          time: editScheduleTime,
          duration: editScheduleDuration
        }
      });
      await loadData();
      if (scheduleChanged) {
        alert(
          "Расписание группы сохранено. Чтобы занятия появились в календаре, откройте «Расписание» и нажмите «Сгенерировать»."
        );
      } else if (priceChanged) {
        alert("Цена группы обновлена. Тарифы учеников без индивидуальной цены и открытые начисления пересчитаны.");
      }
    } catch (error) {
      console.error("Failed to update group:", error);
      alert("Не удалось обновить группу");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPrices = async () => {
    if (!confirm("Применить цену группы ко всем ученикам? Индивидуальные цены будут сброшены, начисления пересчитаны."))
      return;
    setSaving(true);
    try {
      await apiPost(`/groups/${groupId}/sync-prices`, {});
      await loadData();
      alert("Цены группы применены ко всем ученикам");
    } catch (error) {
      console.error("Failed to sync prices:", error);
      alert("Не удалось синхронизировать цены");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudentPrice = async (studentId: string) => {
    setSavingPriceFor(studentId);
    try {
      await apiPatch(`/groups/${groupId}/students/${studentId}/price`, {
        price: studentPrices[studentId]
      });
      loadData();
    } catch (error) {
      console.error("Failed to update student price:", error);
      alert("Не удалось сохранить цену ученика");
    } finally {
      setSavingPriceFor(null);
    }
  };

  const handleResetStudentPrice = async (studentId: string) => {
    setSavingPriceFor(studentId);
    try {
      await apiDelete(`/groups/${groupId}/students/${studentId}/price`);
      loadData();
    } catch (error) {
      console.error("Failed to reset student price:", error);
      alert("Не удалось сбросить цену ученика");
    } finally {
      setSavingPriceFor(null);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Убрать «${studentName}» из группы?`)) return;
    try {
      await apiDelete(`/groups/${groupId}/students/${studentId}`);
      loadData();
    } catch (error) {
      console.error("Failed to remove student:", error);
      alert("Не удалось убрать студента");
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`Полностью удалить группу «${group?.name}»? Это необратимо.`)) return;
    try {
      await apiDelete(`/groups/${groupId}`);
      router.push("/groups");
    } catch (error) {
      console.error("Failed to delete group:", error);
      alert("Не удалось удалить группу");
    }
  };

  const handleAddStudent = async () => {
    if (!addStudentId || !addStudentStartDate) return;
    setSavingPriceFor("add");
    try {
      await apiPost(`/groups/${groupId}/students`, {
        studentId: addStudentId,
        startDate: dateOnlyToIsoStartInAppTz(addStudentStartDate)
      });
      setAddStudentId("");
      setAddStudentStartDate(todayDateInputInAppTz());
      setShowAddStudent(false);
      loadData();
    } catch (error) {
      console.error("Failed to add student:", error);
      alert("Не удалось добавить студента");
    } finally {
      setSavingPriceFor(null);
    }
  };

  const openAddStudent = async () => {
    try {
      const all = await apiGet<Array<{ id: string; fullName: string }>>("/students");
      setAllStudents(all.filter((s) => !students.some((gs) => gs.studentId === s.id)));
      setAddStudentStartDate(todayDateInputInAppTz());
      setShowAddStudent(true);
    } catch (error) {
      console.error("Failed to load students:", error);
    }
  };

  const toggleDay = (day: number) => {
    setEditScheduleDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  if (loading) {
    return (
      <AppShell allowedRoles={["ADMIN"]}>
        <div className="text-center py-8 text-slate-500">Загрузка...</div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell allowedRoles={["ADMIN"]}>
        <div className="text-center py-8 text-slate-500">Группа не найдена</div>
      </AppShell>
    );
  }

  const totalCustomPrices = students.filter((s) => s.isCustomPrice).length;

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => router.push("/groups")} className="rounded-lg p-2 text-white/70 hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-brand-yellow">{group.name}</h1>
          <p className="text-sm text-white/50">
            {group.subject.name} · {group.status === "ACTIVE" ? "Активна" : group.status}
          </p>
        </div>
        <Button variant="outline" onClick={handleDeleteGroup} className="text-rose-300 hover:border-rose-400/40">
          <Trash2 size={16} className="mr-1" /> Удалить группу
        </Button>
      </div>

      <div className="admin-card mb-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white/90">Настройки группы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Цена (сум)</label>
            <Input type="number" value={editPrice} onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Преподаватель</label>
            <Select value={editTeacherId} onChange={(e) => setEditTeacherId(e.target.value)}>
              <option value="">Выберите преподавателя</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дни</label>
            <div className="flex gap-1.5">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`admin-day-btn size-8 ${editScheduleDays.includes(day.value) ? "active" : "inactive"}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Время</label>
            <Input type="time" value={editScheduleTime} onChange={(e) => setEditScheduleTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Длительность (мин)</label>
            <Input
              type="number"
              value={editScheduleDuration}
              onChange={(e) => setEditScheduleDuration(parseInt(e.target.value) || 90)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSaveGroup} disabled={saving}>
            <Save size={16} className="mr-1" /> {saving ? "Сохранение..." : "Сохранить"}
          </Button>
          <Button variant="outline" onClick={handleSyncPrices} disabled={saving}>
            <RotateCcw size={16} className="mr-1" /> Сбросить цены
          </Button>
        </div>
      </div>

      {/* Students List */}
      <div className="admin-card overflow-hidden !p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90">
            <Users size={20} /> Ученики ({students.length})
          </h2>
          <div className="flex items-center gap-2">
            {totalCustomPrices > 0 && (
              <span className="admin-badge-warn px-2 py-1 text-xs">{totalCustomPrices} со своей ценой</span>
            )}
            <Button variant="outline" onClick={openAddStudent} className="text-sm">
              <UserPlus size={14} className="mr-1" /> Добавить
            </Button>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="p-6 text-center text-slate-500">В группе нет учеников</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/[0.03]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-white/40">Ученик</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-white/40">Телефон</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-white/40">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-white/40">Цена</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-white/40"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {students.map((s) => (
                  <tr key={s.id} className="admin-table-row">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 font-medium text-white/90">
                        <Avatar avatarId={s.avatarId} name={s.fullName} size="sm" />
                        {s.fullName}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-white/55">{s.phone || "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`admin-tag ${s.status === "ACTIVE" ? "admin-tag-success" : "admin-tag-neutral"}`}
                      >
                        {s.status === "ACTIVE" ? "Активен" : s.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={studentPrices[s.studentId] ?? s.price}
                          onChange={(e) =>
                            setStudentPrices((prev) => ({
                              ...prev,
                              [s.studentId]: parseInt(e.target.value) || 0
                            }))
                          }
                          className="w-32 text-sm"
                        />
                        {s.isCustomPrice && <span className="text-xs text-amber-400">(своя)</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => handleSaveStudentPrice(s.studentId)}
                          disabled={savingPriceFor === s.studentId}
                          className="h-8 w-8 p-0"
                        >
                          <Save size={14} />
                        </Button>
                        {s.isCustomPrice && (
                          <Button
                            variant="ghost"
                            onClick={() => handleResetStudentPrice(s.studentId)}
                            disabled={savingPriceFor === s.studentId}
                            title="Reset to group price"
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw size={14} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => handleRemoveStudent(s.studentId, s.fullName)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                          title="Remove from group"
                        >
                          <UserMinus size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal isOpen={showAddStudent} onClose={() => setShowAddStudent(false)} title="Добавить ученика" footer={null}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/85">Студент *</label>
            <Select value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)}>
              <option value="">Выберите студента</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-white/85">Начало занятий *</label>
            <Input
              type="date"
              value={addStudentStartDate}
              onChange={(e) => setAddStudentStartDate(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-white/45">
              Занятия до этой даты не будут отображаться в посещаемости и календаре ученика.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={savingPriceFor === "add" || !addStudentId || !addStudentStartDate}
            >
              {savingPriceFor === "add" ? "Добавление..." : "Добавить"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
