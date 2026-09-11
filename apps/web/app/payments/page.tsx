"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { Select } from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getCachedUser, type CurrentUser } from "@/lib/auth";
import {
  CyclePreview,
  dateOnlyToIsoStartInAppTz,
  formatDateRu,
  formatSchedule,
  isBeforeTodayInAppTz,
  todayDateInputInAppTz
} from "@/lib/payment-cycle";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Tag, chargeStatusTag } from "@/components/ui/tag";

interface Installment {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  comment?: string | null;
}

interface Charge {
  id: string;
  studentId: string;
  student: { fullName: string };
  enrollmentId?: string | null;
  enrollment?: {
    subject: { name: string };
    paymentPeriod?: "MONTHLY" | "PER_LESSON";
  } | null;
  dueAmount: number;
  paidAmount: number;
  balance: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  periodFrom: string;
  periodTo: string;
  lessonsInCycle?: number | null;
  nextPaymentDue?: string | null;
  comment?: string | null;
  payments: Installment[];
}

interface EnrollmentOption {
  id: string;
  type: "GROUP" | "INDIVIDUAL";
  subject: { name: string };
  paymentPeriod: "MONTHLY" | "PER_LESSON";
  totalLessons: number | null;
  price: number;
  schedulePattern: unknown;
  group?: { schedulePattern: unknown } | null;
}

function resolveEnrollmentSchedule(enrollment: EnrollmentOption) {
  if (enrollment.type === "GROUP") {
    return enrollment.group?.schedulePattern ?? enrollment.schedulePattern;
  }
  return enrollment.schedulePattern ?? enrollment.group?.schedulePattern;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  TRANSFER: "Перевод"
};

type FormState = {
  studentId: string;
  enrollmentId: string;
  paymentPeriod: "MONTHLY" | "PER_LESSON";
  lessonsInCycle: number;
  dueAmount: number;
  firstAmount: number;
  method: string;
  paidAt: string;
};

const createEmptyForm = (): FormState => ({
  studentId: "",
  enrollmentId: "",
  paymentPeriod: "PER_LESSON",
  lessonsInCycle: 12,
  dueAmount: 0,
  firstAmount: 0,
  method: "CASH",
  paidAt: todayDateInputInAppTz()
});

const createEmptyInstallmentForm = (): InstallmentForm => ({
  amount: 0,
  method: "CASH",
  paidAt: todayDateInputInAppTz(),
  comment: ""
});

type InstallmentForm = {
  amount: number;
  method: string;
  paidAt: string;
  comment: string;
};

export default function PaymentsPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [preview, setPreview] = useState<CyclePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [installmentCharge, setInstallmentCharge] = useState<Charge | null>(null);
  const [editCharge, setEditCharge] = useState<Charge | null>(null);
  const [editDueAmount, setEditDueAmount] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [installmentForm, setInstallmentForm] = useState<InstallmentForm>(createEmptyInstallmentForm);

  const isAdmin = user?.role === "ADMIN";
  const isMonthly = form.paymentPeriod === "MONTHLY";

  const selectedEnrollment = useMemo(
    () => enrollments.find((item) => item.id === form.enrollmentId) ?? null,
    [enrollments, form.enrollmentId]
  );

  useEffect(() => {
    setUser(getCachedUser());
    void loadData();
  }, []);

  useEffect(() => {
    if (!modalOpen || !form.enrollmentId || !form.paidAt) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await apiPost<CyclePreview>("/payments/cycle-preview", {
          enrollmentId: form.enrollmentId,
          paidAt: dateOnlyToIsoStartInAppTz(form.paidAt),
          paymentPeriod: form.paymentPeriod,
          lessonsInCycle: isMonthly ? undefined : form.lessonsInCycle
        });
        setPreview(result);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [modalOpen, form.enrollmentId, form.paidAt, form.lessonsInCycle, form.paymentPeriod, isMonthly]);

  const loadData = async () => {
    setLoading(true);
    try {
      setCharges(await apiGet<Charge[]>("/charges"));
      if (getCachedUser()?.role === "ADMIN") {
        setStudents(await apiGet<Array<{ id: string; fullName: string }>>("/students"));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Цена записи — это стоимость за весь цикл (а не за одно занятие), используем её напрямую.
  const suggestDue = (enrollment: EnrollmentOption | undefined) => {
    if (!enrollment) return 0;
    return enrollment.price;
  };

  const loadEnrollments = async (studentId: string) => {
    if (!studentId) {
      setEnrollments([]);
      return;
    }
    const data = await apiGet<EnrollmentOption[]>(`/enrollments?studentId=${studentId}`);
    setEnrollments(data);
    const pick = data[0];
    if (pick) {
      const period = pick.paymentPeriod ?? "PER_LESSON";
      const lessons = pick.totalLessons ?? 12;
      const due = suggestDue(pick);
      setForm((prev) => ({
        ...prev,
        enrollmentId: pick.id,
        paymentPeriod: period,
        lessonsInCycle: lessons,
        dueAmount: due,
        firstAmount: due
      }));
    }
  };

  const openCreate = () => {
    setForm(createEmptyForm());
    setEnrollments([]);
    setPreview(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.enrollmentId) {
      alert("Выберите запись студента");
      return;
    }
    if (!form.dueAmount || form.dueAmount < 1) {
      alert("Укажите сумму к оплате");
      return;
    }
    if (form.firstAmount < 0) {
      alert("Сумма взноса не может быть отрицательной");
      return;
    }
    try {
      await apiPost("/charges", {
        studentId: form.studentId,
        enrollmentId: form.enrollmentId,
        dueAmount: form.dueAmount,
        paidAt: dateOnlyToIsoStartInAppTz(form.paidAt),
        paymentPeriod: form.paymentPeriod,
        lessonsInCycle: isMonthly ? undefined : form.lessonsInCycle,
        firstAmount: form.firstAmount > 0 ? form.firstAmount : undefined,
        method: form.method
      });
      setModalOpen(false);
      setForm(createEmptyForm());
      void loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось создать начисление";
      alert(message);
    }
  };

  const openEditCharge = (charge: Charge) => {
    setEditCharge(charge);
    setEditDueAmount(charge.dueAmount);
  };

  const submitEditCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCharge) return;
    if (!editDueAmount || editDueAmount < 1) {
      alert("Укажите сумму к оплате");
      return;
    }
    setSavingEdit(true);
    try {
      await apiPatch(`/charges/${editCharge.id}`, { dueAmount: editDueAmount });
      setEditCharge(null);
      void loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось изменить начисление";
      alert(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const openInstallment = (charge: Charge) => {
    setInstallmentCharge(charge);
    setInstallmentForm({
      amount: charge.balance > 0 ? charge.balance : 0,
      method: "CASH",
      paidAt: todayDateInputInAppTz(),
      comment: ""
    });
  };

  const submitInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installmentCharge) return;
    if (!installmentForm.amount || installmentForm.amount < 1) {
      alert("Укажите сумму взноса");
      return;
    }
    try {
      await apiPost(`/charges/${installmentCharge.id}/payments`, {
        amount: installmentForm.amount,
        method: installmentForm.method,
        paidAt: dateOnlyToIsoStartInAppTz(installmentForm.paidAt),
        comment: installmentForm.comment || undefined
      });
      setInstallmentCharge(null);
      void loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось добавить взнос";
      alert(message);
    }
  };

  const handleDeleteCharge = async (charge: Charge) => {
    if (!confirm(`Удалить начисление ${charge.student.fullName} (${formatMoney(charge.dueAmount)}) со всеми взносами?`))
      return;
    try {
      await apiDelete(`/charges/${charge.id}`);
      void loadData();
    } catch {
      alert("Не удалось удалить начисление");
    }
  };

  const handleDeleteInstallment = async (paymentId: string) => {
    if (!confirm("Удалить этот взнос?")) return;
    try {
      await apiDelete(`/charges/payments/${paymentId}`);
      void loadData();
    } catch {
      alert("Не удалось удалить взнос");
    }
  };

  const formatMoney = (amount: number) => `${amount.toLocaleString("ru-RU")} сум`;

  // Долг считается, только если есть остаток И (что-то уже внесено ИЛИ цикл уже начался).
  const isActiveDebt = (c: Charge) => {
    if (c.balance <= 0) return false;
    if (c.paidAmount > 0) return true;
    return isBeforeTodayInAppTz(c.periodFrom);
  };

  const totals = useMemo(() => {
    return charges.reduce(
      (acc, c) => {
        acc.due += c.dueAmount;
        acc.paid += c.paidAmount;
        if (isActiveDebt(c)) acc.debt += c.balance;
        return acc;
      },
      { due: 0, paid: 0, debt: 0 }
    );
  }, [charges]);

  return (
    <AppShell allowedRoles={["ADMIN", "STUDENT"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Оплаты"
          description="Начисления за циклы и взносы. Если внесено меньше, остаётся долг; можно доплачивать частями."
        />
        {isAdmin ? (
          <Button onClick={openCreate}>
            <Plus size={18} />
            Новое начисление
          </Button>
        ) : null}
      </div>

      {!loading ? (
        <section className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="admin-stat-card">
            <p className="text-xs uppercase text-white/45">Начислено</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatMoney(totals.due)}</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs uppercase text-white/45">Оплачено</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">{formatMoney(totals.paid)}</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs uppercase text-white/45">Долг</p>
            <p className="mt-1 text-lg font-semibold text-rose-300">{formatMoney(totals.debt)}</p>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-slate-500">Загрузка...</div>
      ) : charges.length === 0 ? (
        <div className="py-8 text-center text-slate-500">Начислений пока нет</div>
      ) : (
        <div className="admin-card overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/8 bg-white/[0.03] text-xs uppercase text-white/40">
              <tr>
                <th className="px-3 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Студент</th>
                <th className="px-4 py-3 font-medium">Предмет</th>
                <th className="px-4 py-3 font-medium">К оплате</th>
                <th className="px-4 py-3 font-medium">Внесено</th>
                <th className="px-4 py-3 font-medium">Долг</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Период</th>
                {isAdmin ? <th className="px-4 py-3 font-medium">Действия</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {charges.map((c) => {
                const activeDebt = isActiveDebt(c);
                const pending = c.status === "UNPAID" && !activeDebt;
                const st = chargeStatusTag(c.status, pending);
                const isOpen = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="admin-table-row border-b border-white/6">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : c.id)}
                          className="text-white/40 hover:text-white/75"
                          title="Взносы"
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-white/85">{c.student?.fullName ?? "-"}</td>
                      <td className="px-4 py-3 text-white/65">{c.enrollment?.subject?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-white/85">{formatMoney(c.dueAmount)}</td>
                      <td className="px-4 py-3 text-emerald-300">{formatMoney(c.paidAmount)}</td>
                      <td className={`px-4 py-3 ${activeDebt ? "font-medium text-rose-300" : "text-white/40"}`}>
                        {c.balance < 0
                          ? `аванс ${formatMoney(-c.balance)}`
                          : activeDebt
                            ? formatMoney(c.balance)
                            : c.balance > 0
                              ? `${formatMoney(c.balance)} (ожидает)`
                              : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Tag variant={st.variant}>{st.label}</Tag>
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {formatDateRu(c.periodFrom)} — {formatDateRu(c.periodTo)}
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditCharge(c)}
                              className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs text-white/75 hover:border-brand-amber/35 hover:text-brand-yellow"
                              title="Изменить сумму начисления"
                            >
                              <Pencil size={14} /> Сумма
                            </button>
                            {c.balance > 0 ? (
                              <button
                                onClick={() => openInstallment(c)}
                                className="flex items-center gap-1 rounded-lg border border-brand-amber/30 bg-brand-amber/10 px-2 py-1 text-xs text-brand-yellow hover:bg-brand-amber/15"
                              >
                                <Wallet size={14} /> Доплатить
                              </button>
                            ) : null}
                            <button
                              onClick={() => void handleDeleteCharge(c)}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                    {isOpen ? (
                      <tr className="bg-white/[0.02]">
                        <td></td>
                        <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-white/45">
                              Взносы ({c.payments.length}) · след. оплата:{" "}
                              {c.nextPaymentDue ? formatDateRu(c.nextPaymentDue) : formatDateRu(c.periodTo)}
                            </p>
                            {c.payments.length === 0 ? (
                              <p className="text-sm text-slate-400">Пока нет взносов</p>
                            ) : (
                              <ul className="space-y-1">
                                {c.payments.map((inst) => (
                                  <li
                                    key={inst.id}
                                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                                  >
                                    <span>
                                      {formatDateRu(inst.paidAt)} · {formatMoney(inst.amount)} ·{" "}
                                      {METHOD_LABEL[inst.method] ?? inst.method}
                                      {inst.comment ? ` · ${inst.comment}` : ""}
                                    </span>
                                    {isAdmin ? (
                                      <button
                                        onClick={() => void handleDeleteInstallment(inst.id)}
                                        className="text-rose-500 hover:text-rose-700"
                                        title="Удалить взнос"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Новое начисление" footer={null}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Студент *</label>
              <Select
                value={form.studentId}
                onChange={(e) => {
                  const studentId = e.target.value;
                  setForm((prev) => ({ ...prev, studentId, enrollmentId: "" }));
                  void loadEnrollments(studentId);
                }}
                required
              >
                <option value="">Выберите студента</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Запись (предмет / группа) *</label>
              <Select
                value={form.enrollmentId}
                onChange={(e) => {
                  const enrollment = enrollments.find((item) => item.id === e.target.value);
                  const period = enrollment?.paymentPeriod ?? form.paymentPeriod;
                  const lessons = enrollment?.totalLessons ?? form.lessonsInCycle;
                  const due = suggestDue(enrollment);
                  setForm((prev) => ({
                    ...prev,
                    enrollmentId: e.target.value,
                    paymentPeriod: period,
                    lessonsInCycle: lessons,
                    dueAmount: due,
                    firstAmount: due
                  }));
                }}
                required
              >
                <option value="">Выберите запись</option>
                {enrollments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Тип цикла оплаты *</label>
              <Select
                value={form.paymentPeriod}
                onChange={(e) => {
                  const period = e.target.value as "MONTHLY" | "PER_LESSON";
                  const due = suggestDue(selectedEnrollment ?? undefined);
                  setForm({ ...form, paymentPeriod: period, dueAmount: due, firstAmount: due });
                }}
              >
                <option value="PER_LESSON">По занятиям (N занятий по расписанию)</option>
                <option value="MONTHLY">Ежемесячно (+1 месяц от даты платежа)</option>
              </Select>
            </div>

            {selectedEnrollment ? (
              <div className="admin-info-box">
                <p>Расписание: {formatSchedule(resolveEnrollmentSchedule(selectedEnrollment))}</p>
                <p>
                  Тариф записи: {formatMoney(selectedEnrollment.price)}
                  {!isMonthly ? " / цикл" : " / месяц"}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Дата начала цикла *</label>
                <Input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                  required
                />
              </div>
              {!isMonthly ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Занятий в цикле *</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.lessonsInCycle}
                    onChange={(e) => {
                      const lessons = parseInt(e.target.value, 10) || 1;
                      setForm({ ...form, lessonsInCycle: lessons });
                    }}
                    required
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">К оплате за цикл (UZS) *</label>
                <Input
                  type="number"
                  value={form.dueAmount}
                  onChange={(e) => setForm({ ...form, dueAmount: parseInt(e.target.value, 10) || 0 })}
                  required
                />
                <p className="mt-1 text-xs text-slate-400">Можно скорректировать вручную (скидка и т.п.).</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Внести сейчас (UZS)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.firstAmount}
                  onChange={(e) => setForm({ ...form, firstAmount: parseInt(e.target.value, 10) || 0 })}
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, firstAmount: form.dueAmount })}
                    className="rounded-lg border border-white/12 bg-white/5 px-2 py-0.5 text-xs text-white/70 hover:border-brand-amber/35 hover:text-brand-yellow"
                  >
                    Вся сумма
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, firstAmount: 0 })}
                    className="rounded-lg border border-white/12 bg-white/5 px-2 py-0.5 text-xs text-white/70 hover:border-brand-amber/35 hover:text-brand-yellow"
                  >
                    Без оплаты
                  </button>
                </div>
              </div>
            </div>

            {form.dueAmount > 0 && form.firstAmount < form.dueAmount ? (
              <p className="text-sm text-amber-700">Останется долг: {formatMoney(form.dueAmount - form.firstAmount)}</p>
            ) : form.firstAmount > form.dueAmount ? (
              <p className="text-sm text-blue-700">
                Переплата (аванс): {formatMoney(form.firstAmount - form.dueAmount)}
              </p>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium">Способ оплаты</label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="CASH">Наличные</option>
                <option value="CARD">Карта</option>
                <option value="TRANSFER">Перевод</option>
              </Select>
            </div>

            {previewLoading ? (
              <div className="rounded-md border p-3 text-sm text-slate-500">Рассчитываем цикл...</div>
            ) : preview ? (
              <div className="admin-info-box border-emerald-500/25">
                <p className="font-medium text-emerald-300">Период цикла</p>
                <p>
                  {formatDateRu(preview.periodFrom)} — {formatDateRu(preview.periodTo)}
                </p>
                <p>Следующая оплата: {formatDateRu(preview.nextPaymentDue)}</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {isAdmin ? (
        <Modal isOpen={!!installmentCharge} onClose={() => setInstallmentCharge(null)} title="Доплатить" footer={null}>
          {installmentCharge ? (
            <form onSubmit={submitInstallment} className="space-y-4">
              <div className="admin-info-box">
                <p className="title">
                  {installmentCharge.student.fullName} · {installmentCharge.enrollment?.subject?.name ?? "—"}
                </p>
                <p>
                  К оплате: {formatMoney(installmentCharge.dueAmount)} · внесено:{" "}
                  {formatMoney(installmentCharge.paidAmount)} · долг:{" "}
                  {formatMoney(Math.max(0, installmentCharge.balance))}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Сумма взноса (UZS) *</label>
                  <Input
                    type="number"
                    min={1}
                    value={installmentForm.amount}
                    onChange={(e) =>
                      setInstallmentForm({ ...installmentForm, amount: parseInt(e.target.value, 10) || 0 })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Дата *</label>
                  <Input
                    type="date"
                    value={installmentForm.paidAt}
                    onChange={(e) => setInstallmentForm({ ...installmentForm, paidAt: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Способ оплаты</label>
                <Select
                  value={installmentForm.method}
                  onChange={(e) => setInstallmentForm({ ...installmentForm, method: e.target.value })}
                >
                  <option value="CASH">Наличные</option>
                  <option value="CARD">Карта</option>
                  <option value="TRANSFER">Перевод</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Комментарий</label>
                <Input
                  value={installmentForm.comment}
                  onChange={(e) => setInstallmentForm({ ...installmentForm, comment: e.target.value })}
                  placeholder="необязательно"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setInstallmentCharge(null)}>
                  Отмена
                </Button>
                <Button type="submit">Сохранить взнос</Button>
              </div>
            </form>
          ) : null}
        </Modal>
      ) : null}

      {isAdmin ? (
        <Modal
          isOpen={!!editCharge}
          onClose={() => setEditCharge(null)}
          title="Изменить сумму начисления"
          footer={null}
        >
          {editCharge ? (
            <form onSubmit={submitEditCharge} className="space-y-4">
              <div className="admin-info-box">
                <p className="title">
                  {editCharge.student.fullName} · {editCharge.enrollment?.subject?.name ?? "—"}
                </p>
                <p>
                  Период: {formatDateRu(editCharge.periodFrom)} — {formatDateRu(editCharge.periodTo)}
                </p>
                <p>Внесено: {formatMoney(editCharge.paidAmount)}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">К оплате за цикл (UZS) *</label>
                <Input
                  type="number"
                  min={1}
                  value={editDueAmount}
                  onChange={(e) => setEditDueAmount(parseInt(e.target.value, 10) || 0)}
                  required
                />
                {editDueAmount > editCharge.paidAmount ? (
                  <p className="mt-1 text-sm text-amber-700">
                    Долг станет: {formatMoney(editDueAmount - editCharge.paidAmount)}
                  </p>
                ) : editDueAmount <= editCharge.paidAmount ? (
                  <p className="mt-1 text-sm text-emerald-700">
                    {editDueAmount < editCharge.paidAmount
                      ? `Аванс: ${formatMoney(editCharge.paidAmount - editDueAmount)}`
                      : "Начисление будет закрыто"}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setEditCharge(null)} disabled={savingEdit}>
                  Отмена
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </form>
          ) : null}
        </Modal>
      ) : null}
    </AppShell>
  );
}
