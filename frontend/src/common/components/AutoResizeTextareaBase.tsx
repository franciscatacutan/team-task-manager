import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/utils";

interface Props extends Omit<
  ComponentPropsWithoutRef<"textarea">,
  "value" | "onChange" | "onInput"
> {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export default function AutoResizeTextareaBase({
  value,
  onChange,
  onFocus,
  placeholder = "Write something...",
  maxLength = 500,
  disabled,
  className,
  ...props
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /* -------------------------
     Auto resize
  -------------------------- */
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onInput={adjustHeight}
      className={cn(
        `
        w-full resize-none text-sm
        outline-none bg-transparent
        min-h-6 max-h-50
        overflow-y-auto
        placeholder:text-muted-foreground
      `,
        className,
      )}
    />
  );
}
