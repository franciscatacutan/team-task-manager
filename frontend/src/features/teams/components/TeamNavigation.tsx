import {
  Activity,
  BarChart3,
  FolderKanban,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NavItem from "./TeamNavItem";

interface Props {
  teamKey: string;
  collapsed?: boolean;
  canAccessInsights: boolean;
  onNavigate?: () => void;
}
export default function TeamNavigation({
  teamKey,
  collapsed,
  canAccessInsights,
  onNavigate,
}: Props) {
  const base = `/teams/${teamKey}`;
  const items = [
    { path: base, label: "Overview", icon: LayoutDashboard, end: true },
    { path: `${base}/projects`, label: "Projects", icon: FolderKanban },
    { path: `${base}/members`, label: "Members", icon: Users },
    { path: `${base}/activity`, label: "Activity", icon: Activity },
    ...(canAccessInsights
      ? [{ path: `${base}/insights`, label: "Insights", icon: BarChart3 }]
      : []),
  ];
  return (
    <TooltipProvider>
      <nav aria-label="Workspace" className="space-y-1 p-2">
        {items.map((item) => (
          <NavItem
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            end={item.end}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </TooltipProvider>
  );
}
