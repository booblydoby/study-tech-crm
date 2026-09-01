const SENSITIVE_KEYS = new Set(["passwordHash"]);

export function stripSensitiveFields<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item)) as T;
  }

  if (typeof value === "object" && value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        continue;
      }
      result[key] = stripSensitiveFields(nested);
    }
    return result as T;
  }

  return value;
}
