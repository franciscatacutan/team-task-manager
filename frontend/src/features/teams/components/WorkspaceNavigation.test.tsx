import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamSidebar from "./TeamSidebar";
import type { Team } from "../types/team.type";
const state = vi.hoisted(() => ({
  mobile: true,
  role: "USER",
  teamRole: "OWNER",
  listeners: new Set<() => void>(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: state.role } }),
}));
vi.mock("../hooks/useTeamMe", () => ({
  useTeamMe: () => ({ data: { role: state.teamRole, userId: "owner" } }),
}));
vi.mock("../hooks/useAllTeams", () => ({
  useAllTeams: () => ({
    data: {
      content: [
        { key: "TEAM", name: "Customer delivery" },
        { key: "OTHER", name: "Platform operations" },
      ],
    },
  }),
}));
const team = { key: "TEAM", name: "Customer delivery" } as Team;
function Location() {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}
function mount() {
  return render(
    <MemoryRouter initialEntries={["/teams/TEAM"]}>
      <TeamSidebar teamKey="TEAM" team={team} />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.mobile = true;
  state.role = "USER";
  state.teamRole = "OWNER";
  state.listeners.clear();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return state.mobile;
    },
    addEventListener: (_type: string, listener: () => void) =>
      state.listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      state.listeners.delete(listener),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());
const resize = (mobile: boolean) =>
  act(() => {
    state.mobile = mobile;
    state.listeners.forEach((listener) => listener());
  });
describe("workspace drawer and sidebar", () => {
  it("exposes mobile navigation in a named modal, traps focus and restores it after Escape", async () => {
    mount();
    const user = userEvent.setup(),
      trigger = screen.getByRole("button", {
        name: "Open workspace navigation",
      });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog).toHaveAccessibleDescription("Customer delivery");
    for (let i = 0; i < 9; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
  it("closes after a navigation link and does not reopen on browser Back", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Open workspace navigation" }),
    );
    await user.click(screen.getByRole("link", { name: "Projects" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/teams/TEAM/projects",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps desktop collapse separate from mobile state and names every collapsed link", async () => {
    state.mobile = false;
    mount();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Collapse workspace sidebar" }),
    );
    for (const label of [
      "Overview",
      "Projects",
      "Members",
      "Activity",
      "Insights",
    ])
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    resize(true);
    await user.click(
      screen.getByRole("button", { name: "Open workspace navigation" }),
    );
    resize(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand workspace sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    resize(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("switches teams and searches their names, not only their keys", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Open workspace navigation" }),
    );
    await user.click(screen.getByRole("combobox", { name: /Switch team/ }));
    await user.type(
      screen.getByRole("combobox", { name: "Search teams" }),
      "Platform",
    );
    await user.click(
      await screen.findByRole("option", { name: /Platform operations/ }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/teams/OTHER");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each([
    ["USER", "MEMBER", false, false],
    ["USER", "OWNER", false, true],
    ["ADMIN", null, true, true],
    ["SUPER_ADMIN", null, true, true],
  ] as const)(
    "preserves %s/%s visibility",
    async (role, teamRole, canCreate, canSeeInsights) => {
      state.role = role;
      state.teamRole = teamRole as string;
      mount();
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: "Open workspace navigation" }),
      );
      expect(Boolean(screen.queryByRole("link", { name: "Insights" }))).toBe(
        canSeeInsights,
      );
      await user.click(screen.getByRole("combobox", { name: /Switch team/ }));
      expect(
        Boolean(screen.queryByRole("button", { name: "Create team" })),
      ).toBe(canCreate);
    },
  );
  it("lets Close dismiss the mobile drawer", async () => {
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Open workspace navigation" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
