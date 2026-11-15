import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MultiUserSelector from "./MultiUserSelector";

const selected = {
  id: "selected",
  firstName: "Selected",
  lastName: "User",
  email: "selected@example.test",
  role: "USER" as const,
};
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());

describe("retained member selections", () => {
  it("keeps a selected name visible after choices refresh and lets it be deselected", async () => {
    const onChange = vi.fn();
    render(
      <MultiUserSelector
        users={[]}
        selectedUsers={[selected]}
        value={[selected.id]}
        search=""
        onSearchChange={vi.fn()}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Selected User")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Selected User" }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });
  it("prevents changing selections while the batch is pending", async () => {
    const onChange = vi.fn();
    render(
      <MultiUserSelector
        users={[selected]}
        selectedUsers={[selected]}
        value={[selected.id]}
        search=""
        onSearchChange={vi.fn()}
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Remove Selected User" }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

it("names the selector and opens it by keyboard without submitting its parent form", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <MultiUserSelector
        aria-label="Team candidates"
        users={[]}
        value={[]}
        search=""
        onSearchChange={vi.fn()}
        onChange={vi.fn()}
      />
    </form>,
  );
  screen.getByRole("combobox", { name: "Team candidates" }).focus();
  await userEvent.keyboard("[Enter]");
  expect(
    screen.getByRole("combobox", { name: "Search users" }),
  ).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});
