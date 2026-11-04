import { useId, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import AutoResizeTextareaBase from "./AutoResizeTextareaBase";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string;
  label?: string;
}

export default function AutoResizeTextareaForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  maxLength = 500,
  disabled,
  isLoading,
  error,
  label = "Comment",
}: Props) {
  const [focused, setFocused] = useState(false);
  const errorId = useId();
  const locked = Boolean(disabled || isLoading);

  function handleSubmit() {
    if (locked || !value.trim()) return;

    onSubmit();
  }

  return (
    <div
      aria-busy={isLoading}
      className={cn(
        "rounded-lg border bg-background px-3 py-2 transition",
        focused && "ring-1 ring-primary",
      )}
    >
      {/* TEXTAREA */}
      <AutoResizeTextareaBase
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={locked}
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        className="text-sm"
      />

      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Keep the controls visible throughout posting and retry. */}
      {(focused || value.length > 0 || isLoading || error) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {value.length} / {maxLength}
          </span>

          <div className="ml-auto flex shrink-0 gap-2">
            {onCancel && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={locked}
                onClick={() => {
                  setFocused(false);
                  onCancel();
                }}
              >
                Cancel
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!value.trim() || locked}
            >
              {isLoading ? "Posting..." : error ? "Retry comment" : "Post"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
