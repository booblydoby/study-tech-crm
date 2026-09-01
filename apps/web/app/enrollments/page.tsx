"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { RefreshCw } from "lucide-react";

interface Enrollment {
  id: string;
  student: { fullName: string };
  subject: { name: string };
  teacher: { fullName: string };
  group?: { name: string } | null;
  type: string;
  price: number;
  paymentPeriod: string;
  status: string;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Активна",
  PAUSED: "Заморожена",
  FINISHED: "Завершена",
  CANCELLED: "Отменена"
};

const paymentLabels: Record<string, string> = {
  MONTHLY: "Месяц",
  PER_LESSON: "За занятия"
};

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadEnrollments();
  }, []);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      setEnrollments(await apiGet<Enrollment[]>("/enrollments"));
    } catch (error) {
      console.error("Failed to load enrollments:", error);
      alert("Не удалось загрузить записи");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell allowedRoles={["ADMIN", "STUDENT"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Записи" description="Кто у кого и по какому предмету учится." />
        <Button variant="outline" onClick={() => void loadEnrollments()} disabled={loading}>
          <RefreshCw size={16} className="mr-1" />
          Обновить
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Загрузка...</div>
      ) : (
        <DataTable
          columns={["Студент", "Предмет", "Формат", "Преподаватель", "Цена", "Оплата", "Статус"]}
          rows={enrollments.map((e) => [
            e.student?.fullName || "—",
            e.subject?.name || "—",
            e.type === "GROUP" ? `Группа: ${e.group?.name || "—"}` : "Индивидуально",
            e.teacher?.fullName || "—",
            (e.price / 1000).toFixed(0) + "K сум",
            paymentLabels[e.paymentPeriod] ?? e.paymentPeriod,
            statusLabels[e.status] ?? e.status,
          ])}
        />
      )}
    </AppShell>
  );
}
