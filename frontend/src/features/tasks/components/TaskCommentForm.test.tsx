import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskCommentForm from "./TaskCommentForm";
import { createTaskComment } from "../api/taskApi";
import { authStorage } from "@/features/auth/utils/authStorage";

vi.mock("../api/taskApi", () => ({ createTaskComment: vi.fn() }));
const post = vi.mocked(createTaskComment);
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  authStorage.setToken("test-login");
  post.mockReset();
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
});
function deferred() {
  let resolve!: (value: never) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<never>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const props = { teamKey: "TEAM", projectKey: "PROJECT", taskNumber: 1 };
const view = (taskNumber = 1) => (
  <QueryClientProvider client={client}>
    <TaskCommentForm {...props} taskNumber={taskNumber} />
  </QueryClientProvider>
);
const failure = {
  isAxiosError: true,
  response: { status: 500, data: { message: "Comment could not be saved." } },
};

describe("comment posting lifecycle", () => {
  it("locks text and cancel, prevents duplicate sends and clears only after success", async () => {
    const request = deferred();
    post.mockReturnValue(request.promise);
    render(view());
    const user = userEvent.setup();
    const field = screen.getByRole("textbox", { name: "Comment" });
    await user.type(field, "Keep this draft");
    const button = screen.getByRole("button", { name: "Post" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(field).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Posting..." })).toBeDisabled();
    expect(field).toHaveValue("Keep this draft");
    fireEvent.change(field, { target: { value: "Accidental edit" } });
    expect(field).toHaveValue("Keep this draft");
    await act(async () => request.resolve({} as never));
    await waitFor(() => expect(field).toHaveValue(""));
    expect(field).toBeEnabled();
    expect(post).toHaveBeenCalledWith("TEAM", "PROJECT", 1, "Keep this draft");
    expect(screen.getByRole("status")).toHaveTextContent("Comment posted.");
  });

  it("retains failed text with a described error and explicit retry, without automatic posting", async () => {
    post.mockRejectedValueOnce(failure).mockResolvedValueOnce({} as never);
    render(view());
    const user = userEvent.setup();
    const field = screen.getByRole("textbox", { name: "Comment" });
    await user.type(field, "Retry this text");
    await user.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Comment could not be saved.",
    );
    expect(field).toHaveAccessibleDescription("Comment could not be saved.");
    expect(field).toBeEnabled();
    expect(field).toHaveValue("Retry this text");
    expect(post).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Retry comment" }));
    await waitFor(() => expect(field).toHaveValue(""));
    expect(post).toHaveBeenNthCalledWith(
      2,
      "TEAM",
      "PROJECT",
      1,
      "Retry this text",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the user edit or cancel a failed draft without posting", async () => {
    post.mockRejectedValue(failure);
    render(view());
    const user = userEvent.setup();
    const field = screen.getByRole("textbox", { name: "Comment" });
    await user.type(field, "Original");
    await user.click(screen.getByRole("button", { name: "Post" }));
    await screen.findByRole("alert");
    await user.type(field, " edited");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(field).toHaveValue("Original edited");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(field).toHaveValue("");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("rejects whitespace-only comments", async () => {
    render(view());
    await userEvent.type(
      screen.getByRole("textbox", { name: "Comment" }),
      "   ",
    );
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it.each(["task", "account"])(
    "isolates a new %s draft from a late previous success",
    async (change) => {
      const request = deferred();
      post.mockReturnValue(request.promise);
      const rendered = render(view());
      const user = userEvent.setup();
      await user.type(screen.getByRole("textbox"), "Old draft");
      await user.click(screen.getByRole("button", { name: "Post" }));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      if (change === "account") authStorage.setToken("next-login");
      rendered.rerender(view(change === "task" ? 2 : 1));
      const field = screen.getByRole("textbox");
      expect(field).toHaveValue("");
      await user.type(field, "New draft");
      await act(async () => request.resolve({} as never));
      expect(field).toHaveValue("New draft");
      expect(screen.queryByText("Comment posted.")).not.toBeInTheDocument();
    },
  );

  it("reports uncertain network outcomes without discarding text or automatically retrying", async () => {
    post.mockRejectedValue({ isAxiosError: true });
    render(view());
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Possibly saved");
    await user.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm the change. Refresh the data before retrying.",
    );
    expect(screen.getByRole("textbox")).toHaveValue("Possibly saved");
    expect(post).toHaveBeenCalledTimes(1);
  });
});
