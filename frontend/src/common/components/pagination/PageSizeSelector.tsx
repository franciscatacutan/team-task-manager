import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

interface Props {
  size: number;
  onChange: (size: number) => void;
  options?: number[];
}

export function PageSizeSelector({
  size,
  onChange,
  options = [10, 20, 50],
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Rows</span>

      <Select value={String(size)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger aria-label="Rows per page" className="h-8 w-20">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
