"use client";

import { useEffect, useState } from "react";
import { getAccessToken, getCachedUser, getCurrentUser, type AppRole, type CurrentUser } from "@/lib/auth";

export function AuthGuard({ allowedRoles, children }: { allowedRoles?: AppRole[]; children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const allowedRoleKey = allowedRoles?.join("|") ?? "";

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = "/login";
      return;
    }

    const cached = getCachedUser();
    if (cached && (!allowedRoles?.length || allowedRoles.includes(cached.role))) {
      setUser(cached);
      setReady(true);
    }

    getCurrentUser()
      .then((fresh) => {
        if (!fresh) {
          window.location.href = "/login";
          return;
        }
        if (allowedRoles?.length && !allowedRoles.includes(fresh.role)) {
          window.location.href = fresh.role === "TEACHER" ? "/teacher" : fresh.role === "STUDENT" ? "/student" : "/dashboard";
          return;
        }
        setUser(fresh);
        setReady(true);
      })
      .catch(() => {
        if (cached) {
          setUser(cached);
          setReady(true);
        } else {
          window.location.href = "/login";
        }
      });
  }, [allowedRoleKey]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/45">
        Загрузка...
      </div>
    );
  }

  return <>{children}</>;
}
