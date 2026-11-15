import { queryKeys } from "@/common/query/queryKeys";
import {
  AuthSessionChangedError,
  browserSession,
  SignedOutError,
  SessionCoordinationError,
} from "../utils/sessionCoordinator";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "../utils/authNavigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { authStorage } from "../utils/authStorage";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AuthContext } from "./AuthContext";
import { refresh, logout as logoutRequest } from "../api/auth.api";
import { useCurrentUser } from "../hooks/useCurrentUser";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const client = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [retry, setRetry] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const logoutInProgress = useRef(false);
  const foreignChanges = useRef(0);
  const redirected = useRef(false);
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const redirect = useCallback(() => {
    if (!redirected.current && window.location.pathname !== "/login") {
      redirected.current = true;
      redirectToLogin();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    const clear = () => {
      void client.cancelQueries();
      client.clear();
    };
    async function bootstrap() {
      const current = ++generation;
      setIsBootstrapping(true);
      setSessionError("");
      try {
        const data = await refresh();
        if (
          !mounted ||
          current !== generation ||
          authStorage.isLoggingOut() ||
          authStorage.getToken() !== data.token
        )
          return;
        client.setQueryData(queryKeys.session.current, {
          id: data.user.userId,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          email: data.user.email,
          role: data.user.role,
        });
        redirected.current = false;
      } catch (error) {
        if (
          !mounted ||
          current !== generation ||
          error instanceof AuthSessionChangedError
        )
          return;
        if (
          error instanceof SignedOutError ||
          (isAxiosError(error) && error.response?.status === 401)
        ) {
          authStorage.clearToken();
          clear();
        } else
          setSessionError(
            error instanceof SessionCoordinationError
              ? error.message
              : "Could not check your session. Check your connection and try again.",
          );
      } finally {
        if (mounted && current === generation) setIsBootstrapping(false);
      }
    }
    const unsubscribeSession = browserSession.subscribe((event) => {
      if (!mounted) return;
      ++generation;
      if (event.type === "ready") {
        redirected.current = false;
        setSessionError("");
        setIsBootstrapping(false);
        return;
      }
      if (event.type === "unavailable") {
        authStorage.clearToken();
        clear();
        setIsBootstrapping(false);
        setSessionError(
          "Session coordination is unavailable. Use an up-to-date browser with site storage enabled.",
        );
        return;
      }
      if (event.remote) foreignChanges.current++;
      clear();
      setSessionError("");
      if (event.type === "signed-out") {
        setIsBootstrapping(false);
        redirect();
      } else {
        setIsBootstrapping(true);
        if (event.remote && !authStorage.isLoggingOut()) void bootstrap();
      }
    });
    const unsubscribeUnauthorized = authStorage.subscribeUnauthorized(() => {
      ++generation;
      authStorage.clearToken();
      clear();
      setIsBootstrapping(false);
      redirect();
    });
    void bootstrap();
    return () => {
      mounted = false;
      ++generation;
      unsubscribeSession();
      unsubscribeUnauthorized();
    };
  }, [client, retry, redirect]);

  const logout = async () => {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    const foreign = foreignChanges.current;
    let needsSync = false;
    authStorage.beginLogout();
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logoutRequest();
      if (foreign !== foreignChanges.current) return;
      authStorage.clearToken();
      void client.cancelQueries();
      client.clear();
      redirect();
    } catch (error) {
      if (error instanceof AuthSessionChangedError) needsSync = true;
      if (
        !(error instanceof AuthSessionChangedError) &&
        foreign === foreignChanges.current
      )
        setLogoutError(
          "Could not confirm sign out. Check your connection and try again.",
        );
    } finally {
      authStorage.endLogout();
      logoutInProgress.current = false;
      setIsLoggingOut(false);
      if (needsSync || foreign !== foreignChanges.current)
        setRetry((value) => value + 1);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isGlobalAdmin: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
        isAuthenticated: !!user && authStorage.hasToken(),
        isBootstrapping,
        logout,
        isLoggingOut,
        isLoading: isBootstrapping || isUserLoading,
      }}
    >
      {sessionError ? (
        <div
          role="alert"
          className="mx-auto mt-16 max-w-lg space-y-4 rounded-xl border bg-background p-6"
        >
          <h1 className="font-semibold">Session could not be checked</h1>
          <p>{sessionError}</p>
          <Button onClick={() => setRetry((value) => value + 1)}>
            Retry session
          </Button>
        </div>
      ) : (
        children
      )}
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
