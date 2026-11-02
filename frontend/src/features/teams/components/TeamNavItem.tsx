import type { LucideIcon } from "lucide-react";
import { cn } from "../../../lib/utils";
import { NavLink } from "react-router";

interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
  end?: boolean;
}

export default function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-muted/70 font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />

      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
