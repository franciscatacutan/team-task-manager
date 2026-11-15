import { parseISO } from "date-fns";

export function formatDateTimeShort(date?: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date?: string | null) {
  if (!date) return "—";

  return parseISO(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
