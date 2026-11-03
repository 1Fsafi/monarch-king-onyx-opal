export type NyStamp = {
  key: string;
  minutes: number;
  weekday: string;
  label: string;
};

const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

const EARLY = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

export const OPEN_MIN = 9 * 60 + 30;
export const FLAT_MIN = 15 * 60 + 55;
export const ENTRY_FROM = 9 * 60 + 45;
export const ENTRY_UNTIL = 15 * 60 + 30;
export const OR_BARS = 3;

export function nyNow(date = new Date()): NyStamp {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  return {
    key: `${bag.year}-${bag.month}-${bag.day}`,
    minutes: hour * 60 + minute,
    weekday: bag.weekday ?? "",
    label: `${bag.weekday} ${bag.month}/${bag.day} ${pad(hour)}:${pad(minute)} ET`,
  };
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function isHoliday(day: string) {
  return HOLIDAYS.has(day);
}

export function closeMin(day: string) {
  return EARLY.has(day) ? 13 * 60 : 16 * 60;
}

export function flatMin(day: string) {
  return EARLY.has(day) ? 12 * 60 + 55 : FLAT_MIN;
}

export function entryUntil(day: string) {
  return EARLY.has(day) ? 12 * 60 + 30 : ENTRY_UNTIL;
}

export function isWeekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 17, 0, 0));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(utc);
  return wd !== "Sat" && wd !== "Sun";
}

export function sessionOpen(day: string, minutes: number) {
  if (!isWeekday(day) || isHoliday(day)) return false;
  return minutes >= OPEN_MIN && minutes < closeMin(day);
}

export function dayFromUnix(sec: number) {
  return nyNow(new Date(sec * 1000));
}
