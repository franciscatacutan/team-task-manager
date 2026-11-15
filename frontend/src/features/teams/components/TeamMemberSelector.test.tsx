import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamMemberSelector from "./TeamMemberSelector";
import { getTeamMembers } from "../api/teamMemberApi";
import type { TeamMember } from "../types/team.type";
vi.mock("../api/teamMemberApi", () => ({ getTeamMembers: vi.fn() }));
const members = Array.from(
  { length: 21 },
  (_, index) =>
    ({
      id: `user-${index}`,
      firstName: `Person${index}`,
      lastName: "Member",
      email: `person${index}@example.test`,
      teamRole: "MEMBER",
      globalRole: "USER",
      joinedAt: "2026-11-01T00:00:00Z",
    }) as TeamMember,
);
const page = (content: TeamMember[], pageNumber = 0, last = true) => ({
  content,
  page: pageNumber,
  size: 20,
  totalElements: 21,
  totalPages: 2,
  first: pageNumber === 0,
  last,
});
const scroll = HTMLElement.prototype.scrollIntoView;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (scroll) HTMLElement.prototype.scrollIntoView = scroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.mocked(getTeamMembers).mockImplementation(async (_team, params) =>
    page(
      params.search
        ? [members[20]]
        : params.page === 1
          ? [members[20]]
          : members.slice(0, 20),
      params.page,
      Boolean(params.search) || params.page === 1,
    ),
  );
});
function mount(
  props: Partial<React.ComponentProps<typeof TeamMemberSelector>> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamMemberSelector
        teamKey="TEAM"
        placeholder="Select member"
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}
describe("paginated assignment member picker", () => {
  it("loads later pages and selects members beyond the first twenty", async () => {
    const onChange = vi.fn();
    mount({ onChange });
    const user = userEvent.setup();
    expect(getTeamMembers).not.toHaveBeenCalled();
    await user.click(screen.getByRole("combobox", { name: "Select member" }));
    await screen.findByRole("option", { name: /Person0 Member/ });
    expect(
      screen.queryByRole("option", { name: /Person20 Member/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more members" }));
    await user.click(
      await screen.findByRole("option", { name: /Person20 Member/ }),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith("user-20");
    expect(getTeamMembers).toHaveBeenLastCalledWith(
      "TEAM",
      expect.objectContaining({
        page: 1,
        size: 20,
        sort: ["user.lastName,asc", "user.email,asc"],
      }),
      expect.any(AbortSignal),
    );
  });
  it("searches the server and retains the selected label when search results change", async () => {
    function Controlled() {
      const [value, setValue] = useState<string>();
      return (
        <TeamMemberSelector
          teamKey="TEAM"
          placeholder="Select member"
          value={value}
          onChange={(id) => setValue(id ?? undefined)}
        />
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Controlled />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: /Person0 Member/ }),
    );
    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByPlaceholderText("Search user..."),
      "person20@example.test",
    );
    await screen.findByRole("option", { name: /Person20 Member/ });
    expect(
      screen.getByRole("combobox", { name: "Select member" }),
    ).toHaveTextContent("Person0 Member");
    await waitFor(() =>
      expect(getTeamMembers).toHaveBeenLastCalledWith(
        "TEAM",
        expect.objectContaining({ page: 0, search: "person20@example.test" }),
        expect.any(AbortSignal),
      ),
    );
  });
  it("excludes the other role and clears an optional assignment", async () => {
    const onChange = vi.fn();
    mount({
      value: members[20].id,
      selectedUser: members[20],
      excludedUserIds: [members[0].id],
      allowClear: true,
      onChange,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: /Person1 Member/ });
    expect(
      screen.queryByRole("option", { name: /Person0 Member/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "None" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });
  it("shows recoverable load failures", async () => {
    vi.mocked(getTeamMembers).mockRejectedValueOnce(new Error("offline"));
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load team members",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("option", { name: /Person0 Member/ }),
    ).toBeInTheDocument();
  });
  it("does not fetch or open while disabled", async () => {
    mount({ disabled: true });
    await userEvent.click(screen.getByRole("combobox"));
    expect(getTeamMembers).not.toHaveBeenCalled();
    expect(
      screen.queryByPlaceholderText("Search user..."),
    ).not.toBeInTheDocument();
  });
});
