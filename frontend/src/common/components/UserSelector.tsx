import { ChevronsUpDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { cn } from "../../lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import { Button } from "../../components/ui/button";
import { useState } from "react";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";

export interface SelectorUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  users: SelectorUser[];
  selectedUser?: SelectorUser | null;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onOpenChange?: (open: boolean) => void;
  value?: string;
  placeholder: string;
  allowClear?: boolean;
  excludedUserIds?: string[];
  className?: string;
  popoverClassName?: string;
  onChange: (id: string | null) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export default function UserSelector({
  users,
  selectedUser: selectedRecord,
  disabled = false,
  isLoading = false,
  error,
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onOpenChange,
  value,
  placeholder = "Select user",
  allowClear = false,
  excludedUserIds = [],
  className,
  popoverClassName,
  onChange,
  search,
  onSearchChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const excludedIds = new Set(excludedUserIds.filter(Boolean));
  const availableUsers = users.filter(
    (user) => user.id === value || !excludedIds.has(user.id),
  );
  const selectedUser =
    users.find((u) => u.id === value) ??
    (selectedRecord?.id === value ? selectedRecord : undefined);
  const changeOpen = (next: boolean) => {
    if (next && disabled) return;
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          disabled={disabled}
          variant="outline"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={open}
          className={cn(
            "h-auto min-h-10 w-full rounded-xl border-border/70 bg-background px-3 py-2 text-left font-normal shadow-none hover:bg-muted/20",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-2">
            {selectedUser ? (
              <>
                <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/60">
                  <AvatarFallback className="text-[10px]">
                    {selectedUser.lastName?.[0]}
                    {selectedUser.firstName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
                  <span className="line-clamp-2 break-words">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </span>
                </span>
              </>
            ) : (
              <span className="block min-w-0 truncate text-sm leading-5">
                {placeholder}
              </span>
            )}
          </span>

          <span className="flex shrink-0 items-start pt-0.5">
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "w-[min(26rem,calc(100vw-2rem))] min-w-[18rem] rounded-xl border-border/70 p-0",
          popoverClassName,
        )}
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder="Search user..."
            value={search}
            onValueChange={onSearchChange}
          />

          <CommandList>
            {isLoading && (
              <p role="status" className="p-3 text-sm">
                Loading members...
              </p>
            )}
            {error && (
              <div role="alert" className="p-3 text-sm text-destructive">
                {error}{" "}
                <Button type="button" variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            )}
            {!isLoading && !error && (
              <CommandEmpty>No user found.</CommandEmpty>
            )}

            <CommandGroup>
              {/* Optional clear */}
              {allowClear && (
                <CommandItem
                  value="none"
                  className="gap-2"
                  onSelect={() => {
                    onChange(null);
                    changeOpen(false);
                  }}
                  forceMount
                >
                  None
                </CommandItem>
              )}

              {availableUsers.map((user) => {
                const label = `${user.firstName} ${user.lastName}`;

                return (
                  <CommandItem
                    key={user.id}
                    className="items-start gap-2 py-2"
                    value={`${label} ${user.email}`}
                    disabled={isLoading}
                    onSelect={() => {
                      onChange(user.id);
                      changeOpen(false);
                    }}
                  >
                    <Avatar className="h-7 w-7 ring-1 ring-border/50">
                      <AvatarFallback className="text-[10px]">
                        {user.lastName?.[0]}
                        {user.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium leading-5">
                        {label}
                      </div>
                      <div className="break-all text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>

                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasMore && !error && (
              <div className="p-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading more..." : "Load more members"}
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
