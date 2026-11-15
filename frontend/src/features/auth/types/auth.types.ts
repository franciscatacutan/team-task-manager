import type { User } from "../../users/types/userType";

export type AuthResponse = {
  token: string;
  expiresInSeconds: number;
  user: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: User["role"];
  };
};

export type AuthContextType = {
  user: User | undefined;
  isGlobalAdmin: boolean;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  isLoading: boolean;
};
