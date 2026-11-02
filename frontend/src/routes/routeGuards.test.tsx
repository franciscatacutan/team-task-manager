import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "../features/auth/hooks/useAuth";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

vi.mock("../features/auth/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function authState(isAuthenticated: boolean, isBootstrapping = false) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated,
    isBootstrapping,
    user: undefined,
    isGlobalAdmin: false,
    logout: vi.fn(),
    isLoading: false,
  });
}

function TaskDestination() {
  const { teamKey, projectKey, taskNumber } = useParams();
  return (
    <h1>
      {teamKey}/{projectKey}/{taskNumber}
    </h1>
  );
}

function renderRoutes(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <h1>Login page</h1>
            </PublicRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <h1>Teams page</h1>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:teamKey/projects/:projectKey/tasks/:taskNumber"
          element={
            <ProtectedRoute>
              <TaskDestination />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route guards after the React Router upgrade", () => {
  it("redirects anonymous task links to login", async () => {
    authState(false);
    renderRoutes("/teams/TEAM-A/projects/PROJ-A/tasks/7");
    expect(
      await screen.findByRole("heading", { name: "Login page" }),
    ).toBeInTheDocument();
  });

  it("keeps team keys, project keys and task numbers in authenticated task URLs", () => {
    authState(true);
    renderRoutes("/teams/TEAM-A/projects/PROJ-A/tasks/7");
    expect(
      screen.getByRole("heading", { name: "TEAM-A/PROJ-A/7" }),
    ).toBeInTheDocument();
  });

  it("redirects authenticated users away from login", async () => {
    authState(true);
    renderRoutes("/login");
    expect(
      await screen.findByRole("heading", { name: "Teams page" }),
    ).toBeInTheDocument();
  });

  it.each(["/login", "/teams"])("waits for session bootstrap at %s", (path) => {
    authState(false, true);
    renderRoutes(path);
    expect(screen.getByText("Checking session...")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
