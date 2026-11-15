import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import DraggableTaskCard from "./DraggableTaskCard";
import type { Task } from "../types/task.types";

const task: Task = {
  taskNumber: 17,
  name: "Move or open",
  description: "Drag from this description",
  status: "TODO",
  priority: "MEDIUM",
  createdAt: "2026-11-01",
  updatedAt: "2026-11-01",
  lastActivityAt: null,
};
beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width: 300,
    height: 200,
    right: 300,
    bottom: 200,
    toJSON: () => ({}),
  });
});
afterEach(async () => {
  // dnd-kit's document click suppression lasts 50 ms after releasing a drag.
  fireEvent.pointerUp(document);
  await new Promise((resolve) => setTimeout(resolve, 60));
  vi.unstubAllGlobals();
});
function mount(disabled = false) {
  const start = vi.fn(),
    end = vi.fn(),
    open = vi.fn();
  function Board() {
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      useSensor(KeyboardSensor),
    );
    return (
      <DndContext sensors={sensors} onDragStart={start} onDragEnd={end}>
        <DraggableTaskCard
          task={task}
          disabled={disabled}
          muted={false}
          movementActive={false}
          onOpenTask={open}
        />
      </DndContext>
    );
  }
  const view = render(<Board />);
  return {
    ...view,
    start,
    end,
    open,
    body: screen.getByText(task.description!),
    name: screen.getByRole("button", { name: "Open task #17: Move or open" }),
    grip: screen.getByRole("button", { name: "Move task #17: Move or open" }),
  };
}
function down(target: Element, pointerType = "mouse", button = 0) {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button,
    clientX: 20,
    clientY: 30,
  });
}
function move(pointerType = "mouse", distance = 30) {
  fireEvent.pointerMove(document, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    clientX: 20 + distance,
    clientY: 30,
  });
  // The first movement crosses the threshold; subsequent movement positions the active drag.
  fireEvent.pointerMove(document, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    clientX: 30 + distance,
    clientY: 30,
  });
}

describe("whole-card pointer activation", () => {
  it.each(["body", "name", "grip"] as const)(
    "picks up with a mouse from %s exactly once",
    async (part) => {
      const view = mount();
      down(view[part]);
      move();
      await waitFor(() => expect(view.start).toHaveBeenCalledOnce());
      fireEvent.pointerUp(document, { pointerId: 1, pointerType: "mouse" });
      fireEvent.click(view.name);
      expect(view.end).toHaveBeenCalledOnce();
      expect(view.open).not.toHaveBeenCalled();
    },
  );
  it("opens on an ordinary name click without starting a drag", async () => {
    const view = mount();
    await userEvent.click(view.name);
    expect(view.open).toHaveBeenCalledExactlyOnceWith(task);
    expect(view.start).not.toHaveBeenCalled();
  });
  it("keeps small name movement as a click", () => {
    const view = mount();
    down(view.name);
    fireEvent.pointerMove(document, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 23,
      clientY: 30,
    });
    fireEvent.pointerUp(document, { pointerId: 1, pointerType: "mouse" });
    fireEvent.click(view.name);
    expect(view.start).not.toHaveBeenCalled();
    expect(view.open).toHaveBeenCalledExactlyOnceWith(task);
  });
  it.each(["body", "name"] as const)(
    "leaves touch scrolling available from %s",
    (part) => {
      const view = mount();
      down(view[part], "touch");
      move("touch");
      expect(view.start).not.toHaveBeenCalled();
      expect(
        view.container.querySelector("[data-task-number]"),
      ).not.toHaveClass("touch-none");
    },
  );
  it("still starts touch dragging from the grip", async () => {
    const view = mount();
    down(view.grip, "touch");
    move("touch");
    await waitFor(() => expect(view.start).toHaveBeenCalledOnce());
    expect(view.grip).toHaveClass("touch-none");
  });
  it("does not move when disabled and keeps details available", async () => {
    const view = mount(true);
    down(view.body);
    move();
    expect(view.start).not.toHaveBeenCalled();
    expect(view.grip).toBeDisabled();
    await userEvent.click(view.name);
    expect(view.open).toHaveBeenCalledExactlyOnceWith(task);
  });
  it("leaves other interactive controls independent", () => {
    const view = mount();
    const action = document.createElement("button");
    action.textContent = "Another action";
    view.body.append(action);
    down(action);
    move();
    expect(view.start).not.toHaveBeenCalled();
  });
  it("ignores a secondary mouse button", () => {
    const view = mount();
    down(view.body, "mouse", 2);
    move();
    expect(view.start).not.toHaveBeenCalled();
  });
  it("keeps keyboard opening separate from grip pickup", async () => {
    const view = mount();
    view.name.focus();
    await userEvent.keyboard("[Space]");
    expect(view.open).toHaveBeenCalledExactlyOnceWith(task);
    expect(view.start).not.toHaveBeenCalled();
    view.grip.focus();
    await userEvent.keyboard("[Space]");
    await waitFor(() => expect(view.start).toHaveBeenCalledOnce());
    await userEvent.keyboard("[Escape]");
  });
});
