import { cn } from "@/lib/utils";

export type TagVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "group";

const variantClass: Record<TagVariant, string> = {
  success: "admin-tag-success",
  warning: "admin-tag-warning",
  danger: "admin-tag-danger",
  info: "admin-tag-info",
  neutral: "admin-tag-neutral",
  brand: "admin-tag-brand",
  group: "admin-tag-group"
};

export function Tag({
  variant = "neutral",
  className,
  children
}: {
  variant?: TagVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("admin-tag", variantClass[variant], className)}>{children}</span>;
}

/** Статус занятия → единый бейдж. */
export function lessonStatusTag(status: string) {
  if (status === "COMPLETED") return { variant: "success" as const, label: "Проведено" };
  if (status === "CANCELLED") return { variant: "danger" as const, label: "Отменено" };
  if (status === "MOVED") return { variant: "warning" as const, label: "Перенесено" };
  return { variant: "info" as const, label: "Запланировано" };
}

/** Статус начисления / оплаты → единый бейдж. */
export function chargeStatusTag(status: string, pending = false) {
  if (pending) return { variant: "neutral" as const, label: "Ожидает оплаты" };
  if (status === "PAID") return { variant: "success" as const, label: "Оплачено" };
  if (status === "PARTIAL") return { variant: "warning" as const, label: "Частично" };
  if (status === "UNPAID") return { variant: "danger" as const, label: "Не оплачено" };
  return { variant: "neutral" as const, label: status };
}

/** Статус студента → единый бейдж. */
export function studentStatusTag(status: string) {
  if (status === "ACTIVE") return { variant: "success" as const, label: "Активен" };
  if (status === "INACTIVE") return { variant: "neutral" as const, label: "Неактивен" };
  if (status === "ARCHIVED") return { variant: "neutral" as const, label: "Архив" };
  return { variant: "neutral" as const, label: status };
}
