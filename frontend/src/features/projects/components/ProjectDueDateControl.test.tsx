import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authStorage } from "@/features/auth/utils/authStorage";
import { updateProject } from "../api/projectApi";
import ProjectDueDateControl from "./ProjectDueDateControl";
import type { Project } from "../types/project.types";

vi.mock("../api/projectApi", () => ({ updateProject: vi.fn() }));
vi.mock("@/common/components/DatePicker", () => ({
  default: ({
    value,
    onChange,
    id,
    triggerDisabled,
  }: {
    value?: Date;
    onChange: (value?: Date) => void;
    id: string;
    triggerDisabled: boolean;
  }) => (
    <input
      type="date"
      id={id}
      disabled={triggerDisabled}
      value={value ? format(value, "yyyy-MM-dd") : ""}
      onChange={(event) =>
        onChange(event.target.value ? parseISO(event.target.value) : undefined)
      }
    />
  ),
}));
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient();
  vi.mocked(updateProject).mockReset();
  authStorage.endLogout();
  authStorage.setToken("current");
});
afterEach(() => client.clear());

const button = (name: string) => screen.getByRole("button", { name });
function mount(currentDay: string | null, startDay?: string) {
  render(
    <QueryClientProvider client={client}>
      <ProjectDueDateControl
        teamKey="TEAM"
        projectKey="PROJECT"
        currentDay={currentDay}
        startDay={startDay}
      />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("project due date editor", () => {
  it("sets a calendar day and rejects a draft before the planned start", async () => {
    vi.mocked(updateProject).mockResolvedValue({ key: "PROJECT" } as Project);
    const user = mount(null, "2026-11-06");
    await user.click(button("Set due date"));
    const date = screen.getByLabelText("Due date", { exact: true });
    expect(button("Save due date")).toBeDisabled();
    fireEvent.change(date, { target: { value: "2026-11-05" } });
    expect(button("Save due date")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("on or after");
    fireEvent.change(date, { target: { value: "2026-11-06" } });
    await user.click(button("Save due date"));
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledExactlyOnceWith("TEAM", "PROJECT", {
        plannedDueDate: "2026-11-06",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps a clear draft after failure and submits an explicit null on retry", async () => {
    let reject!: (reason: unknown) => void;
    vi.mocked(updateProject)
      .mockReturnValueOnce(
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
      )
      .mockResolvedValueOnce({ key: "PROJECT" } as Project);
    const user = mount("2026-11-06");
    await user.click(button("Edit due date"));
    expect(screen.getByLabelText("Due date", { exact: true })).toHaveValue(
      "2026-11-06",
    );
    await user.click(button("Clear due date"));
    await user.click(button("Save due date"));
    await waitFor(() => expect(updateProject).toHaveBeenCalledOnce());
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeVisible();
    await act(async () =>
      reject({
        isAxiosError: true,
        response: { data: { message: "Could not save this date" } },
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save this date",
    );
    expect(screen.getByLabelText("Due date", { exact: true })).toHaveValue("");
    await user.click(button("Save due date"));
    expect(updateProject).toHaveBeenNthCalledWith(1, "TEAM", "PROJECT", {
      plannedDueDate: null,
    });
    await waitFor(() =>
      expect(updateProject).toHaveBeenNthCalledWith(2, "TEAM", "PROJECT", {
        plannedDueDate: null,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
