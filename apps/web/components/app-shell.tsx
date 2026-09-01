"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  UserRound,
  X
} from "lucide-react";
import { AmbientBackground } from "@/components/landing/ambient-background";
import { AuthGuard } from "@/components/auth-guard";
import { getCachedUser, logout, type AppRole, type CurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";

const allLinks = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/teacher", label: "Мой кабинет", icon: UserCheck },
  { href: "/students", label: "Студенты", icon: Users },
  { href: "/enrollments", label: "Записи", icon: UserCheck },
  { href: "/teachers", label: "Преподаватели", icon: UserRound },
  { href: "/subjects", label: "Предметы", icon: BookOpen },
  { href: "/groups", label: "Группы", icon: GraduationCap },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/student", label: "Кабинет студента", icon: GraduationCap },
  { href: "/payments", label: "Оплаты", icon: CreditCard },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 }
];

const linksByRole: Record<AppRole, string[]> = {
  ADMIN: ["/dashboard", "/students", "/enrollments", "/teachers", "/subjects", "/groups", "/schedule", "/payments", "/analytics"],
  TEACHER: ["/teacher", "/schedule"],
  STUDENT: ["/student", "/schedule", "/payments"]
};

const roleLabels: Record<AppRole, string> = {
  ADMIN: "Администратор",
  TEACHER: "Преподаватель",
  STUDENT: "Студент"
};

function NavLinks({ links, pathname, onNavigate }: { links: typeof allLinks; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`admin-nav-link ${active ? "admin-nav-link-active" : ""}`}
          >
            <link.icon size={18} className={active ? "text-brand-yellow" : undefined} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: AppRole[] }) {
  const pathname = usePathname();
  const [user] = useState<CurrentUser | null>(() => getCachedUser());
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = useMemo(() => {
    if (!user) return [];
    const allowed = new Set(linksByRole[user.role]);
    return allLinks.filter((link) => allowed.has(link.href));
  }, [user]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <AuthGuard allowedRoles={allowedRoles}>
      <div className="admin-panel relative min-h-screen overflow-x-hidden bg-[#111318] text-white">
        <AmbientBackground />

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange shadow-lg shadow-orange-500/20">
              <GraduationCap size={18} className="text-[#0a0a0a]" />
            </div>
            <span className="text-sm font-bold">{siteConfig.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg border border-white/10 p-2 text-white/80 hover:bg-white/5"
            aria-label="Меню"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={closeMobile} aria-label="Закрыть" />
            <aside className="admin-sidebar absolute inset-y-0 left-0 flex w-72 flex-col px-4 py-5 shadow-2xl">
              <div className="mb-6 flex items-center gap-3 px-1">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange shadow-lg shadow-orange-500/25">
                  <GraduationCap size={20} className="text-[#0a0a0a]" />
                </div>
                <div>
                  <p className="text-sm font-bold">{siteConfig.name}</p>
                  <p className="text-xs text-white/45">{siteConfig.tagline}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavLinks links={links} pathname={pathname} onNavigate={closeMobile} />
              </div>
              <UserFooter user={user} />
            </aside>
          </div>
        ) : null}

        {/* Desktop sidebar */}
        <aside className="admin-sidebar fixed inset-y-0 left-0 z-20 hidden w-64 flex-col px-4 py-5 lg:flex">
          <div className="mb-8 flex items-center gap-3 px-1">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange shadow-lg shadow-orange-500/30">
              <GraduationCap size={22} className="text-[#0a0a0a]" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">{siteConfig.name}</p>
              <p className="text-xs text-white/45">{siteConfig.tagline}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <NavLinks links={links} pathname={pathname} />
          </div>

          <UserFooter user={user} />
        </aside>

        <main className="relative z-10 lg:pl-64">
          <div className="admin-fade-in mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:py-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}

function UserFooter({ user }: { user: CurrentUser | null }) {
  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
        <p className="truncate text-xs font-semibold text-white/90">{user?.fullName ?? "—"}</p>
        <p className="text-xs text-white/45">{user?.role ? roleLabels[user.role] : "—"}</p>
      </div>
      <button
        type="button"
        onClick={logout}
        className="admin-nav-link w-full text-white/55 hover:text-rose-300"
      >
        <LogOut size={18} />
        Выйти
      </button>
    </div>
  );
}
