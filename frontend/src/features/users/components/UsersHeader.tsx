import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersRound, Shield } from "lucide-react";
import type { User } from "../types/userType";
import type { UserRole } from "../types/userRole";

interface Props {
  users: User[];
}

export default function UsersHeader({ users }: Props) {
  function countByRole(users: User[], role: UserRole) {
    return users.filter((user) => user.role === role).length;
  }
  return (
    <section className="rounded-3xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <UsersRound className="h-3.5 w-3.5" />
            User management
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manage people and access
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Update account details, reset passwords, and manage global roles
            from one place.
          </p>
        </div>

        <div className="flex-1 grid gap-3 sm:grid-cols-3">
          <Card
            size="sm"
            className="border-border/60 bg-background/95 shadow-sm"
          >
            <CardHeader className="gap-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <UsersRound className="h-3.5 w-3.5" />
                Users on this page
              </div>
              <CardTitle className="text-xl font-semibold">
                {users.length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card
            size="sm"
            className="border-border/60 bg-background/95 shadow-sm"
          >
            <CardHeader className="gap-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Global admins on this page
              </div>
              <CardTitle className="text-xl font-semibold">
                {countByRole(users, "ADMIN")}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card
            size="sm"
            className="border-border/60 bg-background/95 shadow-sm"
          >
            <CardHeader className="gap-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Super admins on this page
              </div>
              <CardTitle className="text-xl font-semibold">
                {countByRole(users, "SUPER_ADMIN")}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}
