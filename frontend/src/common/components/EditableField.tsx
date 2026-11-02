import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import AutoResizeTextareaBase from "./AutoResizeTextareaBase";

interface Props {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  displayClassName?: string;
  inputClassName?: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export default function EditableField({
  value = "",
  placeholder = "Click to edit",
  multiline = false,
  maxLength,
  displayClassName,
  inputClassName,
  onSave,
  disabled,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    const trimmed = draft.trim();

    if (trimmed !== value) {
      onSave(trimmed);
    }

    setEditing(false);
  };

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);
  useEffect(() => {
    if (!editing) return;

    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        cancel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editing, cancel]);

  useEffect(() => {
    if (!editing) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editing, cancel]);

  if (!editing) {
    return (
      <div
        onClick={() => {
          if (disabled) return;
          setEditing(true);
        }}
        className={cn(
          "group rounded-md px-2 py-1 transition cursor-pointer hover:bg-muted/50",
          disabled && "cursor-default hover:bg-transparent",
        )}
      >
        <span className={displayClassName}>
          {value || (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-2 rounded-md border bg-background px-3 py-2"
    >
      {multiline ? (
        <AutoResizeTextareaBase
          value={draft}
          onChange={setDraft}
          maxLength={maxLength}
          placeholder={placeholder}
          className={cn("text-sm", inputClassName)}
        />
      ) : (
        <Input
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          className={cn(
            "border-none px-0 py-0 focus-visible:ring-0 shadow-none text-sm",
            inputClassName,
          )}
        />
      )}

      <div className="flex items-center justify-between">
        {maxLength ? (
          <span
            className={cn(
              "text-xs",
              draft.length > maxLength * 0.9
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {draft.length} / {maxLength}
          </span>
        ) : (
          <span />
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>

          <Button size="sm" onClick={save} disabled={!draft.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
