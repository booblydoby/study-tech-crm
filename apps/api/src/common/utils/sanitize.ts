const SENSITIVE_KEYS = new Set(["passwordHash"]);

type JsonSafeValue = unknown;

export function stripSensitiveFields(value: JsonSafeValue): JsonSafeValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item));
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        continue;
      }
      result[key] = stripSensitiveFields(nested);
    }
    return result;
  }

  return value;
}
