import { canEditUser } from "../utils/userPermissions";
import {
  ArrowUpDown,
  KeyRound,
  MoreHorizontal,
  PencilLine,
} from "lucide-react";
import type { SortField } from "@/common/types/sort.types";

import {
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  Table,
  TableHead,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { SortHeader } from "@/common/components/toolbar/SortHeader";
import type { User } from "../types/userType";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { USER_ROLE_LABEL, USER_ROLE_STYLES } from "../constants/user.constants";

interface Props {
  users: User[];
  currentUser: User;
  isLoading: boolean;

  editUser: (user: User) => void;
  resetPassword: (user: User) => void;

  onEditUser: () => void;
  onResetPassword: () => void;

  sortField: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;

  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const SORT_COLUMNS = [
  ["firstName", "First Name"],
  ["lastName", "Last Name"],
  ["email", "Email"],
  ["role", "Global Role"],
];

export default function UsersList({
  users,
  currentUser,
  isLoading,
  onClearFilters,
  hasActiveFilters,

  editUser,
  resetPassword,
  onEditUser,
  onResetPassword,

  sortField,
  sortOrder,
  onSort,
}: Props) {
  return (
    <>
      {isLoading ? (
        <div className="flex flex-col">
          <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <TableHead key={field} className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {label}
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    {SORT_COLUMNS.map(([key]) => (
                      <TableCell key={key} className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : users.length > 0 ? (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex flex-1 overflow-auto rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <SortHeader
                      label={label}
                      field={field as SortField}
                      sortField={sortField}
                      order={sortOrder}
                      onSort={onSort}
                    />
                  ))}
                  <TableHead className="px-4 py-3">
                    <span className="text-muted-foreground ">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((user) => {
                  const canManageUser =
                    user.id !== currentUser.id &&
                    canEditUser(currentUser, user);

                  return (
                    <TableRow
                      key={user.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="font-medium truncate group-hover:text-primary transition-colors">
                          {user.firstName}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="font-medium truncate group-hover:text-primary transition-colors">
                          {user.lastName}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="truncate group-hover:text-primary transition-colors">
                          {user.email}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${USER_ROLE_STYLES[user.role]}`}
                        >
                          {USER_ROLE_LABEL[user.role]}
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3">
                        {canManageUser && (
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
                              <DropdownMenuItem
                                key={user.id}
                                onClick={() => {
                                  editUser(user);
                                  onEditUser();
                                }}
                                className="text-muted-foreground"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                key={user.id}
                                onClick={() => {
                                  resetPassword(user);
                                  onResetPassword();
                                }}
                                className="text-muted-foreground"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Reset password
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {hasActiveFilters ? "No matching users" : "No users yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing the search or filters to see more users."
              : "Users will appear here once accounts are created."}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="mt-6 rounded-xl"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </>
  );
}
