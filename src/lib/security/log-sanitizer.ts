const sensitiveKey = /(authorization|cookie|password|secret|token|signed[_-]?url|service[_-]?role)/i;

export function sanitizeLogContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLogContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitiveKey.test(key) ? "[REDACTED]" : sanitizeLogContext(entry),
  ]));
}
