import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Props {
  search: string;
  label: string;
  searchChange: (search: string) => void;
}

export default function SearchBar({ search, searchChange, label }: Props) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={label}
        placeholder={`${label}...`}
        value={search}
        onChange={(e) => searchChange(e.target.value)}
        className="h-10 rounded-xl border-border/70 bg-background pl-9 shadow-none"
      />
    </div>
  );
}
