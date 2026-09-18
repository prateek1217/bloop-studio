export function formatTime(seconds: number): string {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "just now" — for a project's last-updated timestamp. */
export function formatRelativeTime(ms: number): string {
  const diff = ms - Date.now();
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= unitMs) {
      return relativeFormatter.format(Math.round(diff / unitMs), unit);
    }
  }
  return "just now";
}
