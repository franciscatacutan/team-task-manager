import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DragEndEvent, DropAnimationFunction } from "@dnd-kit/core";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { Task } from "../types/task.types";
import { useTaskBoardMovement } from "./useTaskBoardMovement";

const task = { taskNumber: 17, name: "Move me", status: "TODO" } as Task;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function drop(status = "IN_PROGRESS") {
  return {
    activatorEvent: new MouseEvent("pointerdown"),
    active: { id: 17, data: { current: { task } } },
    over: { id: status, data: { current: { status } } },
  } as unknown as DragEndEvent;
}
let board: HTMLDivElement;
let reduced = false;
let listeners: Set<() => void>;
beforeEach(() => {
  authStorage.endLogout();
  authStorage.setToken("test");
  reduced = false;
  listeners = new Set();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  board = document.createElement("div");
  board.innerHTML = '<div data-task-number="17"></div>';
  document.body.append(board);
});
afterEach(() => {
  board.remove();
  authStorage.clearToken();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(change: () => Promise<unknown>) {
  return renderHook(
    ({ projectKey = "PROJECT", allowed = true }) =>
      useTaskBoardMovement({
        teamKey: "TEAM",
        projectKey,
        boardRef: { current: board },
        canMove: () => allowed,
        onStatusChange: change,
      }),
    { initialProps: { projectKey: "PROJECT", allowed: true } },
  );
}
function overlay() {
  const node = document.createElement("div");
  const finished = deferred<void>();
  const cancel = vi.fn(() => finished.reject(new Error("Cancelled")));
  const animate = vi
    .fn<(frames: Keyframe[], options: KeyframeAnimationOptions) => Animation>()
    .mockReturnValue({
      finished: finished.promise,
      cancel,
    } as unknown as Animation);
  node.animate = animate;
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
    left: 500,
    top: 100,
    width: 300,
    height: 200,
  } as DOMRect);
  vi.spyOn(board.firstElementChild!, "getBoundingClientRect").mockReturnValue({
    left: 510,
    top: 400,
    width: 300,
    height: 200,
  } as DOMRect);
  const args = {
    active: { id: 17 },
    dragOverlay: { node },
    transform: { x: 300, y: 0, scaleX: 1, scaleY: 1 },
  } as unknown as Parameters<DropAnimationFunction>[0];
  return { args, animate, finished, cancel };
}

describe("confirmed board movement", () => {
  it("holds the overlay until confirmation, then settles at the actual sorted position", async () => {
    const save = deferred<void>();
    const change = vi.fn(() => save.promise);
    const { result } = setup(change);
    const animation = overlay();
    act(() => result.current.onDragEnd(drop()));
    let done!: Promise<void> | void;
    act(() => {
      done = result.current.dropAnimation(animation.args);
    });
    expect(result.current.pending?.destination).toBe("IN_PROGRESS");
    expect(result.current.feedback?.kind).toBe("pending");
    expect(animation.animate).not.toHaveBeenCalled();
    await act(async () => save.resolve());
    await waitFor(() => expect(animation.animate).toHaveBeenCalledOnce());
    expect(animation.animate.mock.calls[0]).toEqual([
      [
        {
          transform: "translate3d(300px, 0px, 0) scaleX(1) scaleY(1)",
          opacity: 1,
        },
        {
          transform: "translate3d(310px, 300px, 0) scaleX(1) scaleY(1)",
          opacity: 1,
        },
      ],
      { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    ]);
    expect(result.current.pending).not.toBeNull();
    await act(async () => {
      animation.finished.resolve();
      await done;
    });
    expect(result.current.pending).toBeNull();
    expect(result.current.feedback?.kind).toBe("success");
    expect(change).toHaveBeenCalledExactlyOnceWith(17, "IN_PROGRESS");
  });
  it("keeps one attempt in flight and offers a guarded retry after failure", async () => {
    const save = deferred<void>();
    const change = vi.fn(() => save.promise);
    const { result } = setup(change);
    act(() => {
      result.current.onDragEnd(drop());
      result.current.onDragEnd(drop("DONE"));
    });
    expect(change).toHaveBeenCalledOnce();
    await act(async () => save.reject(new Error("offline")));
    await waitFor(() => expect(result.current.pending).toBeNull());
    expect(result.current.feedback).toMatchObject({
      kind: "error",
      retry: { task, destination: "IN_PROGRESS" },
    });
    change.mockResolvedValueOnce(undefined);
    act(() => result.current.retry(null));
    expect(change).toHaveBeenLastCalledWith(17, "IN_PROGRESS", true);
    await waitFor(() => expect(result.current.pending).toBeNull());
    expect(result.current.feedback?.kind).toBe("success");
  });
  it("does not send same-column or invalid drops", () => {
    const change = vi.fn(async () => {});
    const { result } = setup(change);
    act(() => result.current.onDragEnd(drop("TODO")));
    expect(result.current.feedback?.message).toMatch(/selected sort order/);
    act(() => result.current.onDragEnd(drop("DELETED")));
    expect(result.current.feedback?.kind).toBe("error");
    expect(change).not.toHaveBeenCalled();
  });
  it.each(["project", "account", "unmount"])(
    "ignores late settlement after %s changes",
    async (type) => {
      const save = deferred<void>();
      const change = vi.fn(() => save.promise);
      const { result, rerender, unmount } = setup(change);
      const animation = overlay();
      act(() => result.current.onDragEnd(drop()));
      let done!: Promise<void> | void;
      act(() => {
        done = result.current.dropAnimation(animation.args);
      });
      if (type === "project") rerender({ projectKey: "OTHER", allowed: true });
      if (type === "account") {
        act(() => authStorage.setToken("other"));
        rerender({ projectKey: "PROJECT", allowed: true });
      }
      if (type === "unmount") unmount();
      await act(async () => {
        save.resolve();
        await done;
      });
      expect(animation.animate).not.toHaveBeenCalled();
      if (type !== "unmount") {
        expect(result.current.feedback).toBeNull();
        expect(result.current.pending).toBeNull();
        act(() => result.current.retry(null));
        expect(change).toHaveBeenCalledOnce();
      }
    },
  );
  it("fades in place when the confirmed task is outside the visible page/filter", async () => {
    const save = deferred<void>();
    const { result } = setup(() => save.promise);
    const animation = overlay();
    board.replaceChildren();
    act(() => result.current.onDragEnd(drop()));
    let done!: Promise<void> | void;
    act(() => {
      done = result.current.dropAnimation(animation.args);
    });
    await act(async () => save.resolve());
    await waitFor(() => expect(animation.animate).toHaveBeenCalledOnce());
    expect(animation.animate.mock.calls[0][0]).toEqual([
      {
        transform: "translate3d(300px, 0px, 0) scaleX(1) scaleY(1)",
        opacity: 1,
      },
      {
        transform: "translate3d(300px, 0px, 0) scaleX(1) scaleY(1)",
        opacity: 0,
      },
    ]);
    await act(async () => {
      animation.finished.resolve();
      await done;
    });
  });
  it("skips motion when reduced motion is enabled and cancels an active animation on preference change", async () => {
    const { result } = setup(vi.fn(async () => {}));
    const animation = overlay();
    act(() => {
      reduced = true;
      listeners.forEach((listener) => listener());
    });
    await act(async () => result.current.dropAnimation(animation.args));
    expect(animation.animate).not.toHaveBeenCalled();
    act(() => {
      reduced = false;
      listeners.forEach((listener) => listener());
    });
    let done!: Promise<void> | void;
    act(() => {
      done = result.current.dropAnimation(animation.args);
    });
    expect(animation.animate).toHaveBeenCalledOnce();
    await act(async () => {
      reduced = true;
      listeners.forEach((listener) => listener());
    });
    await act(async () => done);
    expect(animation.cancel).toHaveBeenCalledOnce();
  });
});
