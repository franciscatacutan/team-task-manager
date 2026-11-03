import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MembersView from "./MembersView";
import { useTeamMe } from "../hooks/useTeamMe";
import { getUserFromToken } from "../../users/api/userApi";

const workspace = vi.hoisted(() => ({
  team: { key: "TEAM-A", deletedAt: null as string | null },
}));
vi.mock("react-router", () => ({
  useParams: () => ({ teamKey: "TEAM-A" }),
  useOutletContext: () => workspace,
}));
vi.mock("../hooks/useTeamMe", () => ({ useTeamMe: vi.fn() }));
vi.mock("../../users/api/userApi", () => ({ getUserFromToken: vi.fn() }));
vi.mock("../hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: { content: [], totalPages: 0, totalElements: 0 },
  }),
}));
vi.mock("./MembersList", () => ({
  default: () => <div>Member directory</div>,
}));
vi.mock("./MembersToolbar", () => ({ default: () => null }));
vi.mock("./AddMembersModal", () => ({ default: () => null }));
vi.mock("./RemoveMultiMemberModal", () => ({ default: () => null }));
vi.mock("./TransferOwnershipModal", () => ({ default: () => null }));

describe("members page global viewing and recovery actions", () => {
  beforeEach(() => {
    workspace.team.deletedAt = null;
  });

  it("shows the member directory to a nonmember global admin without edit actions", () => {
    vi.mocked(getUserFromToken).mockReturnValue({
      role: "ADMIN",
      exp: 9999999999,
      sub: "admin@example.test",
    });
    vi.mocked(useTeamMe).mockReturnValue({
      data: { userId: "admin", role: null },
    } as ReturnType<typeof useTeamMe>);
    render(<MembersView />);
    expect(screen.getByText("Member directory")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Transfer ownership" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add members" }),
    ).not.toBeInTheDocument();
  });

  it("offers ownership recovery to a nonmember super admin without general membership actions", () => {
    vi.mocked(getUserFromToken).mockReturnValue({
      role: "SUPER_ADMIN",
      exp: 9999999999,
      sub: "super@example.test",
    });
    vi.mocked(useTeamMe).mockReturnValue({
      data: { userId: "super", role: null },
    } as ReturnType<typeof useTeamMe>);
    render(<MembersView />);
    expect(screen.getByText("Member directory")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Transfer ownership" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add members" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove members" }),
    ).not.toBeInTheDocument();
  });

  it("shows owner controls to an owner without a global admin role", () => {
    vi.mocked(getUserFromToken).mockReturnValue({
      role: "USER",
      exp: 9999999999,
      sub: "owner@example.test",
    });
    vi.mocked(useTeamMe).mockReturnValue({
      data: { userId: "owner", role: "OWNER" },
    } as ReturnType<typeof useTeamMe>);
    render(<MembersView />);
    expect(
      screen.getByRole("button", { name: "Transfer ownership" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove members" }),
    ).toBeInTheDocument();
  });

  it("does not offer recovery on an archived team", () => {
    workspace.team.deletedAt = "2026-11-03T00:00:00Z";
    vi.mocked(getUserFromToken).mockReturnValue({
      role: "SUPER_ADMIN",
      exp: 9999999999,
      sub: "super@example.test",
    });
    vi.mocked(useTeamMe).mockReturnValue({
      data: { userId: "super", role: null },
    } as ReturnType<typeof useTeamMe>);
    render(<MembersView />);
    expect(screen.getByText("Member directory")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Transfer ownership" }),
    ).not.toBeInTheDocument();
  });
});
