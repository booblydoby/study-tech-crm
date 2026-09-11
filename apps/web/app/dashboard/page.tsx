"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  TrendingUp,
  UserRoundCheck,
  Users
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { attendanceStatusLabelRu } from "@/lib/payment-cycle";

interface DashboardData {
  students: number;
  activeGroups: number;
  teachers: number;
  revenue: number;
  expectedRevenue: number;
  debts: number;
  moneyDebtTotal: number;
  moneyDebtorsCount: number;
  attendance: Record<string, number>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setError(null);
    try {
      const result = await apiGet<DashboardData>("/analytics/dashboard");
      setData(result);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError("Не удалось загрузить данные панели");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M UZS";
    if (amount >= 1000) return (amount / 1000).toFixed(0) + "K UZS";
    return amount + " UZS";
  };

  const stats = [
    { label: "Активные студенты", value: data?.students ?? "-", icon: Users },
    { label: "Активные группы", value: data?.activeGroups ?? "-", icon: UserRoundCheck },
    { label: "Преподаватели", value: data?.teachers ?? "-", icon: Users },
    { label: "Выручка", value: data ? formatMoney(data.revenue) : "-", icon: CreditCard },
    { label: "Ожидаемая выручка", value: data ? formatMoney(data.expectedRevenue) : "-", icon: TrendingUp }
  ];

  const quickLinks = [
    { href: "/students", label: "Студенты", icon: Users },
    { href: "/schedule", label: "Расписание", icon: CalendarDays },
    { href: "/payments", label: "Оплаты", icon: CreditCard },
    { href: "/analytics", label: "Аналитика", icon: BarChart3 }
  ];

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <PageHeader
        title="Панель управления"
        description="Обзор работы учебного центра — студенты, финансы и посещаемость."
      />

      {loading ? (
        <div className="py-16 text-center text-white/45">Загрузка...</div>
      ) : error ? (
        <div className="admin-badge-danger px-4 py-3 text-sm">{error}</div>
      ) : (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label} className="admin-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/45">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className="admin-stat-icon shrink-0">
                    <stat.icon size={20} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Быстрые действия</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="admin-card group flex items-center justify-between !py-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="admin-stat-icon !size-9 !w-9">
                      <link.icon size={16} />
                    </div>
                    <span className="font-medium text-white/90">{link.label}</span>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-yellow"
                  />
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <h2 className="mb-4 text-base font-semibold text-white">Посещаемость</h2>
              {data?.attendance && Object.keys(data.attendance).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.attendance).map(([status, count]) => (
                    <div key={status} className="admin-surface flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-white/75">{attendanceStatusLabelRu(status)}</span>
                      <span className="font-semibold text-brand-yellow">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-sm text-white/45">Данных пока нет</div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-base font-semibold text-white">Финансы</h2>
              <div className="space-y-3 text-sm">
                <div className="admin-surface flex items-start gap-3 px-4 py-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-400" />
                  <div>
                    <p className="font-medium text-rose-200">
                      Денежный долг: {data ? formatMoney(data.moneyDebtTotal) : "-"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {data?.moneyDebtorsCount ?? 0} должников по начислениям
                    </p>
                  </div>
                </div>
                <div className="admin-surface px-4 py-3 text-amber-200">
                  Просрочено по дате: {data?.debts ?? 0} записей
                </div>
                <div className="admin-surface px-4 py-3 text-emerald-200">
                  Ожидается: {data ? formatMoney(data.expectedRevenue) : "-"}
                </div>
                <Button variant="outline" asChild className="mt-2 w-full">
                  <Link href="/analytics">Подробная аналитика</Link>
                </Button>
              </div>
            </Card>
          </section>
        </>
      )}
    </AppShell>
  );
}
