import type { JSX } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../features/auth/hooks/useAuth";

type Props = {
  children: JSX.Element;
};

/*
 * ProtectedRoute component to guard routes that require authentication
 */
export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  /*
   * If there is no authenticated in-memory session, redirect to the login page
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
