"use client";

import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CreditCard, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { apiGet } from "@/lib/api";

const roles = ["Admin", "Teacher", "Student"] as const;
type Role = (typeof roles)[number];

const descriptions: Record<Role, string> = {
  Admin: "Daily operations: students, teachers, groups, subjects, schedule and reports.",
  Teacher: "Trusted schedule workspace: own lessons, groups, individual students and attendance.",
  Student: "Student-side view: schedule, subjects, teachers, payment status and attendance."
};

interface DashboardData {
  students: number;
  activeGroups: number;
  teachers: number;
  revenue: number;
  debts: number;
  attendance: Record<string, number>;
}

export default function RolePreviewPage() {
  const [role, setRole] = useState<Role>("Admin");
  const [stats, setStats] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiGet<DashboardData>("/analytics/dashboard");
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <PageHeader title="Role preview" description="Switch roles to see how the CRM should feel for each user type." />

      <div className="mb-6 flex flex-wrap gap-2">
        {roles.map((item) => (
          <Button key={item} variant={role === item ? "default" : "outline"} onClick={() => setRole(item)}>
            {item}
          </Button>
        ))}
      </div>

      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-md bg-accent text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{role}</h2>
            <p className="mt-1 text-sm text-slate-500">{descriptions[role]}</p>
          </div>
        </div>
      </Card>

      {role === "Admin" && <AdminView stats={stats} />}
      {role === "Teacher" && <TeacherView />}
      {role === "Student" && <StudentView />}
    </AppShell>
  );
}

function AdminView({ stats }: { stats: DashboardData | null }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Students" value={String(stats?.students ?? "-")} icon={Users} />
        <Metric title="Groups" value={String(stats?.activeGroups ?? "-")} icon={GraduationCap} />
        <Metric title="Teachers" value={String(stats?.teachers ?? "-")} icon={ShieldCheck} />
      </div>
    </div>
  );
}

function TeacherView() {
  return (
    <div className="grid gap-4">
      <Card>
        <p className="text-sm text-slate-500 py-4 text-center">
          Teacher dashboard uses real data from your account. Switch to Teacher role and visit /teacher.
        </p>
      </Card>
    </div>
  );
}

function StudentView() {
  return (
    <div className="grid gap-4">
      <Card>
        <p className="text-sm text-slate-500 py-4 text-center">
          Student dashboard uses real data from your account. Switch to Student role and visit /student.
        </p>
      </Card>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: ComponentType<{ size?: number }> }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-md bg-accent text-primary">
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}
