import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { CreateTeamModal } from "@/features/teams/components/CreateTeamModal";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal";
import { CreateTaskModal } from "@/features/tasks/components/CreateTaskModal";
import { createTeam } from "@/features/teams/api/teamApi";
import { createProject } from "@/features/projects/api/projectApi";
import { createTask } from "@/features/tasks/api/taskApi";

vi.mock("@/features/teams/api/teamApi", () => ({ createTeam: vi.fn() }));
vi.mock("@/features/projects/api/projectApi", () => ({
  createProject: vi.fn(),
}));
vi.mock("@/features/tasks/api/taskApi", () => ({ createTask: vi.fn() }));
vi.mock("@/features/teams/components/TeamMemberSelector", () => ({
  default: ({
    value,
    onChange,
    placeholder,
    excludedUserIds = [],
    disabled,
    ...props
  }: {
    value?: string;
    onChange: (id: string | null) => void;
    placeholder: string;
    excludedUserIds?: string[];
    disabled?: boolean;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    id?: string;
  }) => (
    <select
      id={props.id}
      aria-label={props["aria-label"] ?? placeholder}
      aria-describedby={props["aria-describedby"]}
      aria-invalid={props["aria-invalid"]}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {[
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ]
        .filter((id) => !excludedUserIds.includes(id))
        .map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
    </select>
  ),
}));
vi.mock("@/common/components/PrioritySelector", () => ({
  default: ({
    value,
    onChange,
    ...props
  }: {
    value?: string;
    onChange: (value: string) => void;
    id?: string;
    disabled?: boolean;
  }) => (
    <select
      {...props}
      aria-label="Priority"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose</option>
      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
        <option key={value}>{value}</option>
      ))}
    </select>
  ),
}));
vi.mock("@/common/components/DatePicker", () => ({
  default: ({
    value,
    onChange,
    disabled: _disabled,
    triggerDisabled,
    ...props
  }: {
    value?: Date;
    onChange: (value: Date) => void;
    disabled?: (date: Date) => boolean;
    triggerDisabled?: boolean;
    id?: string;
  }) => (
    <input
      {...props}
      data-calendar-disabled={Boolean(_disabled)}
      type="date"
      disabled={triggerDisabled}
      value={value?.toISOString().slice(0, 10) ?? ""}
      onChange={(event) =>
        onChange(new Date(`${event.target.value}T00:00:00Z`))
      }
    />
  ),
}));

type Entity = "Team" | "Project" | "Task";
const name = "New work";
const result = {
  key: "NEW",
  taskNumber: 7,
  name,
  status: "TODO",
  priority: "LOW",
};
const serverError = {
  isAxiosError: true,
  response: { status: 409, data: { message: "Please choose another name." } },
};
const apiFor = (
  entity: Entity,
): Mock<(...args: unknown[]) => Promise<unknown>> =>
  (entity === "Team"
    ? vi.mocked(createTeam)
    : entity === "Project"
      ? vi.mocked(createProject)
      : vi.mocked(createTask)) as unknown as Mock<
    (...args: unknown[]) => Promise<unknown>
  >;
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(createTeam).mockReset();
  vi.mocked(createProject).mockReset();
  vi.mocked(createTask).mockReset();
});
afterEach(() => client.clear());
function setup(entity: Entity, initialOpen = true) {
  const closed = vi.fn(),
    success = vi.fn();
  function Host({
    teamKey = "TEAM",
    projectKey = "PROJECT",
  }: {
    teamKey?: string;
    projectKey?: string;
  }) {
    const [open, setOpen] = useState(initialOpen);
    const onOpenChange = (value: boolean) => {
      if (!value) closed();
      setOpen(value);
    };
    return (
      <QueryClientProvider client={client}>
        <button onClick={() => setOpen(true)}>Open creation</button>
        {entity === "Team" ? (
          <CreateTeamModal
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={success}
          />
        ) : entity === "Project" ? (
          <CreateProjectModal
            teamKey={teamKey}
            open={open}
            onOpenChange={onOpenChange}
          />
        ) : (
          <CreateTaskModal
            teamKey={teamKey}
            projectKey={projectKey}
            open={open}
            onOpenChange={onOpenChange}
          />
        )}
      </QueryClientProvider>
    );
  }
  const rendered = render(<Host />);
  return { ...rendered, user: userEvent.setup(), closed, success, Host };
}
async function fill(entity: Entity, user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Name" }), name);
  await user.type(
    screen.getByRole("textbox", { name: "Description" }),
    "Draft details",
  );
  if (entity === "Task") {
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Priority" }),
      "CRITICAL",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Assignee" }),
      "00000000-0000-4000-8000-000000000001",
    );
    fireEvent.change(screen.getByLabelText("Planned Start", { exact: true }), {
      target: { value: "2026-11-04" },
    });
    fireEvent.change(screen.getByLabelText("Planned Due", { exact: true }), {
      target: { value: "2026-11-05" },
    });
  }
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: `Create ${entity.toLowerCase()}` }),
    ).toBeEnabled(),
  );
}
describe.each(["Team", "Project", "Task"] as const)(
  "%s creation consistency",
  (entity) => {
    it("connects unique field labels, counters, hints and validation errors", async () => {
      const { user } = setup(entity);
      expect(
        screen.getByRole("dialog", { name: `Create ${entity}` }),
      ).toHaveAccessibleDescription(/Required fields/);
      const input = screen.getByRole("textbox", { name: "Name" });
      expect(input).toHaveAttribute("aria-required", "true");
      expect(input).toHaveAccessibleDescription(/0 \/ 100/);
      expect(
        screen.getByLabelText("Description", { exact: true }),
      ).toHaveAccessibleDescription(/Optional.*0 \/ 2000/);
      await user.type(input, "ab");
      if (entity === "Task") await user.clear(input);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        entity === "Task" ? "Name is required" : "at least 3 characters",
      );
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(
        entity === "Task" ? /Name is required/ : /at least 3 characters/,
      );
      expect(apiFor(entity)).not.toHaveBeenCalled();
    });
    it("locks fields and every dismissal route while pending; failure preserves the draft and unlocks retry", async () => {
      let reject!: (reason: unknown) => void;
      apiFor(entity).mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      );
      const { user, closed } = setup(entity);
      await fill(entity, user);
      await user.dblClick(
        screen.getByRole("button", { name: `Create ${entity.toLowerCase()}` }),
      );
      await waitFor(() => expect(apiFor(entity)).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
      expect(
        screen.getByRole("textbox", { name: "Description" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Creating..." }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(
        `Creating ${entity.toLowerCase()}`,
      );
      fireEvent.submit(screen.getByRole("form"));
      await user.keyboard("{Escape}");
      fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
      expect(closed).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(apiFor(entity)).toHaveBeenCalledTimes(1);
      await act(async () => reject(serverError));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please choose another name.",
      );
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(name);
      expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
        "Draft details",
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
      apiFor(entity).mockResolvedValue(result as never);
      await user.click(
        screen.getByRole("button", { name: `Create ${entity.toLowerCase()}` }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(apiFor(entity)).toHaveBeenCalledTimes(2);
      expect(closed).toHaveBeenCalledOnce();
    });
    it("submits the existing payload and closes only after confirmation", async () => {
      let resolve!: (value: unknown) => void;
      apiFor(entity).mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }) as never,
      );
      const { user, closed, success } = setup(entity);
      await fill(entity, user);
      await user.click(
        screen.getByRole("button", { name: `Create ${entity.toLowerCase()}` }),
      );
      await waitFor(() => expect(apiFor(entity)).toHaveBeenCalledOnce());
      const args = apiFor(entity).mock.calls[0];
      const payload = args.at(-1);
      expect(payload).toEqual(
        expect.objectContaining({ name, description: "Draft details" }),
      );
      if (entity !== "Team") expect(args[0]).toBe("TEAM");
      if (entity === "Task") {
        expect(args[1]).toBe("PROJECT");
        expect(payload).toEqual(
          expect.objectContaining({
            priority: "CRITICAL",
            assigneeId: "00000000-0000-4000-8000-000000000001",
            plannedStartDate: "2026-11-04T00:00:00.000Z",
            plannedDueDate: "2026-11-05T00:00:00.000Z",
          }),
        );
      }
      expect(closed).not.toHaveBeenCalled();
      await act(async () => resolve(result));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(closed).toHaveBeenCalledOnce();
      if (entity === "Team")
        expect(success).toHaveBeenCalledExactlyOnceWith(result);
    });
    it.each(["Cancel", "Close", "Escape"])(
      "discards an idle draft through %s and reopens cleanly",
      async (action) => {
        const { user, closed } = setup(entity);
        await user.type(
          screen.getByRole("textbox", { name: "Name" }),
          "Unsent",
        );
        if (action === "Escape") await user.keyboard("{Escape}");
        else await user.click(screen.getByRole("button", { name: action }));
        expect(closed).toHaveBeenCalledOnce();
        await user.click(screen.getByRole("button", { name: "Open creation" }));
        expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(apiFor(entity)).not.toHaveBeenCalled();
      },
    );
    it("mounts no form while closed", () => {
      setup(entity, false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
      expect(apiFor(entity)).not.toHaveBeenCalled();
    });
  },
);

it("exposes all task validation errors on an incomplete form submission", async () => {
  const { user } = setup("Task");
  await user.type(screen.getByRole("textbox", { name: "Name" }), "X");
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(4));
  for (const label of [
    "Priority",
    "Assignee",
    "Planned Start",
    "Planned Due",
  ]) {
    const control = screen.getByLabelText(label, { exact: true });
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription();
  }
  expect(createTask).not.toHaveBeenCalled();
});
it.each(["Project", "Task"] as const)(
  "clears %s drafts on workspace scope changes",
  async (entity) => {
    const { user, rerender, Host } = setup(entity);
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Old workspace",
    );
    rerender(<Host teamKey="OTHER" projectKey="OTHER_PROJECT" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
  },
);

it("shows due-date feedback after choosing a start and preserves automatic schedule adjustment", async () => {
  const { user } = setup("Task");
  fireEvent.change(screen.getByLabelText("Planned Start"), {
    target: { value: "2026-11-04" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Due date is required",
  );
  expect(screen.getByLabelText("Planned Due")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await fill("Task", user);
  fireEvent.change(screen.getByLabelText("Planned Start"), {
    target: { value: "2026-11-06" },
  });
  expect(screen.getByLabelText("Planned Due")).toHaveValue("2026-11-06");
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
});
