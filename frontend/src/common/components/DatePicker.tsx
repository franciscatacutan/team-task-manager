import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { Calendar } from "../../components/ui/calendar";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface Props {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-auto min-h-10 w-full rounded-xl border-border/70 bg-background px-3 py-2 text-left font-normal shadow-none hover:bg-muted/20",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/45 text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 text-sm leading-5">
              {value ? (
                <span className="block truncate font-medium text-foreground">
                  {format(value, "MMM d, yyyy")}
                </span>
              ) : (
                <span className="block truncate">{placeholder}</span>
              )}
            </span>
          </span>

          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto rounded-xl border-border/70 p-2 shadow-lg"
        align="start"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
