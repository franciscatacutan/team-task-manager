import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrioritySelector from "./PrioritySelector";
import TaskStatusSelector from "./TaskStatusSelector";
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
afterEach(() => vi.unstubAllGlobals());
function polyfill() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}
describe("task metadata choices", () => {
  it("requires a deliberate priority choice and includes Critical", async () => {
    polyfill();
    const change = vi.fn();
    render(<PrioritySelector onChange={change} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Select priority");
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("[Enter]");
    await userEvent.click(screen.getByRole("option", { name: "Critical" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("CRITICAL");
  });
  it("offers only the current status and permitted reopening transitions for DONE", async () => {
    polyfill();
    const change = vi.fn();
    render(<TaskStatusSelector value="DONE" onChange={change} />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("[Enter]");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Done", "In Review", "On Hold"]);
    await userEvent.click(screen.getByRole("option", { name: "In Review" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("IN_REVIEW");
  });
  it.each(["CANCELLED", "DELETED"] as const)(
    "keeps terminal %s disabled",
    (value) => {
      render(<TaskStatusSelector value={value} onChange={vi.fn()} />);
      expect(screen.getByRole("combobox")).toBeDisabled();
    },
  );
});
