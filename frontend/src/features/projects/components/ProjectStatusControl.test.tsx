import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import ProjectStatusControl from "./ProjectStatusControl";

vi.mock("@/api/apiClients", () => ({ apiClient: { patch: vi.fn() } }));

const patch = vi.mocked(apiClient.patch);
const path = "/teams/TEAM/projects/PROJECT/status";
const scrollIntoView = HTMLElement.prototype.scrollIntoView;

const warning = (openTaskCount: number) => ({
  isAxiosError: true,
  response: {
    status: 409,
    data: {
      type: "urn:ttm:project-completion-confirmation-required",
      openTaskCount,
    },
  },
});

beforeEach(() => {
  patch.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  if (scrollIntoView) HTMLElement.prototype.scrollIntoView = scrollIntoView;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

async function chooseCompleted() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ProjectStatusControl
        teamKey="TEAM"
        projectKey="PROJECT"
        status="ACTIVE"
      />
    </QueryClientProvider>,
  );
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Project status" }), {
    key: "Enter",
  });
  fireEvent.keyDown(await screen.findByRole("option", { name: "Completed" }), {
    key: "Enter",
  });
  return userEvent.setup();
}

it("shows the server count and lets the manager cancel without completing", async () => {
  patch.mockRejectedValueOnce(warning(1));
  const user = await chooseCompleted();
  expect(
    await screen.findByRole("alertdialog", { name: "Complete project?" }),
  ).toHaveTextContent("1 open task.");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(patch).toHaveBeenCalledExactlyOnceWith(path, { status: "COMPLETED" });
  const selector = screen.getByRole("combobox", { name: "Project status" });
  expect(selector).toHaveTextContent("Active");
  await waitFor(() => expect(selector).toHaveFocus());
});

it("asks again with the updated count and keeps a failed confirmation ready for retry", async () => {
  patch
    .mockRejectedValueOnce(warning(1))
    .mockRejectedValueOnce(warning(2))
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValueOnce({ data: { status: "COMPLETED" } });
  const user = await chooseCompleted();
  await user.click(
    await screen.findByRole("button", { name: "Complete project" }),
  );
  expect(patch).toHaveBeenNthCalledWith(2, path, {
    status: "COMPLETED",
    confirmedOpenTaskCount: 1,
  });
  await screen.findByText(/2 open tasks/);
  await user.click(screen.getByRole("button", { name: "Complete project" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  await user.click(screen.getByRole("button", { name: "Complete project" }));
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(patch).toHaveBeenLastCalledWith(path, {
    status: "COMPLETED",
    confirmedOpenTaskCount: 2,
  });
});

it("completes without a dialog when the server finds no open tasks", async () => {
  patch.mockResolvedValueOnce({ data: { status: "COMPLETED" } });
  await chooseCompleted();
  await waitFor(() =>
    expect(patch).toHaveBeenCalledExactlyOnceWith(path, {
      status: "COMPLETED",
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Project status" }),
    ).toBeEnabled(),
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
