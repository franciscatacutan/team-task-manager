import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import type { SortOrder } from "@/common/types/sort.types";

interface Props<TField extends string> {
  label: string;
  field: TField;
  sortField: TField;
  order: SortOrder;
  onSort: (field: TField) => void;
}

export function SortHeader<TField extends string>({
  label,
  field,
  sortField,
  order,
  onSort,
}: Props<TField>) {
  const isActive = sortField === field;

  return (
    <TableHead
      aria-sort={
        isActive ? (order === "asc" ? "ascending" : "descending") : "none"
      }
      className="group select-none p-0"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label}`}
        className="flex min-h-10 w-full items-center gap-2 rounded-sm px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          className={cn(
            "transition-colors",
            isActive
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {label}
        </span>

        <span className="flex items-center">
          {isActive ? (
            order === "asc" ? (
              <ArrowUp
                aria-hidden="true"
                className="h-3.5 w-3.5 text-primary transition-all"
              />
            ) : (
              <ArrowDown
                aria-hidden="true"
                className="h-3.5 w-3.5 text-primary transition-all"
              />
            )
          ) : (
            <ArrowUpDown
              aria-hidden="true"
              className="h-3.5 w-3.5 text-muted-foreground opacity-30 group-hover:opacity-80 transition"
            />
          )}
        </span>
      </button>
    </TableHead>
  );
}
