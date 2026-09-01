import { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  roleId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: true
} satisfies Prisma.UserSelect;
