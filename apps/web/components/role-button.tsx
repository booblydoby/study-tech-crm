"use client";

import { ReactNode } from "react";
import { getCachedUser, type AppRole } from "@/lib/auth";

interface RoleButtonProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  className?: string;
}

export function RoleButton({ children, allowedRoles, className }: RoleButtonProps) {
  const user = getCachedUser();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}