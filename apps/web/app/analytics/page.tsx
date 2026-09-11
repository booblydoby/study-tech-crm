"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import {
  attendanceStatusLabelRu,
  dateOnlyToIsoStartInAppTz,
  formatDateRu,
  getStartOfMonthInAppTz,
  todayDateInputInAppTz
} from "@/lib/payment-cycle";
import { Plus, Trash2, TrendingDown, Wallet } from "lucide-react";

interface AnalyticsData {
  students: number;
  activeGroups: number;
  teachers: number;
  revenue: number;
  debts: number;
  moneyDebtTotal?: number;
  moneyDebtorsCount?: number;
  attendance: Record<string, number>;
}

interface MoneyDebtor {
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
  charges: number;
}

interface MoneyDebtData {
  totalDebt: number;
  debtors: MoneyDebtor[];
}

interface RevenueData {
  total: number;
}

interface DebtsData {
  count: number;
}

interface AttendanceData {
  PRESENT?: number;
  ABSENT?: number;
  LATE?: number;
  EXCUSED?: number;
}

interface PaymentDueItem {
  enrollmentId: string;
  studentName: string;
  studentPhone: string | null;
  subjectName: string;
  teacherName: string;
  groupName: string | null;
  enrollmentStatus: string;
  paymentPeriod: string;
  amount: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  hasPayment: boolean;
}

interface PaymentDueData {
  daysAhead: number;
  overdueCount: number;
  upcomingCount: number;
  overdue: PaymentDueItem[];
  upcoming: PaymentDueItem[];
}

type ExpenseCategory = "RENT" | "SALARY" | "UTILITIES" | "SUPPLIES" | "MARKETING" | "EQUIPMENT" | "TAX" | "OTHER";

interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  spentAt: string;
  comment: string | null;
}

interface ProfitSummary {
  revenue: number;
  expensesTotal: number;
  teacherPayouts: number;
  netProfit: number;
  expensesByCategory: Record<ExpenseCategory, number>;
}

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Аренда",
  SALARY: "Зарплаты",
  UTILITIES: "Коммунальные",
  SUPPLIES: "Материалы",
  MARKETING: "Реклама",
  EQUIPMENT: "Оборудование",
  TAX: "Налоги",
  OTHER: "Прочее"
};

const emptyExpenseForm = () => ({
  title: "",
  category: "OTHER" as ExpenseCategory,
  amount: "",
  spentAt: todayDateInputInAppTz(),
  comment: ""
});

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [paymentDue, setPaymentDue] = useState<PaymentDueData | null>(null);
  const [moneyDebt, setMoneyDebt] = useState<MoneyDebtData | null>(null);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profitPeriod, setProfitPeriod] = useState<"all" | "month">("all");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [savingExpense, setSavingExpense] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const pq = profitPeriod === "month" ? `?from=${encodeURIComponent(getStartOfMonthInAppTz().toISOString())}` : "";
      const [dashboard, revenue, debts, attendance, duePayments, money, profitData, expensesData] = await Promise.all([
        apiGet<AnalyticsData>("/analytics/dashboard"),
        apiGet<RevenueData>("/analytics/revenue"),
        apiGet<DebtsData>("/analytics/debts"),
        apiGet<AttendanceData>("/analytics/attendance"),
        apiGet<PaymentDueData>("/analytics/payment-due?daysAhead=14"),
        apiGet<MoneyDebtData>("/analytics/money-debt"),
        apiGet<ProfitSummary>(`/analytics/profit${pq}`),
        apiGet<Expense[]>(`/expenses${pq}`)
      ]);
      setData({
        ...dashboard,
        revenue: revenue.total,
        debts: debts.count,
        attendance: attendance as Record<string, number>
      });
      setPaymentDue(duePayments);
      setMoneyDebt(money);
      setProfit(profitData);
      setExpenses(expensesData);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [profitPeriod]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const handleReconcile = async () => {
    if (!confirm("Пересобрать данные? Зависшие записи (после удаления/перевода из групп) будут отменены.")) return;
    setReconciling(true);
    try {
      const result = await apiPost<{ cancelledEnrollments: number }>("/analytics/reconcile", {});
      await loadAnalytics();
      alert(`Готово. Исправлено записей: ${result.cancelledEnrollments}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Попробуйте ещё раз.";
      alert(`Не удалось пересобрать данные. ${message}`);
    } finally {
      setReconciling(false);
    }
  };

  const openExpenseModal = () => {
    setExpenseForm(emptyExpenseForm());
    setExpenseModalOpen(true);
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.title.trim()) {
      alert("Укажите название расхода");
      return;
    }
    if (!amount || amount < 1) {
      alert("Укажите сумму");
      return;
    }
    setSavingExpense(true);
    try {
      await apiPost("/expenses", {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount,
        spentAt: dateOnlyToIsoStartInAppTz(expenseForm.spentAt),
        comment: expenseForm.comment.trim() || undefined
      });
      setExpenseModalOpen(false);
      await loadAnalytics();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось сохранить расход";
      alert(message);
    } finally {
      setSavingExpense(false);
    }
  };

  const deleteExpense = async (id: string, title: string) => {
    if (!confirm(`Удалить расход «${title}»?`)) return;
    try {
      await apiDelete(`/expenses/${id}`);
      await loadAnalytics();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить";
      alert(message);
    }
  };

  const formatMoney = (amount: number) => (amount / 1000000).toFixed(1) + "M UZS";
  const formatSum = (amount: number) => amount.toLocaleString("ru-RU") + " сум";
  const formatPrice = (amount: number) => (amount / 1000).toFixed(0) + "K UZS";

  const formatDueLabel = (item: PaymentDueItem) => {
    if (!item.dueDate) return "Нет оплат";
    return formatDateRu(item.dueDate);
  };

  const formatDueHint = (item: PaymentDueItem) => {
    if (!item.dueDate) return "—";
    if (item.daysOverdue && item.daysOverdue > 0) {
      return `просрочено ${item.daysOverdue} дн.`;
    }
    if (item.daysUntilDue === 0) return "сегодня";
    if (item.daysUntilDue != null) return `через ${item.daysUntilDue} дн.`;
    return "—";
  };

  const totalAttendance = data?.attendance ? Object.values(data.attendance).reduce((sum, v) => sum + v, 0) : 0;

  const presentPct =
    totalAttendance > 0 && data?.attendance?.PRESENT
      ? Math.round((data.attendance.PRESENT / totalAttendance) * 100)
      : 0;

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Аналитика" description="Выручка, расходы, чистая прибыль, долги и посещаемость." />
        <Button variant="outline" onClick={handleReconcile} disabled={reconciling}>
          {reconciling ? "Пересборка..." : "Пересобрать данные"}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Загрузка...</div>
      ) : (
        <>
          <section className="admin-stagger grid gap-4 md:grid-cols-4">
            <div className="admin-stat-card">
              <p className="text-xs font-medium uppercase tracking-wide text-white/45">Выручка</p>
              <p className="mt-2 text-2xl font-bold text-white">{data ? formatMoney(data.revenue) : "—"}</p>
            </div>
            <div className="admin-stat-card">
              <p className="text-xs font-medium uppercase tracking-wide text-white/45">Денежный долг</p>
              <p className="mt-2 text-2xl font-bold text-rose-300">
                {moneyDebt ? formatMoney(moneyDebt.totalDebt) : "—"}
              </p>
              <p className="mt-1 text-xs text-white/40">{moneyDebt?.debtors.length ?? 0} должников</p>
            </div>
            <div className="admin-stat-card">
              <p className="text-xs font-medium uppercase tracking-wide text-white/45">Долги по дате</p>
              <p className="mt-2 text-2xl font-bold text-white">{data?.debts ?? 0}</p>
            </div>
            <div className="admin-stat-card">
              <p className="text-xs font-medium uppercase tracking-wide text-white/45">Посещаемость</p>
              <p className="mt-2 text-2xl font-bold text-brand-yellow">{presentPct}%</p>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Расходы и чистая прибыль</h2>
                <p className="text-sm text-slate-500">
                  Выручка − расходы − выплаты преподавателям = остаток (чистая прибыль).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="admin-period-toggle">
                  <button
                    type="button"
                    onClick={() => setProfitPeriod("all")}
                    className={`admin-period-btn ${profitPeriod === "all" ? "admin-period-btn-active" : ""}`}
                  >
                    Всё время
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfitPeriod("month")}
                    className={`admin-period-btn ${profitPeriod === "month" ? "admin-period-btn-active" : ""}`}
                  >
                    Этот месяц
                  </button>
                </div>
                <Button onClick={openExpenseModal}>
                  <Plus size={16} className="mr-1" />
                  Добавить расход
                </Button>
              </div>
            </div>

            {profit ? (
              <div className="admin-stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="admin-stat-card">
                  <p className="text-xs uppercase tracking-wide text-white/45">Поступления</p>
                  <p className="mt-2 text-xl font-bold text-emerald-300">{formatSum(profit.revenue)}</p>
                </div>
                <div className="admin-stat-card">
                  <p className="text-xs uppercase tracking-wide text-white/45">Расходы</p>
                  <p className="mt-2 text-xl font-bold text-amber-300">{formatSum(profit.expensesTotal)}</p>
                </div>
                <div className="admin-stat-card">
                  <p className="text-xs uppercase tracking-wide text-white/45">Выплаты учителям</p>
                  <p className="mt-2 text-xl font-bold text-white/80">{formatSum(profit.teacherPayouts)}</p>
                </div>
                <div className="admin-stat-card">
                  <p className="text-xs uppercase tracking-wide text-white/45 flex items-center gap-1">
                    <Wallet size={14} /> Чистая прибыль
                  </p>
                  <p
                    className={`mt-2 text-xl font-bold ${profit.netProfit >= 0 ? "text-brand-yellow" : "text-rose-300"}`}
                  >
                    {formatSum(profit.netProfit)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <Card>
                <h3 className="mb-3 text-sm font-semibold">Журнал расходов</h3>
                {expenses.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Дата</th>
                          <th className="pb-2 pr-3 font-medium">Название</th>
                          <th className="pb-2 pr-3 font-medium">Категория</th>
                          <th className="pb-2 pr-3 font-medium">Сумма</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {expenses.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-3 text-slate-600">{formatDateRu(item.spentAt)}</td>
                            <td className="py-2 pr-3">
                              <div className="font-medium">{item.title}</div>
                              {item.comment ? <div className="text-xs text-slate-400">{item.comment}</div> : null}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">{EXPENSE_CATEGORY_LABELS[item.category]}</td>
                            <td className="py-2 pr-3 font-medium text-amber-800">{formatSum(item.amount)}</td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => void deleteExpense(item.id, item.title)}
                                className="rounded p-1 text-rose-500 hover:bg-rose-50"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    <TrendingDown size={28} className="mx-auto mb-2 text-slate-300" />
                    Расходов пока нет. Нажмите «Добавить расход».
                  </div>
                )}
              </Card>

              {profit ? (
                <Card>
                  <h3 className="mb-3 text-sm font-semibold">По категориям</h3>
                  <ul className="space-y-2 text-sm">
                    {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((key) => {
                      const sum = profit.expensesByCategory[key] ?? 0;
                      if (sum <= 0) return null;
                      return (
                        <li key={key} className="flex justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-slate-600">{EXPENSE_CATEGORY_LABELS[key]}</span>
                          <span className="font-medium">{formatSum(sum)}</span>
                        </li>
                      );
                    })}
                    {profit.expensesTotal <= 0 ? <li className="text-slate-500 py-2">Нет расходов за период</li> : null}
                  </ul>
                </Card>
              ) : null}
            </div>
          </section>

          {moneyDebt && moneyDebt.debtors.length > 0 ? (
            <section className="mt-6">
              <h2 className="mb-3 text-base font-semibold text-rose-300">Должники по сумме</h2>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">Ученик</th>
                        <th className="pb-2 pr-3 font-medium">Начислено</th>
                        <th className="pb-2 pr-3 font-medium">Оплачено</th>
                        <th className="pb-2 pr-3 font-medium">Долг</th>
                        <th className="pb-2 font-medium">Начислений</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {moneyDebt.debtors.map((d) => (
                        <tr key={d.studentId} className="align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{d.studentName}</div>
                            {d.studentPhone ? <div className="text-xs text-slate-400">{d.studentPhone}</div> : null}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{formatMoney(d.totalDue)}</td>
                          <td className="py-2 pr-3 text-emerald-700">{formatMoney(d.totalPaid)}</td>
                          <td className="py-2 pr-3 font-semibold text-rose-300">{formatMoney(d.balance)}</td>
                          <td className="py-2 text-slate-600">{d.charges}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ) : null}
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-base font-semibold">Посещаемость</h2>
              {data?.attendance && totalAttendance > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(data.attendance).map(([status, count]) => (
                    <div key={status} className="rounded-md bg-slate-50 px-4 py-3 text-sm flex justify-between">
                      <span>{attendanceStatusLabelRu(status)}</span>
                      <span className="font-medium">
                        {count} ({Math.round((count / totalAttendance) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-sm py-4">Данных пока нет</div>
              )}
            </Card>
            <Card>
              <h2 className="mb-4 text-base font-semibold">Overview</h2>
              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-slate-50 px-4 py-3 flex justify-between">
                  <span>Active students</span>
                  <span className="font-medium">{data?.students ?? 0}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-4 py-3 flex justify-between">
                  <span>Active groups</span>
                  <span className="font-medium">{data?.activeGroups ?? 0}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-4 py-3 flex justify-between">
                  <span>Teachers</span>
                  <span className="font-medium">{data?.teachers ?? 0}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-4 py-3 flex justify-between">
                  <span>Total revenue</span>
                  <span className="font-medium">{data ? formatMoney(data.revenue) : "-"}</span>
                </div>
              </div>
            </Card>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Оплаты</h2>
                <p className="text-sm text-slate-500">
                  Просроченные и предстоящие даты оплаты по активным записям (ближайшие {paymentDue?.daysAhead ?? 14}{" "}
                  дней).
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="admin-tag admin-tag-danger">Просрочено: {paymentDue?.overdueCount ?? 0}</span>
                <span className="admin-tag admin-tag-warning">Скоро: {paymentDue?.upcomingCount ?? 0}</span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-rose-300">Просроченная оплата</h3>
                {paymentDue && paymentDue.overdue.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Ученик</th>
                          <th className="pb-2 pr-3 font-medium">Предмет</th>
                          <th className="pb-2 pr-3 font-medium">Дата</th>
                          <th className="pb-2 font-medium">Сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paymentDue.overdue.map((item) => (
                          <tr key={item.enrollmentId} className="align-top">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{item.studentName}</div>
                              {item.groupName && <div className="text-xs text-slate-500">{item.groupName}</div>}
                              {item.enrollmentStatus === "PAUSED" && (
                                <div className="text-xs text-blue-600">заморожен</div>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {item.subjectName}
                              <div className="text-xs text-slate-400">{item.teacherName}</div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className={item.dueDate ? "text-red-700" : "text-slate-500"}>
                                {formatDueLabel(item)}
                              </div>
                              <div className="text-xs text-slate-500">{formatDueHint(item)}</div>
                            </td>
                            <td className="py-2">{formatPrice(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-sm text-slate-500">Нет просроченных оплат</div>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-sm font-semibold text-brand-yellow">Скоро наступит оплата</h3>
                {paymentDue && paymentDue.upcoming.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Ученик</th>
                          <th className="pb-2 pr-3 font-medium">Предмет</th>
                          <th className="pb-2 pr-3 font-medium">Дата</th>
                          <th className="pb-2 font-medium">Сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paymentDue.upcoming.map((item) => (
                          <tr key={item.enrollmentId} className="align-top">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{item.studentName}</div>
                              {item.groupName && <div className="text-xs text-slate-500">{item.groupName}</div>}
                              {item.enrollmentStatus === "PAUSED" && (
                                <div className="text-xs text-blue-600">заморожен</div>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {item.subjectName}
                              <div className="text-xs text-slate-400">{item.teacherName}</div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="text-amber-800">{formatDueLabel(item)}</div>
                              <div className="text-xs text-slate-500">{formatDueHint(item)}</div>
                            </td>
                            <td className="py-2">{formatPrice(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-sm text-slate-500">Нет предстоящих оплат в ближайшие 2 недели</div>
                )}
              </Card>
            </div>
          </section>
        </>
      )}

      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Новый расход"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setExpenseModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="expense-form" disabled={savingExpense}>
              {savingExpense ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={(e) => void submitExpense(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Название *</label>
            <Input
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              placeholder="Напр. Аренда офиса"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Категория</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {EXPENSE_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Дата *</label>
              <Input
                type="date"
                value={expenseForm.spentAt}
                onChange={(e) => setExpenseForm({ ...expenseForm, spentAt: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Сумма (сум) *</label>
            <Input
              type="number"
              min={1}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              placeholder="500000"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Комментарий</label>
            <Input
              value={expenseForm.comment}
              onChange={(e) => setExpenseForm({ ...expenseForm, comment: e.target.value })}
              placeholder="Необязательно"
            />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
