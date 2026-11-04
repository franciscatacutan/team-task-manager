import type { PropsWithChildren } from "react";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCenter from "./NotificationCenter";
import * as api from "../api/notificationApi";
import { useNotifications } from "../hooks/useNotifications";
import { useMarkAllNotificationsRead } from "../hooks/useMarkAllNotificationsRead";
import { useMarkNotificationRead } from "../hooks/useMarkNotificationRead";
import { queryKeys } from "@/common/query/queryKeys";
import { authStorage } from "@/features/auth/utils/authStorage";
import { browserSession } from "@/features/auth/utils/sessionCoordinator";
import type {
  AppNotification,
  NotificationInboxParams,
} from "../types/notification.types";

vi.mock("../api/notificationApi", () => ({
  getNotifications: vi.fn(),
  getNotificationDestination: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
let rows: AppNotification[];
const clients: QueryClient[] = [];
const notification = (id: number, read = false): AppNotification => ({
  id: String(id),
  title: `Notice ${id}`,
  body: `Body ${id}`,
  type: "TEAM",
  targetPath: `/destination/${id}`,
  actor: null,
  read,
  readAt: read ? "2026-11-04T00:00:00Z" : null,
  createdAt: "2026-11-04T00:00:00Z",
});
function page(params: NotificationInboxParams) {
  const matches = params.unreadOnly ? rows.filter((row) => !row.read) : rows;
  return {
    content: matches.slice(
      params.page * params.size,
      (params.page + 1) * params.size,
    ),
    page: params.page,
    size: params.size,
    totalElements: matches.length,
    totalPages: Math.ceil(matches.length / params.size),
    last: (params.page + 1) * params.size >= matches.length,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function client() {
  const value = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(value);
  return value;
}
function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}
function setup() {
  const cache = client();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/teams"]}>
        <NotificationCenter />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { cache, user: userEvent.setup() };
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /notifications/i }));
}
const serverError = {
  isAxiosError: true,
  response: { status: 503, data: { message: "Please try again shortly" } },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getNotificationDestination).mockImplementation(async (id) => ({
    available: true,
    targetPath: `/destination/${id}`,
  }));
  localStorage.clear();
  browserSession.sync();
  authStorage.endLogout();
  authStorage.setToken("current");
  rows = Array.from({ length: 15 }, (_, id) => notification(id, id < 12));
  vi.mocked(api.getNotifications).mockImplementation(async (params) =>
    page(params),
  );
  vi.mocked(api.getUnreadNotificationCount).mockImplementation(async () => ({
    unreadCount: rows.filter((row) => !row.read).length,
  }));
  vi.mocked(api.markNotificationRead).mockImplementation(async (id) => {
    const index = rows.findIndex((row) => row.id === id);
    rows[index] = {
      ...rows[index],
      read: true,
      readAt: "2026-11-04T01:00:00Z",
    };
    return rows[index];
  });
  vi.mocked(api.markAllNotificationsRead).mockImplementation(async () => {
    rows = rows.map((row) => ({ ...row, read: true }));
    return { unreadCount: 0 };
  });
});
afterEach(() => {
  clients.forEach((cache) => cache.clear());
  clients.length = 0;
  authStorage.clearToken();
});

describe("notification inbox", () => {
  it("loads pages on demand and server-filters unread notifications beyond the latest twelve", async () => {
    const { user } = setup();
    await screen.findByRole("button", { name: "3 unread notifications" });
    expect(api.getNotifications).not.toHaveBeenCalled();
    await open(user);
    expect(await screen.findByText("Notice 0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "15 notifications · Page 1 of 2",
    );
    await user.click(
      screen.getByRole("button", { name: "Next notifications" }),
    );
    expect(await screen.findByText("Notice 12")).toBeInTheDocument();
    expect(screen.queryByText("Notice 0")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 2");
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "3 unread notifications · Page 1 of 1",
      ),
    );
    expect(screen.getByText("Notice 14")).toBeInTheDocument();
    expect(api.getNotifications).toHaveBeenCalledWith(
      { page: 0, size: 12, sort: "createdAt,desc", unreadOnly: true },
      expect.any(AbortSignal),
    );
  });
  it("keeps all/unread page caches separate and never borrows old-filter placeholder rows", async () => {
    const cache = client();
    const gate = deferred<ReturnType<typeof page>>();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    );
    const query = renderHook(
      ({ unreadOnly }) => useNotifications({ unreadOnly }),
      { initialProps: { unreadOnly: false }, wrapper },
    );
    await waitFor(() =>
      expect(query.result.current.data?.totalElements).toBe(15),
    );
    vi.mocked(api.getNotifications).mockReturnValueOnce(gate.promise);
    query.rerender({ unreadOnly: true });
    expect(query.result.current.data).toBeUndefined();
    expect(query.result.current.isPending).toBe(true);
    await act(async () =>
      gate.resolve(
        page({ page: 0, size: 12, sort: "createdAt,desc", unreadOnly: true }),
      ),
    );
    await waitFor(() =>
      expect(query.result.current.data?.totalElements).toBe(3),
    );
  });
  it("shows list failure and retries instead of claiming an empty inbox", async () => {
    vi.mocked(api.getNotifications).mockRejectedValueOnce(serverError);
    const { user } = setup();
    await open(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load notifications",
    );
    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Notice 0")).toBeInTheDocument();
  });
  it("does not report caught-up while the count is loading or failed and supports count retry", async () => {
    const gate = deferred<{ unreadCount: number }>();
    vi.mocked(api.getUnreadNotificationCount).mockReturnValueOnce(gate.promise);
    const { user } = setup();
    await open(user);
    expect(screen.getByText("Checking unread updates...")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).not.toBeInTheDocument();
    vi.mocked(api.getUnreadNotificationCount).mockRejectedValueOnce(
      serverError,
    );
    await act(async () => gate.resolve({ unreadCount: 3 }));
    await screen.findByText("3 unread updates");
    // Explicitly request a failed refresh so cached counts cannot masquerade as a confirmed zero.
    const cache = clients[0];
    await act(async () => {
      await cache.refetchQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });
    });
    expect(
      await screen.findByText("Unread count unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read all" })).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Retry unread count" }),
    );
    expect(await screen.findByText("3 unread updates")).toBeInTheDocument();
  });
  it("keeps a rejected mark-read visible, retries, refreshes counts and navigates only after success", async () => {
    vi.mocked(api.markNotificationRead).mockRejectedValueOnce(serverError);
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await user.click(await screen.findByRole("button", { name: /Notice 12/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again shortly",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/teams");
    await user.click(screen.getByRole("button", { name: /Notice 12/ }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/destination/12",
      ),
    );
    expect(
      await screen.findByRole("button", { name: "2 unread notifications" }),
    ).toBeInTheDocument();
    expect(api.markNotificationRead).toHaveBeenCalledTimes(2);
  });
  it("does not write again when opening an already-read notification", async () => {
    const { user } = setup();
    await open(user);
    await user.click(await screen.findByRole("button", { name: /Notice 0/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/destination/0");
    expect(api.markNotificationRead).not.toHaveBeenCalled();
  });
  it("blocks duplicate read operations, filters and dismissal while a read is pending", async () => {
    const gate = deferred<AppNotification>();
    vi.mocked(api.markNotificationRead).mockReturnValueOnce(gate.promise);
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    const item = await screen.findByRole("button", { name: /Notice 12/ });
    await user.dblClick(item);
    expect(api.markNotificationRead).toHaveBeenCalledOnce();
    expect(item).toBeDisabled();
    expect(screen.getByRole("button", { name: "Read all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "All" })).toBeDisabled();
    await user.keyboard("[Escape]");
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    await act(async () => gate.resolve({ ...rows[12], read: true }));
  });
  it("shows Read all failures and refreshes every page plus the badge after a confirmed retry", async () => {
    vi.mocked(api.markAllNotificationsRead).mockRejectedValueOnce(serverError);
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await user.click(screen.getByRole("button", { name: "Read all" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again shortly",
    );
    expect(screen.getByText("Notice 12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Read all" }));
    expect(
      await screen.findByText("No unread notifications"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "0 unread notifications",
    );
    expect(screen.getByText("You are all caught up")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(await screen.findByText("Notice 0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("15 notifications");
  });
  it("returns to an existing page when Read all empties a later unread page", async () => {
    rows = Array.from({ length: 13 }, (_, id) => notification(id));
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await screen.findByText("Notice 0");
    await user.click(
      screen.getByRole("button", { name: "Next notifications" }),
    );
    await screen.findByText("Notice 12");
    await user.click(screen.getByRole("button", { name: "Read all" }));
    expect(
      await screen.findByText("No unread notifications"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.getNotifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0, unreadOnly: true }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText(/Page 2/)).not.toBeInTheDocument();
  });
  it("recovers a later page when polling discovers that another tab read its last item", async () => {
    rows = Array.from({ length: 13 }, (_, id) => notification(id));
    const { user, cache } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await screen.findByText("Notice 0");
    await user.click(
      screen.getByRole("button", { name: "Next notifications" }),
    );
    await screen.findByText("Notice 12");
    rows = rows.map((row, i) => ({ ...row, read: i === 12 }));
    await act(async () => {
      await cache.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });
    expect(await screen.findByText("Notice 0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "12 unread notifications · Page 1 of 1",
    );
  });
  it("never navigates an old read result after the account changes", async () => {
    const gate = deferred<AppNotification>();
    vi.mocked(api.markNotificationRead).mockReturnValueOnce(gate.promise);
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Unread" }));
    await user.click(await screen.findByRole("button", { name: /Notice 12/ }));
    authStorage.setToken("another-account");
    await act(async () => gate.resolve({ ...rows[12], read: true }));
    expect(screen.getByTestId("location")).toHaveTextContent("/teams");
  });
  it("invalidates inactive inbox pages after marking one read", async () => {
    const cache = client();
    const params = {
      page: 1,
      size: 12,
      sort: "createdAt,desc",
      unreadOnly: true,
    };
    cache.setQueryData(queryKeys.notifications.inboxPage(params), page(params));
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    );
    const mutation = renderHook(() => useMarkNotificationRead(), { wrapper });
    await act(async () => {
      await mutation.result.current.mutateAsync("12");
    });
    expect(
      cache.getQueryState(queryKeys.notifications.inboxPage(params))
        ?.isInvalidated,
    ).toBe(true);
  });
  it("uses the confirmed Read all count and cannot overwrite it with an older in-flight read", async () => {
    const cache = client();
    const gate = deferred<{ unreadCount: number }>();
    cache.setQueryData(queryKeys.notifications.unreadCount, { unreadCount: 9 });
    const old = cache
      .fetchQuery({
        queryKey: queryKeys.notifications.unreadCount,
        queryFn: () => gate.promise,
      })
      .catch(() => undefined);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    );
    vi.mocked(api.markAllNotificationsRead).mockResolvedValueOnce({
      unreadCount: 2,
    });
    const mutation = renderHook(() => useMarkAllNotificationsRead(), {
      wrapper,
    });
    await act(async () => {
      await mutation.result.current.mutateAsync();
    });
    gate.resolve({ unreadCount: 9 });
    await old;
    expect(cache.getQueryData(queryKeys.notifications.unreadCount)).toEqual({
      unreadCount: 2,
    });
  });
});

it("reports an uncertain mark-read response without navigating or automatically replaying it", async () => {
  vi.mocked(api.markNotificationRead).mockRejectedValueOnce({
    isAxiosError: true,
    code: "ERR_NETWORK",
  });
  const { user } = setup();
  await open(user);
  await user.click(screen.getByRole("button", { name: "Unread" }));
  await user.click(await screen.findByRole("button", { name: /Notice 12/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not confirm the change. Refresh the data before retrying.",
  );
  expect(api.markNotificationRead).toHaveBeenCalledOnce();
  expect(screen.getByTestId("location")).toHaveTextContent("/teams");
});

it("does not install a previous account's Read all result or invalidate its replacement cache", async () => {
  const cache = client();
  const gate = deferred<{ unreadCount: number }>();
  vi.mocked(api.markAllNotificationsRead).mockReturnValueOnce(gate.promise);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  const mutation = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = mutation.result.current.mutateAsync();
  });
  await waitFor(() =>
    expect(api.markAllNotificationsRead).toHaveBeenCalledOnce(),
  );
  authStorage.setToken("new-account");
  cache.clear();
  cache.setQueryData(queryKeys.notifications.unreadCount, { unreadCount: 7 });
  await act(async () => {
    gate.resolve({ unreadCount: 0 });
    await pending;
  });
  expect(cache.getQueryData(queryKeys.notifications.unreadCount)).toEqual({
    unreadCount: 7,
  });
  expect(
    cache.getQueryState(queryKeys.notifications.unreadCount)?.isInvalidated,
  ).toBe(false);
});

it("retains and reads an unavailable notification without leaving the inbox", async () => {
  rows = [notification(1)];
  vi.mocked(api.getNotificationDestination).mockResolvedValue({
    available: false,
    targetPath: null,
  });
  const { user } = setup();
  await open(user);
  await user.click(screen.getByRole("button", { name: "Unread" }));
  await user.click(await screen.findByRole("button", { name: /Notice 1/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Destination unavailable",
  );
  expect(screen.getByTestId("location")).toHaveTextContent("/teams");
  expect(screen.getByText("No unread notifications")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "All" }));
  expect(await screen.findByText("Notice 1")).toBeInTheDocument();
  expect(rows[0].read).toBe(true);
  await user.click(screen.getByRole("button", { name: /Notice 1/ }));
  await screen.findByText(/Destination unavailable/);
  expect(api.markNotificationRead).toHaveBeenCalledOnce();
  expect(api.getNotificationDestination).toHaveBeenCalledTimes(2);
});
it("allows retrying a destination lookup failure without repeating a confirmed read", async () => {
  rows = [notification(1)];
  vi.mocked(api.getNotificationDestination).mockRejectedValueOnce(serverError);
  const { user } = setup();
  await open(user);
  await user.click(await screen.findByRole("button", { name: /Notice 1/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not check the destination",
  );
  expect(screen.getByTestId("location")).toHaveTextContent("/teams");
  await user.click(screen.getByRole("button", { name: /Notice 1/ }));
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent("/destination/1"),
  );
  expect(api.markNotificationRead).toHaveBeenCalledOnce();
});
it("guards pending destination lookups and ignores an old-account destination response", async () => {
  rows = [notification(1, true)];
  const gate = deferred<{ available: boolean; targetPath: string }>();
  vi.mocked(api.getNotificationDestination).mockReturnValueOnce(gate.promise);
  const { user } = setup();
  await open(user);
  const item = await screen.findByRole("button", { name: /Notice 1/ });
  await user.click(item);
  expect(item).toBeDisabled();
  await user.keyboard("[Escape]");
  expect(screen.getByText("Notifications")).toBeInTheDocument();
  authStorage.setToken("new-account");
  await act(async () =>
    gate.resolve({ available: true, targetPath: "/destination/old" }),
  );
  expect(screen.getByTestId("location")).toHaveTextContent("/teams");
});
it("uses a fresh destination instead of an old stored route", async () => {
  rows = [
    { ...notification(1, true), targetPath: "https://example.test/old-path" },
  ];
  vi.mocked(api.getNotificationDestination).mockResolvedValueOnce({
    available: true,
    targetPath: "/teams/RENAMED",
  });
  const { user } = setup();
  await open(user);
  await user.click(await screen.findByRole("button", { name: /Notice 1/ }));
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent("/teams/RENAMED"),
  );
  expect(api.markNotificationRead).not.toHaveBeenCalled();
});
