import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";

import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { cn } from "../../lib/utils";
import type { UserIdentity } from "../../features/users/types/userType";

interface Props {
  users: UserIdentity[];
  value?: string[];
  selectedUsers?: UserIdentity[];
  disabled?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  maxVisibleBadges?: number;
  onChange: (ids: string[]) => void;
}

export default function MultiUserSelector({
  users,
  value = [],
  selectedUsers: selectedUserRecords,
  disabled = false,
  search,
  onSearchChange,
  placeholder = "Select users",
  className,
  popoverClassName,
  maxVisibleBadges = 3,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(() => new Set(value), [value]);
  const selectedUsers = (selectedUserRecords ?? users).filter((user) =>
    selectedIds.has(user.id),
  );
  const hiddenCount = Math.max(selectedUsers.length - maxVisibleBadges, 0);

  function toggleUser(userId: string) {
    if (disabled) return;
    if (selectedIds.has(userId)) {
      onChange(value.filter((id) => id !== userId));
      return;
    }

    onChange([...value, userId]);
  }

  function removeUser(userId: string) {
    onChange(value.filter((id) => id !== userId));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
      modal={true}
    >
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "h-auto min-h-11 w-full cursor-pointer justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-left font-normal shadow-none hover:bg-muted/20 flex items-center",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
            <div className="mt-0.5 shrink-0 rounded-lg bg-muted/70 p-1 text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>

            {selectedUsers.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {selectedUsers.slice(0, maxVisibleBadges).map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="max-w-full gap-1.5 rounded-full border border-border/60 bg-muted/60 px-1.5 py-1 text-xs font-medium text-foreground"
                  >
                    <Avatar className="h-5 w-5 shrink-0 ring-1 ring-border/50">
                      <AvatarFallback className="text-[9px]">
                        {user.lastName?.[0]}
                        {user.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <span className="max-w-28 truncate">
                      {user.firstName} {user.lastName}
                    </span>

                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Remove ${user.firstName} ${user.lastName}`}
                      className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeUser(user.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                {hiddenCount > 0 && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-dashed border-border/70 px-2 py-1 text-xs text-muted-foreground"
                  >
                    +{hiddenCount} more
                  </Badge>
                )}
              </div>
            ) : (
              <span className="truncate text-sm leading-5">{placeholder}</span>
            )}
          </div>

          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "max-h-[min(70vh,32rem)] w-[min(30rem,calc(100vw-2rem))] min-w-[20rem] overflow-hidden rounded-2xl border-border/70 p-0 shadow-xl",
          popoverClassName,
        )}
      >
        <Command className="min-h-0">
          <div className="border-b border-border/60 px-1 pb-1 pt-1">
            <CommandInput
              disabled={disabled}
              value={search}
              onValueChange={onSearchChange}
              placeholder="Search users..."
            />
          </div>

          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">
              {selectedUsers.length > 0
                ? `${selectedUsers.length} selected`
                : "Choose one or more users"}
            </div>

            {selectedUsers.length > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                disabled={disabled}
                onClick={clearAll}
              >
                Clear all
              </button>
            )}
          </div>

          <CommandList className="max-h-[min(52vh,24rem)] overscroll-contain">
            <CommandEmpty>No user found.</CommandEmpty>

            <CommandGroup className="p-2">
              {users.map((user) => {
                const isSelected = selectedIds.has(user.id);
                const label = `${user.firstName} ${user.lastName}`;

                return (
                  <CommandItem
                    disabled={disabled}
                    key={user.id}
                    value={`${label} ${user.email}`}
                    className={cn(
                      "items-start gap-3 rounded-xl border border-transparent px-3 py-3 data-selected:border-border/70 data-selected:bg-muted/40",
                      isSelected && "border-primary/20 bg-primary/5",
                    )}
                    onSelect={() => toggleUser(user.id)}
                  >
                    <Avatar className="mt-0.5 h-9 w-9 shrink-0 ring-1 ring-border/50">
                      <AvatarFallback className="text-[10px]">
                        {user.lastName?.[0]}
                        {user.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {label}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-background text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
