import { Prisma } from "@prisma/client";

export function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}
