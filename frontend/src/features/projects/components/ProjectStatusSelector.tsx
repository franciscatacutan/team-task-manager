import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectStatus } from "../types/project.types";
import { cn } from "@/lib/utils";
import {
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../utils/project.constants";

interface Props {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  className?: string;
  disabled?: boolean;
}

export default function ProjectStatusSelector({
  value,
  onChange,
  className,
  disabled,
}: Props) {
  const statuses: ProjectStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD"];

  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(v) => onChange(v as ProjectStatus)}
    >
      <SelectTrigger
        aria-label="Project status"
        className={cn(
          "h-10 w-full rounded-xl border-border/70 bg-background px-3 text-left text-sm font-medium shadow-none",
          className,
        )}
      >
        <SelectValue>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
              ProjectStatusStyles[value],
            )}
          >
            {ProjectStatusLabel[value]}
          </span>
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="rounded-xl border-border/70">
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                ProjectStatusStyles[status],
              )}
            >
              {ProjectStatusLabel[status]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
