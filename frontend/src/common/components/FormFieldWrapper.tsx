import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid": boolean;
}

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  length?: number;
  maxLength?: number;
  framed?: boolean;
  children: (props: ControlProps) => ReactNode;
}

/** A connected label, control and feedback; domain validation stays in each form. */
export default function FormField({
  label,
  required = false,
  hint,
  error,
  length,
  maxLength,
  framed = true,
  children,
}: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const describedBy =
    [hint && hintId, error && errorId, maxLength !== undefined && countId]
      .filter(Boolean)
      .join(" ") || undefined;
  const isNearLimit =
    maxLength !== undefined &&
    length !== undefined &&
    length >= maxLength * 0.9;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      <div
        className={cn(
          framed &&
            "rounded-lg border bg-background px-3 py-2 transition focus-within:ring-2 focus-within:ring-ring/50",
          framed && error && "border-destructive",
        )}
      >
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": Boolean(error),
        })}
      </div>
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="min-w-0 space-y-1">
          {hint && (
            <p id={hintId} className="text-foreground/75">
              {hint}
            </p>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
        {maxLength !== undefined && (
          <span
            id={countId}
            className={cn(
              "shrink-0 text-foreground/75",
              isNearLimit && "text-destructive",
            )}
          >
            {length ?? 0} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
