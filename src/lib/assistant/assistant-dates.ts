const weekdayIndexes: Record<string, number> = {
  lundi: 0,
  mardi: 1,
  mercredi: 2,
  jeudi: 3,
  vendredi: 4,
  samedi: 5,
  dimanche: 6,
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/g, "").toLowerCase();
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(wallClock);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const local = zonedParts(candidate, timezone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    candidate = new Date(candidate.getTime() + wallClock - represented);
  }
  return candidate;
}

function addDays(year: number, month: number, day: number, amount: number) {
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function mondayIndex(year: number, month: number, day: number) {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export type ResolvedNaturalDate = {
  iso: string;
  label: string;
  timezone: string;
};

export function resolveNaturalDate(
  text: string,
  options: { now?: Date; timezone: string; defaultHour?: number } ,
): ResolvedNaturalDate | null {
  const normalized = normalize(text);
  const now = options.now ?? new Date();
  const timezone = options.timezone;
  const defaultHour = options.defaultHour ?? 9;
  const today = zonedParts(now, timezone);
  let offset: number | null = null;

  if (/\baujourd'hui\b/.test(normalized) || /\baujourdhui\b/.test(normalized)) offset = 0;
  else if (/\bapres-demain\b/.test(normalized) || /\bapres demain\b/.test(normalized)) offset = 2;
  else if (/\bdemain\b/.test(normalized)) offset = 1;
  else {
    const inDays = normalized.match(/\bdans\s+(\d{1,3})\s+jours?\b/);
    if (inDays) offset = Number(inDays[1]);
  }

  if (offset === null && /\bla semaine prochaine\b/.test(normalized)) {
    offset = 7 - mondayIndex(today.year, today.month, today.day);
  }

  if (offset === null) {
    const weekday = Object.keys(weekdayIndexes).find((name) => normalized.includes(name));
    if (weekday) {
      const currentIndex = mondayIndex(today.year, today.month, today.day);
      const requestedIndex = weekdayIndexes[weekday];
      if (new RegExp(`${weekday}\\s+prochain`).test(normalized)) {
        offset = 7 - currentIndex + requestedIndex;
      } else {
        offset = (requestedIndex - currentIndex + 7) % 7;
        if (offset === 0) offset = 7;
      }
    }
  }

  if (offset === null || offset > 365) return null;
  const target = addDays(today.year, today.month, today.day, offset);
  const time = normalized.match(/\b(?:a|à)\s*(\d{1,2})(?:[h:](\d{2}))?\b/);
  const hour = time ? Math.min(Number(time[1]), 23) : defaultHour;
  const minute = time?.[2] ? Math.min(Number(time[2]), 59) : 0;
  const date = localDateToUtc(target.year, target.month, target.day, hour, minute, timezone);
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return { iso: date.toISOString(), label, timezone };
}
