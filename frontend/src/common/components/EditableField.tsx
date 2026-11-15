import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestError } from "../utils/requestError";
import AutoResizeTextareaBase from "./AutoResizeTextareaBase";
interface Props {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  displayClassName?: string;
  inputClassName?: string;
  onSave: (value: string) => void | Promise<unknown>;
  disabled?: boolean;
  allowEmpty?: boolean;
  label?: string;
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
  allowEmpty = false,
  label = multiline ? "Edit description" : "Edit name",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (!editing) setDraft(value);
  }
  const cancel = useCallback(() => {
    if (saving) return;
    setDraft(value);
    setEditing(false);
    setError("");
  }, [saving, value]);
  useEffect(() => {
    if (editing)
      container.current?.querySelector<HTMLElement>("input,textarea")?.focus();
  }, [editing]);
  useEffect(() => {
    if (!editing || saving || error) return;
    const outside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) cancel();
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [editing, saving, error, cancel]);
  async function save() {
    const next = draft.trim();
    if (
      inFlight.current ||
      disabled ||
      (!allowEmpty && !next) ||
      (maxLength && next.length > maxLength)
    )
      return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (next !== value) await onSave(next);
      setEditing(false);
    } catch (error) {
      setError(requestError(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  if (!editing)
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={label}
        onClick={() => {
          if (!disabled) {
            setDraft(value);
            setError("");
            setEditing(true);
          }
        }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setDraft(value);
            setError("");
            setEditing(true);
          }
        }}
        className={cn(
          "group cursor-pointer rounded-md px-2 py-1 transition hover:bg-muted/50",
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
  return (
    <div
      ref={container}
      className="space-y-2 rounded-md border bg-background px-3 py-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          cancel();
        }
        if (event.key === "Enter" && !multiline) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <fieldset disabled={saving || disabled}>
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
            aria-label={label}
            value={draft}
            maxLength={maxLength}
            onChange={(event) => setDraft(event.target.value)}
            className={cn(
              "border-none px-0 py-0 text-sm shadow-none focus-visible:ring-0",
              inputClassName,
            )}
          />
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {maxLength ? `${draft.length} / ${maxLength}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={cancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={
              saving ||
              disabled ||
              (!allowEmpty && !draft.trim()) ||
              Boolean(maxLength && draft.trim().length > maxLength)
            }
          >
            {saving ? "Saving..." : error ? "Retry save" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
