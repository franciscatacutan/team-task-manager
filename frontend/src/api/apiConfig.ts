/** Blank means the browser's own origin; an explicit override is an API origin, without /api. */
export function apiOrigin(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export const configuredApiOrigin = apiOrigin(import.meta.env.VITE_API_URL);
export const apiBaseURL = `${configuredApiOrigin}/api`;
