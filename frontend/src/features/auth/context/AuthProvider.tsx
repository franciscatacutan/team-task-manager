import { type ReactNode, useEffect, useState } from "react";
import { authStorage } from "../utils/authStorage";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "./AuthContext";
import { refresh, logout as logoutRequest } from "../api/auth.api";
import { useCurrentUser } from "../hooks/useCurrentUser";

type Props = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: Props) => {
  const queryClient = useQueryClient();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const data = await refresh();
        if (!isMounted) {
          return;
        }

        authStorage.setToken(data.token);
        queryClient.setQueryData(["me"], {
          id: data.user.userId,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          email: data.user.email,
          role: data.user.role,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        authStorage.clearToken();
        queryClient.removeQueries({ queryKey: ["me"] });
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    const unsubscribe = authStorage.subscribeUnauthorized(() => {
      authStorage.clearToken();
      queryClient.clear();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    });

    void bootstrap();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [queryClient]);

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore logout transport failures and clear local auth state anyway.
    }
    authStorage.clearToken();
    queryClient.clear();
    window.location.href = "/login";
  };

  const isGlobalAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const isAuthenticated = !!user && authStorage.hasToken();
  const isLoading = isBootstrapping || isUserLoading;

  return (
    <AuthContext.Provider
      value={{
        user,
        isGlobalAdmin,
        isAuthenticated,
        isBootstrapping,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
