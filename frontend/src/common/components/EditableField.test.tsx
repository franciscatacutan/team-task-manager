import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EditableField from "./EditableField";

describe("editable field server value synchronization", () => {
  it("preserves an open draft through background refresh and saves the edited value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <EditableField value="Original name" onSave={onSave} />,
    );
    await user.click(screen.getByText("Original name"));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Unsaved draft");
    rerender(<EditableField value="Updated on server" onSave={onSave} />);
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved draft");
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "  Final name  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Final name");
  });

  it("discards a draft on Escape and reopens with the current value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditableField value="Original name" onSave={onSave} />);
    await user.click(screen.getByText("Original name"));
    await user.type(screen.getByRole("textbox"), " draft");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByText("Original name"));
    expect(screen.getByRole("textbox")).toHaveValue("Original name");
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("confirmed inline saves", () => {
  it("retains a rejected draft and retries it explicitly", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: "Task is archived" } },
      })
      .mockResolvedValueOnce(undefined);
    render(<EditableField value="Original" onSave={save} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Original"));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Draft");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task is archived",
    );
    expect(screen.getByRole("textbox")).toHaveValue("Draft");
    await user.click(document.body);
    expect(screen.getByRole("textbox")).toHaveValue("Draft");
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument(),
    );
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("keeps the editor pending and ignores Escape and repeated Save while awaiting confirmation", async () => {
    let done!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          done = resolve;
        }),
    );
    render(<EditableField value="Original" onSave={save} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Original"));
    await user.type(screen.getByRole("textbox"), " draft");
    await user.dblClick(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox")).toBeDisabled();
    await user.keyboard("[Escape]");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await act(async () => {
      done();
    });
    await waitFor(() =>
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument(),
    );
  });
  it("supports clearing optional descriptions while keeping names required", async () => {
    const save = vi.fn();
    const { rerender } = render(
      <EditableField value="Details" multiline allowEmpty onSave={save} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("Details"));
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledExactlyOnceWith("");
    rerender(<EditableField value="Name" onSave={save} />);
    await user.click(screen.getByText("Name"));
    await user.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
  it("opens and saves from the keyboard", async () => {
    const save = vi.fn();
    render(<EditableField value="Name" onSave={save} />);
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Edit name" }).focus();
    await user.keyboard("[Enter]");
    await user.type(screen.getByRole("textbox"), " changed");
    await user.keyboard("[Enter]");
    expect(save).toHaveBeenCalledExactlyOnceWith("Name changed");
  });
  it("describes a lost response without claiming rollback", async () => {
    render(
      <EditableField
        value="Name"
        onSave={async () => {
          throw { isAxiosError: true };
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("Name"));
    await user.type(screen.getByRole("textbox"), " changed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm the change",
    );
  });
});
