export const AGENDA_TIME_ZONE = "Europe/Paris";

export function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function addCalendarDays(value: string, days: number) {
  const date = parseCalendarDate(value);
  if (!date || !Number.isInteger(days)) throw new Error("Date calendaire invalide");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOfWeek(value: string) {
  const date = parseCalendarDate(value);
  if (!date) throw new Error("Date calendaire invalide");
  const day = date.getUTCDay() || 7;
  return addCalendarDays(value, 1 - day);
}

export function durationMinutes(startAt: string, endAt: string) {
  const duration = (Date.parse(endAt) - Date.parse(startAt)) / 60_000;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Durée invalide");
  return duration;
}

export function parisLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Date/heure locale invalide");
  const target = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]));
    const rendered = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    candidate += target - rendered;
  }
  return new Date(candidate).toISOString();
}

export function isoToParisLocal(value: string) {
  const formatter = new Intl.DateTimeFormat("fr-CA", {
    timeZone: AGENDA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function todayInParis(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AGENDA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
