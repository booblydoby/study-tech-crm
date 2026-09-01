"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { formatDateRu, getStartOfMonthInAppTz } from "@/lib/payment-cycle";

export interface TeacherFinanceData {
  periodFrom: string;
  periodTo: string;
  accruedInPeriod: number;
  accruedAllTime: number;
  paidOutAllTime: number;
  unpaidBalance: number;
  expectedThisMonth: number;
  byStudent: Array<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    subjectName: string;
    type: string;
    groupName: string | null;
    commission: number;
    accruedInPeriod: number;
    accruedAllTime: number;
    expectedThisMonth: number;
    studentDebt: number;
    teacherDebtShare: number;
    nextPaymentDue: string | null;
    onBreak: boolean;
  }>;
  upcomingPayments: Array<{
    studentName: string;
    subjectName: string;
    dueDate: string;
    amount: number;
    teacherShare: number;
  }>;
  debtors: Array<{
    studentName: string;
    subjectName: string;
    debt: number;
    teacherShare: number;
    dueDate: string;
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    paidAt: string;
    comment: string | null;
  }>;
}

interface TeacherEarningsProps {
  teacherId: string;
}

function money(n: number) {
  return n.toLocaleString("ru-RU") + " сум";
}

export function TeacherEarnings({ teacherId }: TeacherEarningsProps) {
  const [data, setData] = useState<TeacherFinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "all">("month");

  useEffect(() => {
    void load();
  }, [teacherId, period]);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const params = new URLSearchParams();
      if (period === "month") {
        params.set("from", getStartOfMonthInAppTz().toISOString());
      }
      params.set("to", now.toISOString());
      const result = await apiGet<TeacherFinanceData>(
        `/enrollments/teacher/${teacherId}/earnings?${params.toString()}`
      );
      setData(result);
    } catch (error) {
      console.error("Failed to load teacher finance:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-slate-500">Загрузка...</div>;
  }

  if (!data) {
    return <div className="py-8 text-center text-slate-500">Не удалось загрузить данные о доходе</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Мой доход</h2>
          <p className="mt-1 text-sm text-slate-500">
            Доля от оплат учеников ({period === "month" ? "текущий месяц" : "всё время"})
          </p>
        </div>
        <div className="flex gap-2">
          {(["month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-border hover:bg-accent"
              }`}
            >
              {p === "month" ? "Этот месяц" : "Всё время"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Ваша доля начисляется сразу при каждой оплате ученика — процент указан в записи (например, 50% от суммы платежа).
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Поступило (начислено)</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">
            {money(period === "month" ? data.accruedInPeriod : data.accruedAllTime)}
          </p>
          <p className="mt-1 text-xs text-slate-500">ваша доля от оплат</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ожидается в месяце</p>
          <p className="mt-1 text-xl font-bold">{money(data.expectedThisMonth)}</p>
          <p className="mt-1 text-xs text-slate-500">если ученики оплатят в срок</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Не выплачено вам</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{money(data.unpaidBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">начислено − выплачено ({money(data.paidOutAllTime)})</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Должники</p>
          <p className="mt-1 text-xl font-bold text-rose-700">{data.debtors.length}</p>
          <p className="mt-1 text-xs text-slate-500">учеников с задолженностью</p>
        </Card>
      </div>

      {data.upcomingPayments.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium">Ближайшие оплаты (14 дней)</h3>
          <div className="space-y-2">
            {data.upcomingPayments.map((item) => (
              <Card key={`${item.studentName}-${item.dueDate}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{item.studentName}</p>
                  <p className="text-sm text-slate-500">
                    {item.subjectName} · {formatDateRu(item.dueDate)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-600">Оплата ~{money(item.amount)}</p>
                  <p className="font-medium text-emerald-700">Ваша доля ~{money(item.teacherShare)}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {data.debtors.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium text-rose-700">Должники</h3>
          <div className="space-y-2">
            {data.debtors.map((item) => (
              <Card key={`${item.studentName}-debt`} className="flex flex-wrap items-center justify-between gap-2 border-rose-100 p-3">
                <div>
                  <p className="font-medium">{item.studentName}</p>
                  <p className="text-sm text-slate-500">{item.subjectName}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-rose-600">Долг {money(item.debt)}</p>
                  <p className="text-slate-500">Срок: {formatDateRu(item.dueDate)}</p>
                  <p className="font-medium">Ваша доля: {money(item.teacherShare)}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 font-medium">По ученикам</h3>
        <div className="space-y-2">
          {data.byStudent.length === 0 ? (
            <Card className="p-4 text-center text-slate-500">Нет данных по ученикам</Card>
          ) : (
            data.byStudent.map((row) => (
              <Card key={row.enrollmentId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.studentName}</p>
                      {row.onBreak && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Перерыв</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {row.subjectName} · {row.type === "GROUP" ? `Группа: ${row.groupName ?? "—"}` : "Индивидуально"} ·{" "}
                      {row.commission}%
                    </p>
                    {row.nextPaymentDue && (
                      <p className="mt-1 text-xs text-slate-400">
                        След. оплата: {formatDateRu(row.nextPaymentDue)}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1 text-right text-sm sm:min-w-[180px]">
                    <p>
                      <span className="text-slate-500">Начислено: </span>
                      <span className="font-medium text-emerald-700">
                        {money(period === "month" ? row.accruedInPeriod : row.accruedAllTime)}
                      </span>
                    </p>
                    {row.expectedThisMonth > 0 && (
                      <p>
                        <span className="text-slate-500">Ожидается: </span>
                        <span className="font-medium">{money(row.expectedThisMonth)}</span>
                      </p>
                    )}
                    {row.studentDebt > 0 && (
                      <p>
                        <span className="text-slate-500">Долг ученика: </span>
                        <span className="font-medium text-rose-600">{money(row.studentDebt)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {data.recentPayouts.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium">Выплаты от центра</h3>
          <div className="space-y-2">
            {data.recentPayouts.map((p) => (
              <Card key={p.id} className="flex justify-between p-3 text-sm">
                <span>{formatDateRu(p.paidAt)}</span>
                <span className="font-medium">{money(p.amount)}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
