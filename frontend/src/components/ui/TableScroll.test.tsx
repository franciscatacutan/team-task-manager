import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "./table";

const observers: {
  measure: () => void;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: () => void) {
        observers.push({ measure: callback, disconnect: this.disconnect });
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function table(value = "A task") {
  return (
    <Table id="tasks" aria-label="Task records" scrollLabel="Tasks table">
      <TableBody>
        <TableRow>
          <TableCell>{value}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
function dimensions(
  element: Element,
  width: number,
  contentWidth: number,
  height: number,
  contentHeight: number,
) {
  for (const [name, value] of Object.entries({
    clientWidth: width,
    scrollWidth: contentWidth,
    clientHeight: height,
    scrollHeight: contentHeight,
  }))
    Object.defineProperty(element, name, { configurable: true, value });
}
function measure() {
  act(() => observers.at(-1)!.measure());
}

describe("keyboard access to table scrolling", () => {
  it("preserves the semantic table without adding a region or tab stop when it fits", () => {
    const view = render(table());
    const container = view.container.querySelector(
      '[data-slot="table-container"]',
    )!;
    dimensions(container, 400, 400, 200, 200);
    measure();
    expect(screen.getByRole("table", { name: "Task records" })).toHaveAttribute(
      "id",
      "tasks",
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute("tabindex");
    expect(container).not.toHaveAttribute("aria-label");
  });
  it.each([
    {
      axis: "horizontal",
      width: 250,
      contentWidth: 600,
      height: 200,
      contentHeight: 200,
    },
    {
      axis: "vertical",
      width: 400,
      contentWidth: 400,
      height: 100,
      contentHeight: 500,
    },
  ])(
    "names and focuses $axis overflow, then removes the extra stop once it fits",
    ({ width, contentWidth, height, contentHeight }) => {
      const view = render(table());
      const container = view.container.querySelector(
        '[data-slot="table-container"]',
      )!;
      dimensions(container, width, contentWidth, height, contentHeight);
      measure();
      const region = screen.getByRole("region", { name: "Tasks table" });
      expect(region).toHaveAttribute("tabindex", "0");
      region.focus();
      expect(region).toHaveFocus();
      dimensions(container, 600, 600, 500, 500);
      fireEvent(window, new Event("resize"));
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
      expect(container).not.toHaveAttribute("tabindex");
    },
  );
  it("ignores subpixel rounding rather than inserting an unnecessary stop", () => {
    const view = render(table());
    const container = view.container.querySelector(
      '[data-slot="table-container"]',
    )!;
    dimensions(container, 400, 401, 200, 201);
    measure();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
  it("remeasures changed rows and disconnects observers on replacement and unmount", () => {
    const view = render(table());
    const container = view.container.querySelector(
      '[data-slot="table-container"]',
    )!;
    const initialObserver = observers[0];
    dimensions(container, 200, 800, 100, 600);
    view.rerender(table("Long replacement task"));
    expect(initialObserver.disconnect).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Tasks table" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    const lastObserver = observers.at(-1)!;
    view.unmount();
    expect(lastObserver.disconnect).toHaveBeenCalledOnce();
  });
  it("still measures on resize when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const view = render(table());
    const container = view.container.querySelector(
      '[data-slot="table-container"]',
    )!;
    dimensions(container, 200, 600, 100, 100);
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("region", { name: "Tasks table" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
