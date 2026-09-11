"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { dateOnlyToIsoStartInAppTz, formatDateRu, todayDateInputInAppTz } from "@/lib/payment-cycle";
import { Plus, Trash2, KeyRound, Save } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { AvatarId } from "@/lib/avatars";

interface Teacher {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  specialization?: string;
  isActive: boolean;
  avatarId?: number;
  user?: { email: string } | null;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create form
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    specialization: "",
    login: "",
    password: "",
    avatarId: 1 as AvatarId
  });

  // Edit modal
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSpecialization, setEditSpecialization] = useState("");
  const [editAvatarId, setEditAvatarId] = useState<AvatarId>(1);
  const [resetPassword, setResetPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(() => todayDateInputInAppTz());
  const [payoutComment, setPayoutComment] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [teacherFinance, setTeacherFinance] = useState<{
    accruedAllTime: number;
    paidOutAllTime: number;
    unpaidBalance: number;
    recentPayouts: Array<{ id: string; amount: number; paidAt: string; comment: string | null }>;
  } | null>(null);
  const [financeLoadFailed, setFinanceLoadFailed] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      setTeachers(await apiGet<Teacher[]>("/teachers"));
    } catch (error) {
      console.error("Failed to load teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: Record<string, string | number> = { fullName: formData.fullName };
      if (formData.phone) data.phone = formData.phone;
      if (formData.email) data.email = formData.email;
      if (formData.specialization) data.specialization = formData.specialization;
      if (formData.login) data.login = formData.login;
      if (formData.password) data.password = formData.password;
      data.avatarId = formData.avatarId;
      await apiPost("/teachers", data);
      setFormData({ fullName: "", phone: "", email: "", specialization: "", login: "", password: "", avatarId: 1 });
      setIsModalOpen(false);
      loadTeachers();
    } catch (error) {
      console.error("Failed to create teacher:", error);
      alert("Не удалось создать преподавателя");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete teacher "${name}"?`)) return;
    try {
      await apiDelete(`/teachers/${id}`);
      loadTeachers();
    } catch (error) {
      console.error("Failed to delete teacher:", error);
      alert("Не удалось удалить преподавателя");
    }
  };

  const openEdit = (teacher: Teacher) => {
    setEditTeacher(teacher);
    setEditFullName(teacher.fullName);
    setEditPhone(teacher.phone || "");
    setEditEmail(teacher.email || "");
    setEditSpecialization(teacher.specialization || "");
    setEditAvatarId((teacher.avatarId ?? 1) as AvatarId);
    setShowReset(false);
    setResetPassword("");
    setPayoutAmount("");
    setPayoutComment("");
    setPayoutDate(todayDateInputInAppTz());
    setTeacherFinance(null);
    setFinanceLoadFailed(false);
    void loadTeacherFinance(teacher.id);
  };

  const loadTeacherFinance = async (teacherId: string) => {
    setFinanceLoadFailed(false);
    try {
      const data = await apiGet<{
        accruedAllTime: number;
        paidOutAllTime: number;
        unpaidBalance: number;
        recentPayouts: Array<{ id: string; amount: number; paidAt: string; comment: string | null }>;
      }>(`/enrollments/teacher/${teacherId}/earnings`);
      setTeacherFinance(data);
    } catch (error) {
      console.error("Failed to load teacher finance:", error);
      setTeacherFinance(null);
      setFinanceLoadFailed(true);
    }
  };

  const handleRecordPayout = async () => {
    if (!editTeacher) return;
    const amount = Number(payoutAmount);
    if (!amount || amount < 1) {
      alert("Укажите сумму выплаты");
      return;
    }
    setPayoutLoading(true);
    try {
      await apiPost(`/teachers/${editTeacher.id}/payouts`, {
        amount,
        paidAt: dateOnlyToIsoStartInAppTz(payoutDate),
        comment: payoutComment || undefined
      });
      setPayoutAmount("");
      setPayoutComment("");
      await loadTeacherFinance(editTeacher.id);
    } catch (error) {
      console.error("Failed to record payout:", error);
      alert("Не удалось записать выплату");
    } finally {
      setPayoutLoading(false);
    }
  };

  const money = (n: number) => n.toLocaleString("ru-RU") + " сум";

  const handleSaveEdit = async () => {
    if (!editTeacher) return;
    setSaveLoading(true);
    try {
      await apiPatch(`/teachers/${editTeacher.id}`, {
        fullName: editFullName,
        phone: editPhone || undefined,
        email: editEmail || undefined,
        specialization: editSpecialization || undefined,
        avatarId: editAvatarId
      });
      setEditTeacher(null);
      loadTeachers();
    } catch (error) {
      console.error("Failed to update teacher:", error);
      alert("Не удалось обновить преподавателя");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editTeacher || !resetPassword) return;
    setSaveLoading(true);
    try {
      await apiPost(`/teachers/${editTeacher.id}/reset-password`, {
        newPassword: resetPassword
      });
      alert("Password reset successfully!");
      setResetPassword("");
      setShowReset(false);
    } catch (error) {
      console.error("Failed to reset password:", error);
      alert("Не удалось сбросить пароль");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Преподаватели" description="Профили и доступ в систему." />
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New teacher
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Загрузка...</div>
      ) : (
        <div className="admin-card overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                <th className="px-4 py-3 text-left font-medium text-white/45">Имя</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Email</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Специализация</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Телефон</th>
                <th className="px-4 py-3 text-left font-medium text-white/45">Статус</th>
                <th className="px-4 py-3 text-right font-medium text-white/45">Действия</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="admin-table-row border-b border-white/6">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(t)}
                      className="flex items-center gap-2 font-medium text-brand-yellow hover:underline text-left"
                    >
                      <Avatar avatarId={t.avatarId} name={t.fullName} size="sm" />
                      {t.fullName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white/55">{t.email || t.user?.email || "-"}</td>
                  <td className="px-4 py-3 text-white/55">{t.specialization || "-"}</td>
                  <td className="px-4 py-3 text-white/55">{t.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`admin-tag ${t.isActive ? "admin-tag-success" : "admin-tag-neutral"}`}>
                      {t.isActive ? "Активен" : "Неактивен"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id, t.fullName)}
                      className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Teacher Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Teacher" footer={null}>
        <form onSubmit={handleCreate} className="space-y-4">
          <AvatarPicker value={formData.avatarId} onChange={(id) => setFormData({ ...formData, avatarId: id })} />
          <div>
            <label className="mb-1 block text-sm font-medium">ФИО *</label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Jane Teacher"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+998901234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="teacher@study.local"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
            <Input
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="English, Math, etc."
            />
          </div>
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              <KeyRound size={14} /> Teacher Login Credentials
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login (email)</label>
                <Input
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  placeholder="jane@study.local"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Teacher123!"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal
        isOpen={!!editTeacher}
        onClose={() => setEditTeacher(null)}
        title={`Edit: ${editTeacher?.fullName || ""}`}
        footer={null}
      >
        {editTeacher && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Avatar avatarId={editAvatarId} name={editFullName} size="lg" />
              <div className="flex-1">
                <AvatarPicker value={editAvatarId} onChange={setEditAvatarId} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ФИО</label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
              <Input value={editSpecialization} onChange={(e) => setEditSpecialization(e.target.value)} />
            </div>

            {/* Login info */}
            <div className="admin-info-box">
              <p>
                Текущий логин:{" "}
                <span className="font-medium text-white">
                  {editTeacher.email || editTeacher.user?.email || "Нет аккаунта"}
                </span>
              </p>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="mb-2 text-sm font-medium">Выплаты преподавателю</h4>
              {teacherFinance ? (
                <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                  <div className="admin-stat-mini success">
                    <p className="label">Начислено</p>
                    <p className="value">{money(teacherFinance.accruedAllTime)}</p>
                  </div>
                  <div className="admin-stat-mini">
                    <p className="label">Выплачено</p>
                    <p className="value">{money(teacherFinance.paidOutAllTime)}</p>
                  </div>
                  <div className="admin-stat-mini warn">
                    <p className="label">К выплате</p>
                    <p className="value">{money(teacherFinance.unpaidBalance)}</p>
                  </div>
                </div>
              ) : financeLoadFailed ? (
                <p className="mb-3 text-sm text-rose-300">Не удалось загрузить финансовые данные</p>
              ) : (
                <p className="mb-3 text-sm text-white/45">Загрузка финансов...</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="Сумма"
                />
                <Input type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />
              </div>
              <Input
                className="mt-2"
                value={payoutComment}
                onChange={(e) => setPayoutComment(e.target.value)}
                placeholder="Комментарий (необязательно)"
              />
              <Button className="mt-2" onClick={handleRecordPayout} disabled={payoutLoading || !payoutAmount}>
                {payoutLoading ? "Сохранение..." : "Записать выплату"}
              </Button>
              {teacherFinance && teacherFinance.recentPayouts.length > 0 && (
                <div className="mt-3 space-y-1 text-sm">
                  {teacherFinance.recentPayouts.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex justify-between text-slate-600">
                      <span>{formatDateRu(p.paidAt)}</span>
                      <span className="font-medium">{money(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reset password */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowReset(!showReset)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <KeyRound size={14} /> {showReset ? "Cancel" : "Reset Password"}
              </button>
              {showReset && (
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="New password"
                    className="flex-1"
                  />
                  <Button onClick={handleResetPassword} disabled={saveLoading || !resetPassword}>
                    Save
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setEditTeacher(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saveLoading}>
                <Save size={16} className="mr-1" />
                {saveLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
