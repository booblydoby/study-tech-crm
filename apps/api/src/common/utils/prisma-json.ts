import { Prisma } from "@prisma/client";

export function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  // DTO уже прошли class-validator, поэтому значение гарантированно JSON-сериализуемо.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
