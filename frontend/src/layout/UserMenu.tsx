import { useNavigate } from "react-router";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenu,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { useCurrentUser } from "../features/auth/hooks/useCurrentUser";

interface Props {
  onLogout: () => void;
}

export default function UserMenu({ onLogout }: Props) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2 flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback>
              {user.lastName?.[0]}
              {user.firstName?.[0]}
            </AvatarFallback>
          </Avatar>

          <span className="text-sm hidden md:block">{user.firstName}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* USER INFO */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium">
            {user.lastName}, {user.firstName}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>

        {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
          <DropdownMenuItem onClick={() => navigate("/users")}>
            <Shield className="mr-2 h-4 w-4" />
            Manage users
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
