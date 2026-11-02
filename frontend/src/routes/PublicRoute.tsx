import { Navigate } from "react-router";
import type { JSX } from "react/jsx-dev-runtime";
import { useAuth } from "../features/auth/hooks/useAuth";

type Props = {
  children: JSX.Element;
};

/*
 * PublicRoute component to restrict access to routes for authenticated users
 */
export default function PublicRoute({ children }: Props) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/teams" replace />;
  }

  return children;
}
