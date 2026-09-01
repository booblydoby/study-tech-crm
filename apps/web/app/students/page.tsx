"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { CreateStudentForm } from "@/components/create-student-form";
import { LessonCancelModal } from "@/components/lesson-cancel-modal";
import { LessonAttendanceModal } from "@/components/lesson-attendance-modal";
import { StudentLessonCalendar, type StudentCalendarLesson } from "@/components/student-lesson-calendar";
import {
  LessonRescheduleModal,
  StudentLessonActionPanel,
  StudentReplacementModal,
} from "@/components/student-lesson-actions";
import { cn } from "@/lib/utils";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { RoleButton } from "@/components/role-button";
import { apiGet, apiDelete, apiPost, apiPatch } from "@/lib/api";
import { formatSchedule, dateOnlyToIsoStartInAppTz, formatDateRu, isoToDateInputInAppTz, isBeforeTodayInAppTz, todayDateInputInAppTz } from "@/lib/payment-cycle";

import { Tag, studentStatusTag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { AvatarId } from "@/lib/avatars";

interface Enrollment {
  id: string;
  subject: { name: string };
  teacher: { fullName: string };
  type: string;
  price: number;
  teacherCommission?: number;
  paymentPeriod: string;
  billable?: boolean;
  startDate?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  schedulePattern?: unknown;
  group?: { id?: string; name?: string; schedulePattern?: unknown } | null;
}

interface Student {
  id: string;
  fullName: string;
  phone?: string;
  telegram?: string;
  parentPhone?: string;
  status: string;
  source?: string;
  avatarId?: number;
  user?: { email: string } | null;
  enrollments: Enrollment[];
  charges?: Array<{
    id: string;
    dueAmount: number;
    status: string;
    periodFrom: string;
    enrollment?: { subject: { name: string } } | null;
    payments: { amount: number }[];
  }>;
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
  { value: 0, label: "Вс" },
];

const slotEditorId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function scheduleToEditorSlots(pattern: unknown): EditorSlot[] {
  const make = (s: { daysOfWeek?: number[]; time?: string; duration?: number }): EditorSlot => ({
    id: slotEditorId(),
    days: s.daysOfWeek ?? [],
    time: s.time ?? "17:30",
    duration: s.duration ?? 90,
  });
  if (pattern && typeof pattern === "object") {
    const obj = pattern as { slots?: unknown; daysOfWeek?: number[]; time?: string; duration?: number };
    if (Array.isArray(obj.slots) && obj.slots.length > 0) {
      return obj.slots.map((s) => make(s as { daysOfWeek?: number[]; time?: string; duration?: number }));
    }
    if (Array.isArray(obj.daysOfWeek) && obj.daysOfWeek.length > 0) {
      return [make(obj)];
    }
  }
  return [{ id: slotEditorId(), days: [1, 3, 5], time: "17:30", duration: 90 }];
}

export default function StudentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showReset, setShowReset] = useState(false);

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editorSlots, setEditorSlots] = useState<EditorSlot[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [breakEnrollment, setBreakEnrollment] = useState<Enrollment | null>(null);
  const [breakUntil, setBreakUntil] = useState("");
  const [breakReason, setBreakReason] = useState("");
  const [savingBreak, setSavingBreak] = useState(false);

  const [financeDrafts, setFinanceDrafts] = useState<Record<string, { price: number; teacherCommission: number }>>({});
  const [savingFinanceId, setSavingFinanceId] = useState<string | null>(null);
  const [savingStartDateId, setSavingStartDateId] = useState<string | null>(null);
  const [startDateDrafts, setStartDateDrafts] = useState<Record<string, string>>({});
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [studentTab, setStudentTab] = useState<"calendar" | "profile">("calendar");
  const [selectedCalendarLesson, setSelectedCalendarLesson] = useState<StudentCalendarLesson | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [cancelLessonOpen, setCancelLessonOpen] = useState(false);
  const [rescheduleLessonOpen, setRescheduleLessonOpen] = useState(false);
  const [replacementLessonOpen, setReplacementLessonOpen] = useState(false);
  const [attendanceLessonOpen, setAttendanceLessonOpen] = useState(false);
  const [lessonActionLoading, setLessonActionLoading] = useState(false);

  const getFinanceDraft = (enrollment: Enrollment) =>
    financeDrafts[enrollment.id] ?? {
      price: enrollment.price,
      teacherCommission: enrollment.teacherCommission ?? 0
    };

  const getStartDateDraft = (enrollment: Enrollment) => {
    if (startDateDrafts[enrollment.id]) return startDateDrafts[enrollment.id];
    if (!enrollment.startDate) return todayDateInputInAppTz();
    return isoToDateInputInAppTz(enrollment.startDate);
  };

  const saveEnrollmentStartDate = async (enrollment: Enrollment) => {
    const startDate = getStartDateDraft(enrollment);
    if (!startDate) return;
    setSavingStartDateId(enrollment.id);
    try {
      await apiPatch(`/enrollments/${enrollment.id}`, {
        startDate: dateOnlyToIsoStartInAppTz(startDate)
      });
      setStartDateDrafts((prev) => {
        const next = { ...prev };
        delete next[enrollment.id];
        return next;
      });
      await loadStudents();
      if (selectedStudent) {
        const updated = await apiGet<Student>(`/students/${selectedStudent.id}`);
        setSelectedStudent(updated);
      }
    } catch (error) {
      console.error(error);
      alert("Не удалось сохранить дату начала занятий");
    } finally {
      setSavingStartDateId(null);
    }
  };

  const updateFinanceDraft = (
    enrollmentId: string,
    enrollment: Enrollment,
    patch: Partial<{ price: number; teacherCommission: number }>
  ) => {
    setFinanceDrafts((prev) => {
      const base = prev[enrollmentId] ?? {
        price: enrollment.price,
        teacherCommission: enrollment.teacherCommission ?? 0
      };
      return { ...prev, [enrollmentId]: { ...base, ...patch } };
    });
  };

  const saveEnrollmentFinance = async (enrollment: Enrollment) => {
    const draft = getFinanceDraft(enrollment);
    if (draft.price < 0) {
      alert("Цена не может быть отрицательной");
      return;
    }
    if (draft.teacherCommission < 0 || draft.teacherCommission > 100) {
      alert("Процент учителя должен быть от 0 до 100");
      return;
    }
    setSavingFinanceId(enrollment.id);
    try {
      await apiPatch(`/enrollments/${enrollment.id}`, {
        price: draft.price,
        teacherCommission: draft.teacherCommission
      });
      setFinanceDrafts((prev) => {
        const next = { ...prev };
        delete next[enrollment.id];
        return next;
      });
      await refreshStudentData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось сохранить тариф. ${message}`);
    } finally {
      setSavingFinanceId(null);
    }
  };

  const openScheduleEditor = (enrollment: Enrollment) => {
    setEditingScheduleId(enrollment.id);
    setEditorSlots(scheduleToEditorSlots(enrollment.schedulePattern));
  };

  const closeScheduleEditor = () => {
    setEditingScheduleId(null);
    setEditorSlots([]);
  };

  const addEditorSlot = () => {
    setEditorSlots((prev) => [...prev, { id: slotEditorId(), days: [], time: "17:30", duration: 90 }]);
  };

  const removeEditorSlot = (id: string) => {
    setEditorSlots((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  };

  const toggleEditorDay = (id: string, day: number) => {
    setEditorSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day] }
          : s
      )
    );
  };

  const updateEditorSlot = (id: string, patch: Partial<EditorSlot>) => {
    setEditorSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const toggleBillable = async (enrollment: Enrollment) => {
    const next = !(enrollment.billable ?? true);
    try {
      await apiPatch(`/enrollments/${enrollment.id}`, { billable: next });
      await refreshStudentData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось изменить учёт оплаты. ${message}`);
    }
  };

  const openBreak = (enrollment: Enrollment) => {
    setBreakEnrollment(enrollment);
    setBreakUntil("");
    setBreakReason("");
  };

  const closeBreak = () => {
    setBreakEnrollment(null);
    setBreakUntil("");
    setBreakReason("");
  };

  const submitBreak = async () => {
    if (!breakEnrollment) return;
    setSavingBreak(true);
    try {
      await apiPost(`/enrollments/${breakEnrollment.id}/break`, {
        until: breakUntil ? dateOnlyToIsoStartInAppTz(breakUntil) : undefined,
        reason: breakReason || undefined
      });
      closeBreak();
      await refreshStudentData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось поставить перерыв. ${message}`);
    } finally {
      setSavingBreak(false);
    }
  };

  const endBreak = async (enrollment: Enrollment) => {
    if (!confirm("Завершить перерыв? Запись снова станет активной, оплата будет ожидаться с сегодняшнего дня.")) return;
    try {
      await apiPost(`/enrollments/${enrollment.id}/break/end`, {});
      await refreshStudentData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось завершить перерыв. ${message}`);
    }
  };

  const removeEnrollment = async (enrollment: Enrollment) => {
    const isGroup = enrollment.type === "GROUP";
    const confirmText = isGroup
      ? `Убрать ${selectedStudent?.fullName ?? "студента"} из группы по предмету «${enrollment.subject.name}»?`
      : `Удалить индивидуальную запись по предмету «${enrollment.subject.name}»?`;
    if (!confirm(confirmText)) return;
    try {
      await apiDelete(`/enrollments/${enrollment.id}`);
      await refreshStudentData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось удалить запись. ${message}`);
    }
  };

  const saveSchedule = async () => {
    if (!editingScheduleId) return;
    const slots = editorSlots
      .filter((s) => s.days.length > 0 && s.time)
      .map((s) => ({ daysOfWeek: s.days, time: s.time, duration: s.duration || 60 }));
    if (slots.length === 0) {
      alert("Добавьте хотя бы один день и время");
      return;
    }
    setSavingSchedule(true);
    try {
      await apiPatch(`/enrollments/${editingScheduleId}/schedule`, { slots });
      closeScheduleEditor();
      await refreshStudentData();
      alert("Расписание обновлено, занятия пересозданы");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Проверьте данные.";
      alert(`Не удалось сохранить расписание. ${message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent || !resetPassword) return;
    try {
      await apiPost(`/students/${selectedStudent.id}/reset-password`, {
        newPassword: resetPassword,
      });
      alert("Пароль обновлён");
      setResetPassword("");
      setShowReset(false);
    } catch (error) {
      console.error("Failed to reset password:", error);
      alert("Не удалось сбросить пароль");
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await apiGet<Student[]>("/students");
      setStudents(data);
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить студента «${name}»? Это необратимо.`)) return;
    try {
      await apiDelete(`/students/${id}`);
      loadStudents();
    } catch (error) {
      console.error("Failed to delete student:", error);
      alert("Не удалось удалить студента");
    }
  };

  const handleViewStudent = async (id: string) => {
    try {
      const data = await apiGet<Student>(`/students/${id}`);
      setSelectedStudent(data);
      setStudentTab("calendar");
      setSelectedCalendarLesson(null);
    } catch (error) {
      console.error("Failed to load student:", error);
      alert("Не удалось загрузить карточку студента");
    }
  };

  const closeStudentModal = () => {
    setSelectedStudent(null);
    setStudentTab("calendar");
    setSelectedCalendarLesson(null);
    closeScheduleEditor();
    setFinanceDrafts({});
  };

  const refreshCalendar = () => setCalendarRefreshKey((k) => k + 1);

  const handleLessonReopen = async () => {
    if (!selectedCalendarLesson) return;
    if (!confirm("Отменить проведение занятия? Счётчик прогресса будет скорректирован.")) return;
    setLessonActionLoading(true);
    try {
      await apiPost(`/lessons/${selectedCalendarLesson.id}/reopen`, {});
      setSelectedCalendarLesson(null);
      refreshCalendar();
    } catch (error) {
      console.error(error);
      alert("Не удалось отменить проведение");
    } finally {
      setLessonActionLoading(false);
    }
  };

  const handleMarkLessonCompleted = async () => {
    if (!selectedCalendarLesson) return;
    if (!confirm("Отметить занятие как проведённое?")) return;
    setLessonActionLoading(true);
    try {
      await apiPost(`/lessons/${selectedCalendarLesson.id}/complete`, {});
      setSelectedCalendarLesson({ ...selectedCalendarLesson, status: "COMPLETED" });
      refreshCalendar();
    } catch (error) {
      console.error(error);
      alert("Не удалось отметить занятие проведённым");
    } finally {
      setLessonActionLoading(false);
    }
  };

  const handleCalendarRefresh = () => {
    refreshCalendar();
    if (selectedCalendarLesson) {
      void apiGet<StudentCalendarLesson>(`/lessons/${selectedCalendarLesson.id}`)
        .then((lesson) => setSelectedCalendarLesson(lesson))
        .catch(() => setSelectedCalendarLesson(null));
    }
  };

  const refreshStudentData = async () => {
    if (selectedStudent) await handleViewStudent(selectedStudent.id);
    await loadStudents();
  };

  const saveAvatar = async (avatarId: AvatarId) => {
    if (!selectedStudent) return;
    setSavingAvatar(true);
    try {
      await apiPatch(`/students/${selectedStudent.id}`, { avatarId });
      setSelectedStudent({ ...selectedStudent, avatarId });
      await loadStudents();
    } catch (error) {
      console.error(error);
      alert("Не удалось сохранить аватар");
    } finally {
      setSavingAvatar(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const formatSubjects = (enrollments: Student["enrollments"]) => {
    if (!enrollments || enrollments.length === 0) return "-";
    const names = [...new Set(enrollments.map((e) => e.subject.name))];
    return names.join(", ");
  };

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Студенты" description="Регистрация и зачисление в группы или на индивидуальные занятия." />
        <RoleButton allowedRoles={["ADMIN"]}>
          <Button onClick={() => setIsModalOpen(true)}><Plus size={18} />Новый студент</Button>
        </RoleButton>
      </div>

      <div className="mb-4 flex max-w-md items-center gap-2">
        <Search size={18} className="text-slate-400" />
        <Input 
          placeholder="Поиск по имени" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Загрузка...</div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          {search ? "Никого не найдено" : "Студентов пока нет"}
        </div>
      ) : (
        <div className="admin-card overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                <th className="px-4 py-3 text-left font-medium text-white/45">Имя</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Телефон</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Предметы</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Статус</th>
                <th className="px-4 py-3 text-right font-medium text-white/45"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const st = studentStatusTag(student.status);
                return (
                <tr key={student.id} className="admin-table-row border-b border-white/6">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewStudent(student.id)}
                      className="flex items-center gap-2 font-medium text-brand-yellow hover:underline text-left transition-opacity hover:opacity-80"
                    >
                      <Avatar avatarId={student.avatarId} name={student.fullName} size="sm" />
                      {student.fullName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white/55">{student.phone || "—"}</td>
                  <td className="px-4 py-3 text-white/55">{formatSubjects(student.enrollments)}</td>
                  <td className="px-4 py-3">
                    <Tag variant={st.variant}>{st.label}</Tag>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(student.id, student.fullName)}
                      className="rounded p-1.5 text-rose-400 transition-colors hover:bg-rose-500/10"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Новый студент"
        footer={null}
      >
        <CreateStudentForm 
          onSuccess={() => {
            setIsModalOpen(false);
            loadStudents();
          }}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* View Student Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={closeStudentModal}
        title={selectedStudent?.fullName || "Студент"}
        size="xl"
        footer={null}
      >
        {selectedStudent && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setStudentTab("calendar")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  studentTab === "calendar"
                    ? "bg-brand-amber/15 text-brand-yellow"
                    : "text-white/55 hover:text-white/80"
                )}
              >
                Календарь
              </button>
              <button
                type="button"
                onClick={() => setStudentTab("profile")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  studentTab === "profile"
                    ? "bg-brand-amber/15 text-brand-yellow"
                    : "text-white/55 hover:text-white/80"
                )}
              >
                Профиль и записи
              </button>
            </div>

            {studentTab === "calendar" ? (
              <>
                <StudentLessonCalendar
                  studentId={selectedStudent.id}
                  selectedLessonId={selectedCalendarLesson?.id}
                  refreshKey={calendarRefreshKey}
                  onSelectLesson={setSelectedCalendarLesson}
                />
                <StudentLessonActionPanel
                  lesson={selectedCalendarLesson}
                  actionLoading={lessonActionLoading}
                  onReschedule={() => setRescheduleLessonOpen(true)}
                  onCancel={() => setCancelLessonOpen(true)}
                  onMarkCompleted={() => void handleMarkLessonCompleted()}
                  onOpenAttendance={() => setAttendanceLessonOpen(true)}
                  onReopen={() => void handleLessonReopen()}
                  onCreateReplacement={() => setReplacementLessonOpen(true)}
                  onClose={() => setSelectedCalendarLesson(null)}
                />
              </>
            ) : (
              <>
            <div className="flex items-start gap-4">
              <Avatar avatarId={selectedStudent.avatarId} name={selectedStudent.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <AvatarPicker
                  value={selectedStudent.avatarId ?? 1}
                  onChange={(id) => void saveAvatar(id)}
                  disabled={savingAvatar}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-white/45">Логин:</div>
              <div className="font-medium text-white/90">{selectedStudent.user?.email || "—"}</div>
              <div className="text-white/45">Телефон:</div>
              <div className="text-white/75">{selectedStudent.phone || "-"}</div>
              <div className="text-white/45">Telegram:</div>
              <div className="text-white/75">{selectedStudent.telegram || "-"}</div>
              <div className="text-white/45">Тел. родителя:</div>
              <div className="text-white/75">{selectedStudent.parentPhone || "-"}</div>
              <div className="text-white/45">Источник:</div>
              <div className="text-white/75">{selectedStudent.source || "-"}</div>
              <div className="text-white/45">Статус:</div>
              <div>
                <Tag variant={studentStatusTag(selectedStudent.status).variant}>
                  {studentStatusTag(selectedStudent.status).label}
                </Tag>
              </div>
            </div>

            {selectedStudent.user?.email && (
              <div className="border-t border-white/10 pt-2">
                <button
                  onClick={() => setShowReset(!showReset)}
                  className="mb-2 text-sm text-brand-yellow hover:underline"
                >
                  {showReset ? "Отмена" : "Сбросить пароль"}
                </button>
                {showReset && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Новый пароль"
                      className="flex-1"
                    />
                    <Button onClick={handleResetPassword}>Сохранить</Button>
                  </div>
                )}
              </div>
            )}
            
            {(() => {
              const debt = (selectedStudent.charges ?? []).reduce((sum, c) => {
                const paid = c.payments.reduce((s, p) => s + p.amount, 0);
                const balance = c.dueAmount - paid;
                if (balance <= 0) return sum;
                const cycleStarted = isBeforeTodayInAppTz(c.periodFrom);
                if (paid === 0 && !cycleStarted) return sum;
                return sum + balance;
              }, 0);
              if (debt <= 0) return null;
              return (
                <div className="admin-badge-danger px-3 py-2 text-sm">
                  Текущий долг: <span className="font-semibold">{debt.toLocaleString("ru-RU")} сум</span>
                </div>
              );
            })()}

            {selectedStudent.enrollments.length > 0 && (
              <>
                <h4 className="border-t border-white/10 pt-2 font-medium text-white/85">Записи</h4>
                {selectedStudent.enrollments.map((e) => {
                  const schedule = e.type === "GROUP" ? e.group?.schedulePattern : e.schedulePattern;
                  const nowMs = Date.now();
                  const onBreak = Boolean(
                    e.breakStart &&
                      new Date(e.breakStart).getTime() <= nowMs &&
                      (!e.breakEnd || nowMs < new Date(e.breakEnd).getTime())
                  );
                  return (
                    <div key={e.id} className="admin-surface p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white/90">{e.subject.name}</span>
                        <div className="flex items-center gap-2">
                          <span>{e.type === "GROUP" ? "Группа" : "Индивидуально"}</span>
                          <button
                            onClick={() => removeEnrollment(e)}
                            className="text-rose-500 hover:text-rose-700"
                            title={e.type === "GROUP" ? "Убрать из группы" : "Удалить запись"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-white/50">
                        {e.teacher.fullName} · {e.paymentPeriod === "MONTHLY" ? "месяц" : "за занятия"}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div>
                          <label className="mb-1 block text-white/45">Начало занятий</label>
                          <Input
                            type="date"
                            value={getStartDateDraft(e)}
                            onChange={(ev) =>
                              setStartDateDrafts((prev) => ({ ...prev, [e.id]: ev.target.value }))
                            }
                            className="h-8 text-xs"
                          />
                          {e.startDate ? (
                            <p className="mt-1 text-[11px] text-white/35">
                              Сейчас: {formatDateRu(e.startDate)}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => void saveEnrollmentStartDate(e)}
                          disabled={savingStartDateId === e.id}
                          className="h-8 px-2"
                          title="Сохранить дату начала"
                        >
                          <Save size={14} />
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div>
                          <label className="mb-1 block text-white/45">
                            {e.paymentPeriod === "MONTHLY" ? "Цена / месяц" : "Цена / цикл"} (сум)
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={getFinanceDraft(e).price}
                            onChange={(ev) =>
                              updateFinanceDraft(e.id, e, { price: parseInt(ev.target.value, 10) || 0 })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-white/45">Доля учителя (%)</label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={getFinanceDraft(e).teacherCommission}
                            onChange={(ev) =>
                              updateFinanceDraft(e.id, e, {
                                teacherCommission: parseInt(ev.target.value, 10) || 0
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => void saveEnrollmentFinance(e)}
                          disabled={savingFinanceId === e.id}
                          className="h-8 px-2"
                          title="Сохранить тариф"
                        >
                          <Save size={14} />
                        </Button>
                      </div>
                      <div className="mt-1 text-white/50">Расписание: {formatSchedule(schedule)}</div>

                      {onBreak && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1">
                          <span className="text-amber-300">
                            На перерыве{e.breakEnd ? ` до ${new Date(e.breakEnd).toLocaleDateString("ru-RU")}` : " (бессрочно)"}
                          </span>
                          <button onClick={() => endBreak(e)} className="font-medium text-emerald-400 hover:underline">
                            Завершить
                          </button>
                        </div>
                      )}

                      <label className="mt-2 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={e.billable ?? true}
                          onChange={() => toggleBillable(e)}
                          className="size-3.5"
                        />
                        <span className="text-white/65">
                          Учитывать в выручке и оплатах
                        </span>
                      </label>
                      {!(e.billable ?? true) && (
                        <p className="mt-1 text-amber-400">
                          Не учитывается — оплата входит в другой пакет/запись.
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-3">
                        {e.type === "INDIVIDUAL" && editingScheduleId !== e.id && (
                          <button
                            onClick={() => openScheduleEditor(e)}
                            className="text-brand-yellow hover:underline"
                          >
                            Изменить расписание
                          </button>
                        )}
                        {!onBreak && (
                          <button onClick={() => openBreak(e)} className="text-amber-400 hover:underline">
                            Перерыв
                          </button>
                        )}
                      </div>

                      {e.type === "INDIVIDUAL" && editingScheduleId === e.id && (
                        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white/70">Персональное расписание</span>
                            <button onClick={addEditorSlot} className="text-blue-600 hover:underline">
                              + Добавить время
                            </button>
                          </div>
                          {editorSlots.map((slot, index) => (
                            <div key={slot.id} className="space-y-2 rounded-lg border border-white/10 p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-white/40">Слот {index + 1}</span>
                                {editorSlots.length > 1 && (
                                  <button
                                    onClick={() => removeEditorSlot(slot.id)}
                                    className="text-red-500 hover:underline"
                                  >
                                    Удалить
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {dayOptions.map((day) => (
                                  <button
                                    key={day.value}
                                    onClick={() => toggleEditorDay(slot.id, day.value)}
                                    className={`admin-day-btn size-7 ${slot.days.includes(day.value) ? "active" : "inactive"}`}
                                  >
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="time"
                                  value={slot.time}
                                  onChange={(ev) => updateEditorSlot(slot.id, { time: ev.target.value })}
                                />
                                <Input
                                  type="number"
                                  value={slot.duration}
                                  onChange={(ev) =>
                                    updateEditorSlot(slot.id, { duration: parseInt(ev.target.value, 10) || 60 })
                                  }
                                  placeholder="мин"
                                />
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={closeScheduleEditor} disabled={savingSchedule} className="h-8 px-3">
                              Отмена
                            </Button>
                            <Button onClick={saveSchedule} disabled={savingSchedule} className="h-8 px-3">
                              {savingSchedule ? "Сохранение..." : "Сохранить"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
              </>
            )}
          </div>
        )}
      </Modal>

      {selectedCalendarLesson ? (
        <>
          <LessonCancelModal
            isOpen={cancelLessonOpen}
            onClose={() => setCancelLessonOpen(false)}
            lessonId={selectedCalendarLesson.id}
            onSuccess={() => {
              setCancelLessonOpen(false);
              setSelectedCalendarLesson({ ...selectedCalendarLesson, status: "CANCELLED" });
              refreshCalendar();
            }}
          />
          <LessonAttendanceModal
            isOpen={attendanceLessonOpen}
            onClose={() => setAttendanceLessonOpen(false)}
            lessonId={selectedCalendarLesson.id}
            onSuccess={() => {
              setAttendanceLessonOpen(false);
              handleCalendarRefresh();
            }}
          />
          <LessonRescheduleModal
            isOpen={rescheduleLessonOpen}
            onClose={() => setRescheduleLessonOpen(false)}
            lessonId={selectedCalendarLesson.id}
            startsAt={selectedCalendarLesson.startsAt}
            endsAt={selectedCalendarLesson.endsAt}
            onSuccess={() => {
              setRescheduleLessonOpen(false);
              setSelectedCalendarLesson(null);
              refreshCalendar();
            }}
          />
          <StudentReplacementModal
            isOpen={replacementLessonOpen}
            onClose={() => setReplacementLessonOpen(false)}
            lessonId={selectedCalendarLesson.id}
            onSuccess={() => {
              setReplacementLessonOpen(false);
              setSelectedCalendarLesson(null);
              refreshCalendar();
            }}
          />
        </>
      ) : null}

      <Modal
        isOpen={!!breakEnrollment}
        onClose={closeBreak}
        title="Перерыв ученика"
        footer={null}
      >
        {breakEnrollment && (
          <div className="space-y-4 text-sm">
            <p className="text-white/65">
              Запись: <span className="font-medium">{breakEnrollment.subject.name}</span>{" "}
              ({breakEnrollment.type === "GROUP" ? "группа" : "индивидуально"}). На время перерыва ученик не считается
              должником, дата оплаты не горит, занятия не ставятся.
            </p>
            <div>
              <label className="mb-1 block font-medium">Дата возвращения</label>
              <Input type="date" value={breakUntil} onChange={(e) => setBreakUntil(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                Если не знаешь дату — оставь пустым. Тогда перерыв бессрочный, завершишь его вручную кнопкой «Завершить».
              </p>
            </div>
            <div>
              <label className="mb-1 block font-medium">Причина (необязательно)</label>
              <Input value={breakReason} onChange={(e) => setBreakReason(e.target.value)} placeholder="например, отпуск" />
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={closeBreak} disabled={savingBreak}>
                Отмена
              </Button>
              <Button onClick={submitBreak} disabled={savingBreak}>
                {savingBreak ? "Сохранение..." : "Поставить перерыв"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
