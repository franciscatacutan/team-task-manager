import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canEditUser } from "./userPermissions";
import type { UserProfile } from "../types/userType";
import ProfileHeader from "../components/ProfileHeader";
import ProfilePage from "@/pages/ProfilePage";
import { useUser } from "../hooks/useUser";
import { useTeams } from "@/features/teams/hooks/useTeams";
const { viewer } = vi.hoisted(() => ({
  viewer: {
    id: "viewer",
    firstName: "Viewer",
    lastName: "Person",
    email: "viewer@example.test",
    role: "USER" as const,
  },
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: viewer, isLoading: false }),
}));
vi.mock("../hooks/useUser", () => ({ useUser: vi.fn() }));
vi.mock("@/features/teams/hooks/useTeams", () => ({ useTeams: vi.fn() }));
vi.mock("@/features/teams/components/TeamsList", () => ({
  default: () => <p>Visible team list</p>,
}));
vi.mock("@/common/components/toolbar/ToolBar", () => ({ default: () => null }));
const limited: UserProfile = {
  id: "target",
  firstName: "Teammate",
  lastName: "Person",
  email: "teammate@example.test",
};
function header(user: UserProfile) {
  render(
    <ProfileHeader
      user={user}
      isLoading={false}
      isSelf={false}
      canEditProfile={false}
      teamCount={1}
      editUser={vi.fn()}
      onEditUser={vi.fn()}
    />,
  );
}
function profilePage() {
  return render(
    <MemoryRouter initialEntries={["/users/target"]}>
      <Routes>
        <Route path="/users/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useUser).mockReturnValue({
    data: limited,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useUser>);
  vi.mocked(useTeams).mockReturnValue({
    data: { content: [], totalElements: 0 },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useTeams>);
});
describe("viewer-aware profile UI", () => {
  it("renders teammate names/email without inventing a global role", () => {
    header(limited);
    expect(screen.getByText("Teammate Person")).toBeInTheDocument();
    expect(screen.getByText(limited.email)).toBeInTheDocument();
    expect(screen.queryByText("Global Access")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Profile" }),
    ).not.toBeInTheDocument();
  });
  it("retains disclosed global-role badges", () => {
    header({ ...limited, role: "SUPER_ADMIN" });
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Global Access")).toBeInTheDocument();
  });
  it("never treats a limited teammate profile as editable", () => {
    expect(canEditUser(viewer, limited)).toBe(false);
    expect(canEditUser({ ...viewer, role: "ADMIN" }, limited)).toBe(false);
  });
  it.each([
    ["USER", "USER", false],
    ["ADMIN", "USER", true],
    ["ADMIN", "ADMIN", true],
    ["ADMIN", "SUPER_ADMIN", false],
    ["SUPER_ADMIN", "SUPER_ADMIN", true],
  ] as const)(
    "aligns %s editing %s with the backend",
    (role, targetRole, expected) => {
      expect(
        canEditUser({ ...viewer, role }, { ...limited, role: targetRole }),
      ).toBe(expected);
    },
  );
  it("allows self profile editing", () => {
    expect(canEditUser(viewer, viewer)).toBe(true);
  });
  it("gates the team query and hides stale content when profile access is rejected", () => {
    const refetch = vi.fn();
    vi.mocked(useUser).mockReturnValue({
      data: { ...limited, role: "SUPER_ADMIN" },
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useUser>);
    profilePage();
    expect(screen.getByRole("alert")).toHaveTextContent("Profile unavailable");
    expect(screen.queryByText(limited.email)).not.toBeInTheDocument();
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
    expect(useTeams).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "target" }),
      false,
    );
  });
  it("renders an authorized limited profile without edit controls", () => {
    profilePage();
    expect(screen.getByText(limited.email)).toBeInTheDocument();
    expect(screen.queryByText("Global Access")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Profile" }),
    ).not.toBeInTheDocument();
    expect(useTeams).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "target" }),
      true,
    );
  });
});
