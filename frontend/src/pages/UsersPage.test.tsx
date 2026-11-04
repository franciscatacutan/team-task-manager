import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/common/query/queryKeys";
import type { User } from "@/features/users/types/userType";
import { getUsers } from "@/features/users/api/userApi";
import UsersPage from "./UsersPage";
const admin: User = {
  id: "admin",
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
};
vi.mock("@/features/auth/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    data: {
      id: "admin",
      firstName: "Admin",
      lastName: "User",
      role: "SUPER_ADMIN",
    },
  }),
}));
vi.mock("@/features/users/api/userApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/users/api/userApi")>()),
  getUsers: vi.fn(),
}));
let client: QueryClient, records: User[];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  records = [
    admin,
    ...Array.from({ length: 22 }, (_, i) => ({
      ...admin,
      id: `user-${i}`,
      firstName: i < 2 ? "Ada" : `Person${i}`,
      email: `user${i}@example.test`,
      role: "USER" as const,
    })),
  ];
  vi.mocked(getUsers)
    .mockReset()
    .mockImplementation(async ({ page = 0, size = 10, search = "", roles }) => {
      const matching = records.filter(
        (user) =>
          `${user.firstName} ${user.email}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!roles?.length || roles.includes(user.role)),
      );
      return {
        content: matching.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: matching.length,
        totalPages: Math.ceil(matching.length / size),
        last: (page + 1) * size >= matching.length,
      };
    });
});
afterEach(() => client.clear());
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
describe("directory paging and count scope", () => {
  it("searches from page zero after a later page and displays matching users", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByText("Showing 1–10 of 23");
    await user.click(screen.getByRole("button", { name: "2" }));
    await screen.findByText("Showing 11–20 of 23");
    await user.type(
      screen.getByRole("textbox", { name: "Search users" }),
      "Ada",
    );
    await waitFor(() =>
      expect(getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, search: "Ada" }),
      ),
    );
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    expect(screen.queryByText("No matching users")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search teams..."),
    ).not.toBeInTheDocument();
  });
  it("labels all three statistics as the displayed page rather than directory totals", async () => {
    mount();
    await screen.findByText("Showing 1–10 of 23");
    for (const label of [
      "Users on this page",
      "Global admins on this page",
      "Super admins on this page",
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("Total users")).not.toBeInTheDocument();
    expect(
      screen.getByText("Users on this page").parentElement?.parentElement,
    ).toHaveTextContent("10");
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await screen.findByText("Showing 21–23 of 23");
    expect(
      screen.getByText("Users on this page").parentElement?.parentElement,
    ).toHaveTextContent("3");
  });
  it("recovers a confirmed page that disappears after a refresh", async () => {
    mount();
    await screen.findByText("Showing 1–10 of 23");
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await screen.findByText("Showing 21–23 of 23");
    records = records.slice(0, 11);
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.users.lists });
    });
    await screen.findByText("Showing 11–11 of 11");
    expect(getUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    expect(screen.queryByText("No matching users")).not.toBeInTheDocument();
  });
  it("keeps a genuine empty search at page zero without a recovery loop", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByText("Showing 1–10 of 23");
    await user.type(
      screen.getByRole("textbox", { name: "Search users" }),
      "no-such-person",
    );
    await screen.findByText("No matching users");
    const calls = vi
      .mocked(getUsers)
      .mock.calls.filter(([params]) => params.search === "no-such-person");
    expect(calls).toHaveLength(1);
    expect(calls[0][0].page).toBe(0);
    expect(
      screen.getByText("Users on this page").parentElement?.parentElement,
    ).toHaveTextContent("0");
  });
});
