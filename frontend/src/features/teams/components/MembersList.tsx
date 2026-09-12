import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { formatDate } from "../../../common/utils/dateFormatter";

import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

import { useUpdateMemberRole } from "../hooks/useUpdateMemberRole";
import RemoveMemberModal from "./RemoveMemberModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { TEAM_ROLE_STYLES, TEAM_ROLE_LABEL } from "../constants/team.constants";
import { cn } from "../../../lib/utils";
import TransferOwnershipModal from "./TransferOwnershipModal";
import type { TeamPermissions } from "../../teams/utils/teamPermissions";
import { useTeamMe } from "../../teams/hooks/useTeamMe";
import type { TeamMember, TeamRole } from "../types/team.type";
import {
  Pagination,
  type PaginationProps,
} from "../../../common/components/pagination/Pagination";

interface Props {
  permissions: TeamPermissions;
  teamKey: string;
  members: TeamMember[];
  isLoading: boolean;
  pagination: PaginationProps;
  sort: string;
  onSortChange: (sort: string) => void;
}

export default function MembersList({
  permissions,
  teamKey,
  members,
  isLoading,
  pagination,
  sort,
  onSortChange,
}: Props) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const updateRole = useUpdateMemberRole(teamKey);

  const handleSort = (field: string) => {
    const [currentField, direction] = sort.split(",");

    if (currentField === field) {
      const newDir = direction === "asc" ? "desc" : "asc";
      onSortChange(`${field},${newDir}`);
    } else {
      onSortChange(`${field},asc`);
    }
  };

  const onOpenRemove = (member: TeamMember) => {
    setSelectedMember(member);
    setRemoveOpen(true);
  };

  function onOpenTransfer(member: TeamMember) {
    setSelectedMember(member);
    setTransferOpen(true);
  }

  const { data: teamMe } = useTeamMe(teamKey || "");

  const isOwner = teamMe?.role === "OWNER";
  const isAdmin = teamMe?.role === "ADMIN";

  type EditableRole = "ADMIN" | "MEMBER";

  const handleRoleChange = (memberId: string, role: EditableRole) => {
    updateRole.mutate({
      memberId,
      role: role as EditableRole,
    });
  };

  const isUpdating = updateRole.isPending;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/92 p-6 text-sm text-muted-foreground shadow-sm">
        Loading members...
      </div>
    );
  }

  if (!members.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-6 py-14 text-center">
        <h2 className="text-base font-semibold text-foreground">
          No members found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting the search or role filter.
        </p>
      </div>
    );
  }
  return (
    <section className="flex flex-col h-full min-h-0 gap-6">
      <div className="flex h-full min-h-0 rounded-2xl border border-border/60 bg-background/92 shadow-sm overflow-hidden">
        <Table className="overflow-auto">
          <TableHeader className="sticky top-0 z-30 rounded-2xl bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/75">
            <TableRow>
              <TableHead
                onClick={() => handleSort("user.lastName")}
                className="cursor-pointer px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Name
              </TableHead>
              <TableHead
                onClick={() => handleSort("role")}
                className="cursor-pointer px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Role
              </TableHead>
              <TableHead
                onClick={() => handleSort("user.email")}
                className="cursor-pointer px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Email
              </TableHead>
              <TableHead
                onClick={() => handleSort("joinedAt")}
                className="cursor-pointer px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Joined Date
              </TableHead>
              {(isOwner || isAdmin) && (
                <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              return (
                <TableRow key={member.id} className="hover:bg-muted/20">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border/60">
                        <AvatarFallback className="text-[11px]">
                          {member.lastName[0]}
                          {member.firstName[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {member.globalRole}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    {member.teamRole === "OWNER" ? (
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${TEAM_ROLE_STYLES.OWNER}`}
                      >
                        {TEAM_ROLE_LABEL.OWNER}
                      </Badge>
                    ) : permissions.canChangeRole ? (
                      <Select
                        value={(member.teamRole ?? "MEMBER") as TeamRole}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value as EditableRole)
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger
                          className={`h-9 w-34 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-none ${TEAM_ROLE_STYLES[(member.teamRole ?? "MEMBER") as TeamRole]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="ADMIN">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                                TEAM_ROLE_STYLES.ADMIN,
                              )}
                            >
                              {TEAM_ROLE_LABEL.ADMIN}
                            </span>
                          </SelectItem>

                          <SelectItem value="MEMBER">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                                TEAM_ROLE_STYLES.MEMBER,
                              )}
                            >
                              {TEAM_ROLE_LABEL.MEMBER}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : member.teamRole === "ADMIN" ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                          TEAM_ROLE_STYLES.ADMIN,
                        )}
                      >
                        {TEAM_ROLE_LABEL.ADMIN}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                          TEAM_ROLE_STYLES.MEMBER,
                        )}
                      >
                        {TEAM_ROLE_LABEL.MEMBER}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>

                  {(isOwner || isAdmin) && member.teamRole != "OWNER" && (
                    <TableCell className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 rounded-full p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-fit">
                          {permissions.canTransferOwnership && (
                            <>
                              <DropdownMenuItem
                                onClick={() => onOpenTransfer(member)}
                                className="text-muted-foreground"
                              >
                                Make Owner
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            disabled={!permissions.canRemoveMember}
                            onClick={() => onOpenRemove(member)}
                            className="flex items-center justify-between text-destructive focus:text-destructive"
                          >
                            <span>Remove Member</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          size={pagination.size}
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          onPageChange={pagination.onPageChange}
          onSizeChange={(size) => {
            pagination.onPageChange(0);
            pagination.onSizeChange(size);
          }}
        />
      )}

      <TransferOwnershipModal
        teamKey={teamKey}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        members={members}
        preselectedUserId={selectedMember?.id ?? null}
      />

      <RemoveMemberModal
        teamKey={teamKey}
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        member={selectedMember}
      />
    </section>
  );
}
