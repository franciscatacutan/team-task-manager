import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NullableTeamRole } from "../types/team.type";
import type { UserRole } from "@/features/users/types/userRole";
import TeamInsightsAccess from "./TeamInsightsAccess";

const state = vi.hoisted(() => ({
  globalRole: "USER" as UserRole,
  teamRole: "MEMBER" as NullableTeamRole,
  loading: false,
  failure: false,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: state.globalRole } }),
}));
vi.mock("../hooks/useTeamMe", () => ({
  useTeamMe: () => ({
    data: { role: state.teamRole },
    isPending: state.loading,
    isError: state.failure,
    refetch: vi.fn(),
  }),
}));

function open(path: "insights" | "insights/overdue") {
  return render(
    <MemoryRouter initialEntries={[`/teams/TEAM/${path}`]}>
      <Routes>
        <Route path="/teams/:teamKey" element={<TeamInsightsAccess />}>
          <Route path="insights" element={<h1>Team metrics</h1>} />
          <Route path="insights/overdue" element={<h1>Overdue tasks</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Team Insights routes", () => {
  beforeEach(() => {
    state.globalRole = "USER";
    state.teamRole = "MEMBER";
    state.failure = false;
    state.loading = false;
  });

  it.each(["insights", "insights/overdue"] as const)(
    "denies a regular member directly opening %s without mounting its content",
    (path) => {
      open(path);
      expect(
        screen.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Back to team overview" }),
      ).toHaveAttribute("href", "/teams/TEAM");
      expect(
        screen.queryByRole("heading", { name: /Team metrics|Overdue tasks/ }),
      ).toBeNull();
    },
  );

  it.each(["OWNER", "ADMIN"] as const)("allows an in-team %s", (role) => {
    state.teamRole = role;
    open("insights/overdue");
    expect(
      screen.getByRole("heading", { name: "Overdue tasks" }),
    ).toBeVisible();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "allows a global %s without a team membership",
    (role) => {
      state.globalRole = role;
      state.teamRole = null;
      open("insights");
      expect(
        screen.getByRole("heading", { name: "Team metrics" }),
      ).toBeVisible();
    },
  );

  it("waits for membership and suppresses stale management access on failure", () => {
    state.teamRole = null;
    state.loading = true;
    const pending = open("insights");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking Insights access",
    );
    expect(screen.queryByRole("heading", { name: "Team metrics" })).toBeNull();
    pending.unmount();
    state.loading = false;
    state.failure = true;
    state.teamRole = "ADMIN";
    open("insights");
    expect(screen.getByRole("alert")).toHaveTextContent("Insights access");
    expect(screen.queryByRole("heading", { name: "Team metrics" })).toBeNull();
  });
});
