import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EditableField from "./EditableField";

describe("editable field server value synchronization", () => {
  it("shows refreshed values in an open editor and saves the edited value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <EditableField value="Original name" onSave={onSave} />,
    );
    await user.click(screen.getByText("Original name"));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Unsaved draft");
    rerender(<EditableField value="Updated on server" onSave={onSave} />);
    expect(screen.getByRole("textbox")).toHaveValue("Updated on server");
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
