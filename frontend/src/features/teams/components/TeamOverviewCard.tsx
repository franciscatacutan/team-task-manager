import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";

interface Props {
  title: string;
  description: string;
  value?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  accentClassName?: string;
  to: string;
}

export default function OverviewCard({
  title,
  description,
  value,
  eyebrow,
  icon: Icon,
  accentClassName,
  to,
}: Props) {
  return (
    <Link
      to={to}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className="
        group cursor-pointer border-border/60 bg-background/90 transition-all
        hover:-translate-y-0.5 hover:border-border hover:shadow-sm
      "
      >
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {eyebrow && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {eyebrow}
                </p>
              )}
              <h3 className="text-sm font-medium text-foreground transition group-hover:text-primary">
                {title}
              </h3>
            </div>

            {Icon ? (
              <div
                className={cn(
                  "rounded-xl border border-border/60 bg-muted/25 p-1.5 text-muted-foreground transition group-hover:border-border group-hover:text-foreground",
                  accentClassName,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            ) : null}
          </div>

          {value ? (
            <div className="text-xl font-semibold tracking-tight text-foreground">
              {value}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="max-w-[11rem] text-xs leading-5 text-muted-foreground">
              {description}
            </p>

            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
