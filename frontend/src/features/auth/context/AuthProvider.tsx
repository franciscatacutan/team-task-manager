import { AuthSessionChangedError } from "@/api/apiClients";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "../utils/authNavigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutInProgress = useRef(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const data = await refresh();
        if (
          !isMounted ||
          authStorage.isLoggingOut() ||
          authStorage.getToken() !== data.token
        ) {
          return;
        }
        queryClient.setQueryData(["me"], {
          id: data.user.userId,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          email: data.user.email,
          role: data.user.role,
        });
      } catch (error) {
        if (!isMounted || error instanceof AuthSessionChangedError) {
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
        redirectToLogin();
      }
    });

    void bootstrap();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [queryClient]);

  const logout = async () => {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    authStorage.beginLogout();
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logoutRequest();
      authStorage.clearToken();
      queryClient.clear();
      redirectToLogin();
    } catch {
      setLogoutError(
        "Could not confirm sign out. Check your connection and try again.",
      );
    } finally {
      authStorage.endLogout();
      logoutInProgress.current = false;
      setIsLoggingOut(false);
    }
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
        isLoggingOut,
        isLoading,
      }}
    >
      {children}
      {logoutError && (
        <div
          role="alert"
          className="fixed right-4 top-4 z-100 max-w-md rounded-xl border border-destructive bg-background p-4 shadow-lg"
        >
          <p>{logoutError}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void logout()} disabled={isLoggingOut}>
              Retry sign out
            </Button>
            <Button variant="outline" onClick={() => setLogoutError("")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
