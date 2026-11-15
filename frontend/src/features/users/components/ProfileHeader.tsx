import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, UserRound, UsersRound } from "lucide-react";
import type { UserProfile } from "../types/userType";
import { USER_ROLE_LABEL, USER_ROLE_STYLES } from "../constants/user.constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  user?: UserProfile;
  isLoading: boolean;
  isSelf: boolean;
  canEditProfile: boolean;
  teamCount: number;
  editUser: (user?: UserProfile) => void;
  onEditUser: () => void;
}

export default function ProfileHeader({
  user,
  isLoading,
  isSelf,
  canEditProfile,
  teamCount,
  editUser,
  onEditUser,
}: Props) {
  return (
    <>
      {isLoading ? (
        <header className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-5">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-muted/40 ring-1 ring-border/60" />

              <div className="min-w-0 flex-1 space-y-4">
                <div className="h-6 w-28 animate-pulse rounded-full bg-muted/40" />

                <div className="space-y-2">
                  <div className="h-8 w-56 animate-pulse rounded-lg bg-muted/40" />

                  <div className="h-4 w-72 animate-pulse rounded-md bg-muted/30" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted/40" />

                  <div className="h-7 w-32 animate-pulse rounded-full bg-muted/40" />

                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted/40" />
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : user ? (
        <header className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-5">
              <Avatar className="h-20 w-20 shrink-0 border-4 border-background shadow-md ring-1 ring-border/60">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <UserRound className="h-3.5 w-3.5" />
                  {isSelf ? "My Account" : "User Profile"}
                </div>

                <div className="space-y-1">
                  <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">
                    {user?.firstName} {user?.lastName}
                  </h1>

                  <p className="truncate text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {user.role && (
                    <>
                      <Badge
                        variant="outline"
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${USER_ROLE_STYLES[user.role]}`}
                      >
                        {USER_ROLE_LABEL[user.role]}
                      </Badge>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        Global Access
                      </div>
                    </>
                  )}

                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                    <UsersRound className="h-3.5 w-3.5" />
                    {teamCount ?? 0} Teams
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              {canEditProfile && (
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => {
                    editUser(user);
                    onEditUser();
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-destructive/20 bg-background shadow-sm">
                <UserRound className="h-6 w-6 text-destructive" />
              </div>

              <div className="min-w-0 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-destructive">
                  Failed to load
                </div>

                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Unable to load profile
                  </h1>

                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    We couldn&apos;t retrieve this user&apos;s profile
                    information right now. Please refresh the page or try again
                    later.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        </header>
      )}
    </>
  );
}
