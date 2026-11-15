import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
interface Props {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
  end?: boolean;
  onNavigate?: () => void;
}
export default function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
  onNavigate,
}: Props) {
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-muted/70 font-medium text-foreground shadow-sm"
            : "text-foreground/75 hover:bg-muted/35 hover:text-foreground",
        )
      }
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    link
  );
}
