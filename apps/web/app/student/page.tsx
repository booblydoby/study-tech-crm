"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Calendar, Phone, MessageCircle, BookOpen, Clock, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDateWithWeekdayRu, formatTimeRu } from "@/lib/payment-cycle";

interface Enrollment {
  id: string;
  subject: { name: string };
  teacher: { fullName: string };
  type: string;
  price: number;
  teacherCommission: number;
  totalLessons: number;
  completedLessons: number;
  lessonDebt: number;
  status: string;
  frozenAt?: string;
  frozenUntil?: string;
}

interface Lesson {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  subject: { name: string };
  teacher: { fullName: string };
}

interface Attendance {
  id: string;
  status: string;
  comment?: string;
  lesson: {
    startsAt: string;
    subject: { name: string };
  };
}

interface StudentData {
  id: string;
  fullName: string;
  phone?: string;
  telegram?: string;
  parentPhone?: string;
  enrollments: Enrollment[];
  attendance: Attendance[];
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    enrollment: { subject: { name: string } };
  }>;
}

type TabType = "schedule" | "attendance" | "info";

export default function StudentPage() {
  const [data, setData] = useState<StudentData | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("schedule");

  useEffect(() => {
    void loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      const now = new Date();
      const monthAhead = new Date();
      monthAhead.setDate(monthAhead.getDate() + 30);
      const [studentData, lessonsData] = await Promise.all([
        apiGet<StudentData>("/students/me"),
        apiGet<Lesson[]>(`/lessons?from=${now.toISOString()}&to=${monthAhead.toISOString()}`)
      ]);
      setData(studentData);
      setLessons(lessonsData);
    } catch (error) {
      console.error("Failed to load student data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
      time: date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "bg-green-100 text-green-700";
      case "ABSENT":
        return "bg-red-100 text-red-700";
      case "LATE":
        return "bg-yellow-100 text-yellow-700";
      case "EXCUSED":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getAttendanceStatusText = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "Присутствовал";
      case "ABSENT":
        return "Отсутствовал";
      case "LATE":
        return "Опоздал";
      case "EXCUSED":
        return "Уважительная";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <AppShell allowedRoles={["STUDENT"]}>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Загрузка...</div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell allowedRoles={["STUDENT"]}>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Профиль студента не найден</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell allowedRoles={["STUDENT"]}>
      <PageHeader 
        title={data.fullName} 
        description="Личный кабинет студента" 
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-4 py-2 rounded-md ${
            activeTab === "schedule"
              ? "bg-blue-500 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Расписание
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2 rounded-md ${
            activeTab === "attendance"
              ? "bg-blue-500 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Посещаемость
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2 rounded-md ${
            activeTab === "info"
              ? "bg-blue-500 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Информация
        </button>
      </div>

      {activeTab === "schedule" && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Ближайшие занятия</h2>
            {lessons.length === 0 ? (
              <Card className="p-6 text-center text-slate-500">
                Нет запланированных занятий на ближайший месяц. Администратор должен сгенерировать расписание из групп.
              </Card>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson) => (
                  <Card key={lesson.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{lesson.subject.name}</div>
                      <div className="text-sm text-slate-500">{lesson.teacher.fullName}</div>
                      <div className="text-sm text-slate-500">{formatDateWithWeekdayRu(lesson.startsAt)}</div>
                    </div>
                    <div className="text-right font-semibold">{formatTimeRu(lesson.startsAt)}</div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Мои предметы</h2>
            {data.enrollments.length === 0 ? (
              <Card className="p-6 text-center text-slate-500">У вас пока нет зачислений</Card>
            ) : (
              <div className="space-y-3">
                {data.enrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-lg">{enrollment.subject.name}</div>
                        <div className="text-sm text-slate-500">Преподаватель: {enrollment.teacher.fullName}</div>
                        <div className="text-sm text-slate-500">
                          Формат: {enrollment.type === "GROUP" ? "Групповой" : "Индивидуальный"}
                        </div>
                        {enrollment.frozenAt && enrollment.frozenUntil ? (
                          <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                            <AlertCircle size={16} />
                            Заморожено до {new Date(enrollment.frozenUntil).toLocaleDateString("ru-RU")}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Прогресс</div>
                        <div className="font-medium">
                          {enrollment.completedLessons} / {enrollment.totalLessons} занятий
                        </div>
                        {enrollment.lessonDebt > 0 ? (
                          <div className="mt-1 text-sm text-red-500">Долг: {enrollment.lessonDebt} зан.</div>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">История посещаемости</h2>
          
          {data.attendance.length === 0 ? (
            <Card className="p-6 text-center text-slate-500">
              Записей о посещаемости пока нет
            </Card>
          ) : (
            <div className="space-y-2">
              {data.attendance.map(record => {
                const { date, time } = formatDateTime(record.lesson.startsAt);
                return (
                  <Card key={record.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{record.lesson.subject.name}</div>
                        <div className="text-sm text-slate-500">
                          {date} в {time}
                        </div>
                        {record.comment && (
                          <div className="text-sm text-slate-500 mt-1">
                            Комментарий: {record.comment}
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(record.status)}`}>
                        {getAttendanceStatusText(record.status)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "info" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Контактная информация</h2>
          
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-full">
                <Phone size={20} className="text-slate-600" />
              </div>
              <div>
                <div className="text-sm text-slate-500">Телефон</div>
                <div className="font-medium">{data.phone || "Не указан"}</div>
              </div>
            </div>

            {data.telegram && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <MessageCircle size={20} className="text-slate-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Telegram</div>
                  <div className="font-medium">{data.telegram}</div>
                </div>
              </div>
            )}

            {data.parentPhone && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <Phone size={20} className="text-slate-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Телефон родителя</div>
                  <div className="font-medium">{data.parentPhone}</div>
                </div>
              </div>
            )}
          </Card>

          <h2 className="text-lg font-semibold">Мои зачисления</h2>
          <div className="space-y-3">
            {data.enrollments.map(enrollment => (
              <Card key={enrollment.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{enrollment.subject.name}</div>
                    <div className="text-sm text-slate-500">
                      {enrollment.type === "GROUP" ? "Группа" : "Индивидуально"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{enrollment.price.toLocaleString()} сум</div>
                    <div className="text-sm text-slate-500">
                      Статус: {enrollment.status === "ACTIVE" ? "Активно" : 
                               enrollment.status === "PAUSED" ? "На паузе" : 
                               enrollment.status === "FINISHED" ? "Завершено" : "Отменено"}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <h2 className="text-lg font-semibold">История оплат</h2>
          <div className="space-y-2">
            {data.payments.length === 0 ? (
              <Card className="p-4 text-center text-slate-500">
                Оплат пока нет
              </Card>
            ) : (
              data.payments.map(payment => (
                <Card key={payment.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{payment.enrollment.subject.name}</div>
                      <div className="text-sm text-slate-500">
                        {new Date(payment.paidAt).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    <div className="font-medium text-green-600">
                      {payment.amount.toLocaleString()} сум
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
