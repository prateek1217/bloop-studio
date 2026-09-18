import type { SubtitleTheme } from "@/types";

/**
 * Plain substring match by default; if the query parses as a valid regex
 * (optionally wrapped in /slashes/, with flags), matches against the theme's
 * name + animation + depth so power users can filter more precisely (e.g.
 * `/glitch|vhs/`). An invalid regex just falls back to plain text matching
 * instead of showing an error or an empty list mid-keystroke.
 */
export function filterThemes(themes: SubtitleTheme[], query: string): SubtitleTheme[] {
  const q = query.trim();
  if (!q) return themes;

  const regex = toSafeRegex(q);
  return themes.filter((t) => {
    const haystack = `${t.name} ${t.animation} ${t.depthMode}`;
    return regex ? regex.test(haystack) : haystack.toLowerCase().includes(q.toLowerCase());
  });
}

function toSafeRegex(query: string): RegExp | null {
  const slashMatch = query.match(/^\/(.*)\/([a-z]*)$/i);
  try {
    return slashMatch ? new RegExp(slashMatch[1], slashMatch[2] || "i") : new RegExp(query, "i");
  } catch {
    return null;
  }
}
